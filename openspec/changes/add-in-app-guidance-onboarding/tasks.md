## 1. Core Library

- [x] 1.1 Create `lib/onboarding/types.ts`: MetaStore, OnboardingStep, TooltipSpec, DisabledHelp, OnboardingView (discriminated union tooltip/tour/help)
- [x] 1.2 Create `lib/onboarding/placement.ts`: computePopupPosition (preferred edge → opposite → other axis → max-space fallback, always clamped to screen) + placement unit tests
- [x] 1.3 Create `lib/onboarding/onboardingStorage.ts`: hasSeenTooltip/markTooltipSeen, isTourCompleted/markTourCompleted, isStepCompleted/markStepCompleted, firstIncompleteStep (namespaced app_meta keys) + unit tests
- [x] 1.4 Create `lib/onboarding/OnboardingContext.tsx`: provider with single view state, target registry (register/unregister), showTooltip/startTour/nextStep/skipTour/showDisabledHelp/dismiss; measureRef via measureInWindow with 250ms safety timeout; race guards (re-check viewRef.current after awaits); useOnboardingTarget + useOptionalOnboarding hooks
- [x] 1.5 Create `lib/onboarding/OnboardingOverlay.tsx`: dim + spotlight hole (4 edge rects + highlight border), auto-positioned popup with arrow, bottom-center fallback when target unmeasurable, Skip/Next/Done/Got-it actions, accessibilityViewIsModal

## 2. UI Components

- [x] 2.1 Create `components/FeatureBadge.tsx` ("New" dot/label badge)
- [x] 2.2 Create `components/Tooltip.tsx` (wraps element, registers target, one-time tooltip, optional spotlight)
- [x] 2.3 Create `components/DisabledStateHelper.tsx` (invisible tap-interceptor overlay over disabled controls → showDisabledHelp; passes through when enabled; degrades to passthrough without provider)

## 3. App Wiring

- [x] 3.1 Mount `OnboardingProvider` in root `app/_layout.tsx`
- [x] 3.2 Register first-run tour targets + start 3-step tour (Search → FAB → Tabs) in `app/(tabs)/_layout.tsx` (once per install, 800ms delay)
- [x] 3.3 Add FeatureBadge + one-time Tooltip demo on Settings Import row (`app/settings/index.tsx`)
- [x] 3.4 Wrap editor Save button with DisabledStateHelper in `components/PromptForm.tsx`

## 4. Tests & Validation

- [x] 4.1 Integration tests (`__tests__/onboarding.test.tsx`): tooltip seen-once rule, tour walk/Skip/resume, DisabledStateHelper, Tooltip component (fake timers + in-memory app_meta mock)
- [x] 4.2 Storage tests (`__tests__/onboardingStorage.test.ts`) + placement tests (`__tests__/placement.test.ts`) + FeatureBadge test (`__tests__/FeatureBadge.test.tsx`)
- [x] 4.3 Validate: `tsc --noEmit` clean · full Jest suite passes (171 tests) · code review applied (race-condition guard, clearTimeout, accessibility, optional-provider degradation)
