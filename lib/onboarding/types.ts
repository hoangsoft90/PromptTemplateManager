// lib/onboarding/types.ts — shared types for the in-app guidance system.

import type { Placement, Rect } from './placement';

/** Minimal key/value store abstraction over the platform repository. */
export interface MetaStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

/** One step of a sequential onboarding tour. */
export interface OnboardingStep {
  /** Stable id — persisted as `...:step:<id>:done` for resume support. */
  id: string;
  /** Id of the registered target element this step highlights. */
  targetId: string;
  title: string;
  message: string;
  /** Preferred tooltip edge; auto-falls-back when there is no room. */
  placement?: Placement;
}

/** A single tooltip (not part of a tour). */
export interface TooltipSpec {
  /** Stable id — shown only once per install. */
  id: string;
  title?: string;
  message: string;
  /** Id of the registered target element to point at. */
  targetId: string;
  placement?: Placement;
  /** Dim + cut a spotlight hole around the target (stronger emphasis). */
  spotlight?: boolean;
}

/** Short explanation for a disabled control (see DisabledStateHelper). */
export interface DisabledHelp {
  reason: string;
  unlockHint: string;
}

/**
 * What the overlay is currently rendering:
 *  - 'tooltip': single one-time tip (optional spotlight)
 *  - 'tour':    sequential steps with Skip / Next / Done
 *  - 'help':    disabled-control explanation
 */
export type OnboardingView =
  | { kind: 'tooltip'; spec: TooltipSpec; rect: Rect | null }
  | { kind: 'tour'; tourId: string; steps: OnboardingStep[]; stepIndex: number; rect: Rect | null }
  | { kind: 'help'; help: DisabledHelp; rect: Rect | null };
