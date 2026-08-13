// lib/onboarding/OnboardingContext.tsx — state machine + persistence for
// in-app guidance.
//
// Trigger rules (spec):
//   - tooltips show once per install (hasSeenTooltip) — never spam on repeat
//   - tours run once (isTourCompleted) and resume at the first unfinished
//     step, so a skipped/interrupted tour does not restart from step 1
//   - the overlay is driven from a single `view` state; the target rect is
//     measured before showing, and a 250ms safety timer falls back to a
//     default position when the host never calls back (e.g. jest mocks)
//
// Screens register their target elements by id (see useOnboardingTarget) and
// call showTooltip / startTour. The root overlay (OnboardingOverlay) renders
// above everything else — no per-screen manual positioning needed.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { getAppMeta, setAppMeta } from '../../db/promptRepository';
import type { MetaStore, OnboardingStep, OnboardingView, TooltipSpec } from './types';
import * as storage from './onboardingStorage';
import { OnboardingOverlay } from './OnboardingOverlay';
import type { Rect } from './placement';
import type { View as NativeView } from 'react-native';

const metaStore: MetaStore = { get: getAppMeta, set: setAppMeta };

/**
 * A ref to a native host element that can be measured via measureInWindow.
 * We structurally type just the measurement surface so any View/Text ref
 * satisfies it; the overlay never needs the rest of the host API.
 */
export interface Measurable {
  measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
}

export type TargetRef = NativeView | null;

type TargetRefObject = RefObject<Measurable | TargetRef>;

interface OnboardingContextValue {
  /** Register a target element so a tooltip/tour can point at it. */
  registerTarget: (id: string, ref: TargetRefObject) => void;
  unregisterTarget: (id: string) => void;
  /** Show a one-time tooltip (no-op if already seen this install). */
  showTooltip: (spec: TooltipSpec) => Promise<void>;
  /** Start (or resume) a sequential tour. No-op if already completed. */
  startTour: (tourId: string, steps: OnboardingStep[]) => Promise<void>;
  /** Advance to the next tour step; finishes the tour on the last step. */
  nextStep: () => Promise<void>;
  /** Skip the whole tour and mark it completed (never nags again). */
  skipTour: () => Promise<void>;
  /** Show a short "why is this disabled?" explanation (DisabledStateHelper). */
  showDisabledHelp: (targetId: string, help: { reason: string; unlockHint: string }) => Promise<void>;
  /** Dismiss whatever is currently shown. */
  dismiss: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used inside <OnboardingProvider>');
  return ctx;
}

/**
 * Like useOnboarding but returns null when no provider is mounted. Used by
 * optional-enhancement components (Tooltip, DisabledStateHelper) so they
 * degrade gracefully to plain children when used outside the provider (e.g.
 * unit tests rendering a form on its own) instead of crashing the app.
 */
export function useOptionalOnboarding(): OnboardingContextValue | null {
  return useContext(OnboardingContext);
}

/**
 * Returns a ref to attach to a target element + registers it with the
 * provider. Unregisters automatically on unmount. When no provider is
 * mounted the ref still works — it just isn't registered anywhere. Usage:
 *
 *   const searchRef = useOnboardingTarget('home-search');
 *   <View ref={searchRef}>…</View>
 */
export function useOnboardingTarget(id: string): RefObject<NativeView | null> {
  const ctx = useOptionalOnboarding();
  const ref = useRef<NativeView | null>(null);
  useEffect(() => {
    ctx?.registerTarget(id, ref);
    return () => ctx?.unregisterTarget(id);
  }, [id, ctx]);
  return ref;
}

