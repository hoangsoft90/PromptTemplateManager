## Context

See proposal.md — Why for motivation. This is an additive feature on the shipped Prompt Template Manager MVP (Expo/React Native, expo-router, expo-sqlite). The app already persists non-DB preferences in the `app_meta` key/value table via `db/promptRepository` (`getAppMeta`/`setAppMeta`), and already uses the root-layout-provider pattern (`ToastProvider`, `AdGateHost`). The guidance layer reuses both: app_meta for seen/completed state, and a root-mounted provider + overlay so no per-screen positioning code is needed.

## Goals / Non-Goals

**Goals:**
- Teach the Search → Fill → Copy loop to first-time users with a spotlight tour, once per install.
- Flag new features with a reusable "New" badge and point users at them with one-time tooltips.
- Explain disabled controls on tap instead of silent dead-ends.
- Persist all "already seen" state in the existing `app_meta` table (no new storage dependency).
- Position popups automatically relative to the target element, flipping edges and clamping to the screen.

**Non-Goals (design-level):**
- No multi-screen, step-gated behavioral onboarding (e.g. "must complete step 1 before step 2 unlocks"). Tours are informational only — they never block usage.
- No analytics on which tooltips were seen (NSM counters are a separate future concern).
- No new dependencies; no native code; no changes to the data schema or export format.

## Decisions

### D1. Storage: reuse app_meta via an injected store interface
`lib/onboarding/onboardingStorage.ts` defines a minimal `MetaStore { get(key): Promise<string|null>; set(key, value): Promise<void> }` and the provider injects `{ get: getAppMeta, set: setAppMeta }`. Keys are namespaced (`onboarding:tooltip:<id>:seen`, `onboarding:tour:<id>:completed`, `onboarding:tour:<id>:step:<sid>:done`).

- Rationale: per MVP design.md D1, app_meta is the project's single non-DB pref store — no AsyncStorage/MMKV. Injection keeps the storage module pure and unit-testable with an in-memory map.
- Alternative considered: AsyncStorage — rejected (adds a dependency when app_meta already exists and is the documented decision).

### D2. Root provider + single overlay (no per-screen positioning)
`OnboardingProvider` renders once in `app/_layout.tsx`. It holds a single `view` state (`tooltip | tour | help | null`) and a registry of target refs (`Map<id, RefObject>`). `OnboardingOverlay` renders above everything when `view` is non-null. Screens register targets via `useOnboardingTarget(id)` and trigger via `showTooltip` / `startTour` / `showDisabledHelp`.

- Rationale: mirrors the existing `ToastProvider` pattern; a single overlay avoids z-order/measurement fights across screens and works even when the target lives behind a navigation transition.
- Alternative considered: per-screen rendered tooltips — rejected (positioning math duplicated, overlay fights, late-mounted targets hard to handle).

### D3. Auto-positioning via pure geometry (`lib/onboarding/placement.ts`)
`computePopupPosition(targetRect, popupSize, screenSize, preferred)` returns `{x, y, placement}`. It tries the preferred edge → its opposite → the other axis, picks the first that fits, and if nothing fits picks the edge with the most free space; the result is always clamped inside the screen with a margin.

- Rationale: pure function = trivially unit-testable; clamping guarantees the popup is never off-screen on any device/orientation.
- Alternative considered: third-party tooltip lib (e.g. react-native-tooltip) — rejected (new dep, less control over spotlight + tour steps).

### D4. Measure targets via `measureInWindow` with a safety timeout
`measureRef` calls `ref.current.measureInWindow(...)`; a zero-size rect is treated as "not measurable" and a 250ms safety timer resolves `null` when the host never invokes the callback (jest's View mock never does, and a detached view on device won't either). A null rect falls back to a bottom-center popup so the message is never lost.

- Rationale: `measureInWindow` is the only RN API giving window coords without native code. The timeout converts a hang into graceful fallback (also testable with fake timers).
- Alternative considered: `ref.measure` — same family, but `measureInWindow` matches the overlay's absolute-fill coordinate space directly.

### D5. Trigger rules (seen-once, resume, skip-is-final)
- Tooltips: `hasSeenTooltip` short-circuits repeat shows; `markTooltipSeen` is written *before* showing so a crashed/mid-await flow can't re-spam.
- Tours: `isTourCompleted` blocks re-runs; `startTour` resumes at `firstIncompleteStep` (per-step `step:<id>:done` keys); `nextStep` marks the current step done, then advances or marks the whole tour completed on the last step; `skipTour` marks the tour completed (Skip is final — it never nags again).
- Race guard: every async handler captures the current `view` and re-checks `viewRef.current` after each `await` before calling `setView`, so Skip/Dismiss during an in-flight step-advance is authoritative and can't resurrect the overlay.

- Rationale: persist-before-show and resume semantics match "show once, never spam, don't restart interrupted tours".
- Alternative considered: session-only flags — rejected (would re-show on every launch).

### D6. Optional-provider degradation (`useOptionalOnboarding`)
`Tooltip` and `DisabledStateHelper` use `useOptionalOnboarding()` (returns null without a provider) and render as plain passthrough wrappers in that case, so they can't crash screens rendered standalone (e.g. unit tests of `PromptForm`). `useOnboardingTarget` also tolerates a missing provider.

- Rationale: these are optional enhancements — a form test or an un-wrapped screen must not require the whole onboarding tree.
- Alternative considered: requiring the provider everywhere — rejected (broke existing standalone component tests; fragile coupling).

### D7. Spotlight hole via four edge rectangles
RN has no native hole-punch, so `SpotlightDim` dims the screen with four absolutely-positioned semi-transparent rectangles around the target rect (top/bottom/left/right strips) plus a white highlight border. In spotlight mode the strips are `pointerEvents="none"`; non-spotlight tooltips use a full-dim `Pressable` that dismisses on tap.

- Rationale: standard RN technique, no deps. Dismiss-on-tap for light tooltips matches "Got it" expectations; spotlight tours use explicit Next/Skip buttons.

## Risks / Trade-offs

- [measureInWindow callback never fires (jest mock / detached view)] → Mitigation: 250ms timeout resolves null; overlay falls back to bottom-center popup; tests use fake timers.
- [onLayout never fires under react-test-renderer] → Mitigation: popup renders with an estimated size immediately and `onLayout` corrects it on device (one-frame jump, acceptable).
- [Spotlight background stays interactive] → Mitigation: intentional — tours are informational; the popup has explicit Skip/Done. Screen-reader users get `accessibilityViewIsModal` on the overlay.
- [Race: Skip pressed while Next's async step-advance in flight] → Mitigation: re-check `viewRef.current` after every await before `setView`.
- [Tour/other overlay shown on first launch before tabs measured] → Mitigation: tour starts after an 800ms delay and targets fall back to bottom-center if unmeasurable.

## Migration Plan

- No schema change: only new namespaced `app_meta` keys are written (tooltip/tour seen flags). No migration SQL needed.
- Rollback: removing the provider + overlay from the root layout disables all guidance instantly; the extra app_meta keys are inert.
- New users: first launch after install shows the 3-step tour once. Existing installs: no tour (fresh key space), but new tooltips (e.g. Import badge) still appear once.

## Open Questions

None that would change the specs, approach, or task breakdown. Visual details (copy strings, exact popup width, highlight color) are left to implementation and polish.