/** measureInWindow on a native element ref → Rect, or null if unavailable. */
function measureRef(ref: TargetRefObject | undefined): Promise<Rect | null> {
  return new Promise((resolve) => {
    let settled = false;
    // Hoisted so the early-return paths can cancel it; undefined is a no-op.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = (rect: Rect | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(rect);
    };
    const el = ref?.current as Measurable | null | undefined;
    if (!el || typeof el.measureInWindow !== 'function') {
      settle(null);
      return;
    }
    // Safety net: some hosts never invoke the measure callback (e.g. jest's
    // View mock, or a view detached mid-measure). Never leave the overlay
    // waiting forever — fall back to the default popup position. On a real
    // device the callback fires within a frame, so this timer is a no-op.
    timer = setTimeout(() => settle(null), 250);
    try {
      el.measureInWindow((x, y, width, height) => {
        // A zero-size rect means the element is not laid out yet — treat as
        // "not measurable" so the overlay falls back to a default position.
        settle(width > 0 && height > 0 ? { x, y, width, height } : null);
      });
    } catch {
      settle(null);
    }
  });
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<OnboardingView | null>(null);
  const targets = useRef(new Map<string, TargetRefObject>());

  // Keep the latest view in a ref so async handlers (nextStep) can read the
  // current step without stale-closure bugs.
  const viewRef = useRef(view);
  viewRef.current = view;

  const registerTarget = useCallback((id: string, ref: TargetRefObject) => {
    targets.current.set(id, ref);
  }, []);

  const unregisterTarget = useCallback((id: string) => {
    targets.current.delete(id);
  }, []);

  const dismiss = useCallback(() => setView(null), []);

  const showTooltip = useCallback(async (spec: TooltipSpec) => {
    // Trigger rule: only ever show once per install.
    if (await storage.hasSeenTooltip(metaStore, spec.id)) return;
    await storage.markTooltipSeen(metaStore, spec.id);
    // Re-check that nothing else took over the overlay while we were awaiting
    // (e.g. a tour started, or the user dismissed another tooltip).
    const before = viewRef.current;
    const rect = await measureRef(targets.current.get(spec.targetId));
    if (viewRef.current !== before) return;
    setView({ kind: 'tooltip', spec, rect });
  }, []);

  const startTour = useCallback(async (tourId: string, steps: OnboardingStep[]) => {
    if (steps.length === 0) return;
    // Trigger rule: never re-run a completed tour.
    if (await storage.isTourCompleted(metaStore, tourId)) return;
    // Resume at the first unfinished step (a skipped tour stays completed,
    // but an interrupted one resumes where the user left off).
    const startIndex = await storage.firstIncompleteStep(metaStore, tourId, steps);
    if (startIndex >= steps.length) {
      await storage.markTourCompleted(metaStore, tourId);
      return;
    }
    const before = viewRef.current;
    const rect = await measureRef(targets.current.get(steps[startIndex].targetId));
    if (viewRef.current !== before) return;
    setView({ kind: 'tour', tourId, steps, stepIndex: startIndex, rect });
  }, []);

  const nextStep = useCallback(async () => {
    const current = viewRef.current;
    if (!current || current.kind !== 'tour') return;
    const { tourId, steps, stepIndex } = current;

    // Persist progress so an interruption resumes here, not at step 1.
    await storage.markStepCompleted(metaStore, tourId, steps[stepIndex].id);

    // If Skip/Dismiss fired while we were awaiting (the overlay was still
    // showing its buttons), that is authoritative — do not resurrect the tour.
    if (viewRef.current !== current) return;

    if (stepIndex + 1 >= steps.length) {
      await storage.markTourCompleted(metaStore, tourId);
      setView(null);
      return;
    }
    const nextIndex = stepIndex + 1;
    const before = viewRef.current;
    const rect = await measureRef(targets.current.get(steps[nextIndex].targetId));
    if (viewRef.current !== before) return;
    setView({ kind: 'tour', tourId, steps, stepIndex: nextIndex, rect });
  }, []);

  const skipTour = useCallback(async () => {
    const current = viewRef.current;
    if (!current || current.kind !== 'tour') return;
    // Skipping counts as "completed" so the tour never nags again.
    await storage.markTourCompleted(metaStore, current.tourId);
    setView(null);
  }, []);

  const showDisabledHelp = useCallback(
    async (targetId: string, help: { reason: string; unlockHint: string }) => {
      const before = viewRef.current;
      const rect = await measureRef(targets.current.get(targetId));
      if (viewRef.current !== before) return;
      setView({ kind: 'help', help, rect });
    },
    []
  );

  const value = useMemo<OnboardingContextValue>(
    () => ({
      registerTarget,
      unregisterTarget,
      showTooltip,
      startTour,
      nextStep,
      skipTour,
      showDisabledHelp,
      dismiss,
    }),
    [registerTarget, unregisterTarget, showTooltip, startTour, nextStep, skipTour, showDisabledHelp, dismiss]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {view && <OnboardingOverlay view={view} onNext={nextStep} onSkip={skipTour} onDismiss={dismiss} />}
    </OnboardingContext.Provider>
  );
}
