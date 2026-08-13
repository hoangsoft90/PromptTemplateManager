## Why

New users of Prompt Template Manager hit the Search → Fill → Copy loop with no guidance, and two proven onboarding problems remain unsolved: (1) users don't know what a `{{variable}}` template is or where the FAB/search live, and (2) disabled controls (e.g. Save without title/content) give zero feedback — tapping them does nothing and users don't know why. A lightweight in-app guidance layer teaches the core loop once per install without nagging, and explains disabled states on demand.

## What Changes

- **In-app guidance system** (`lib/onboarding/`): a single root overlay (`OnboardingOverlay`) with dim + spotlight-hole highlighting, an auto-positioning popup (auto-flips edges, always clamped on-screen), and a provider-driven state machine (`OnboardingContext`).
- **FeatureBadge component**: a "New" dot/label badge that can be attached to any icon or button to flag new features.
- **Tooltip component**: wraps any element, registers it as a target, and shows a one-time tooltip pointing at it (optional spotlight emphasis).
- **DisabledStateHelper component**: wraps a disabled control with an invisible tap-interceptor; tapping explains "why is this disabled?" + what unlocks it, instead of dead silence.
- **Persistent trigger rules**: tooltips and tours persist "already seen/completed" state in the existing `app_meta` table (no new storage dependency). Tooltips show once per install; tours run once, resume at the first unfinished step, and Skip/Done terminate them permanently.
- **First-run tour wiring**: a 3-step tour (Search → FAB → Tabs) starts once shortly after the Home tab mounts for new users.
- **Demo wiring**: FeatureBadge + Tooltip on the Settings Import row; DisabledStateHelper around the editor's Save button.

## Capabilities

### New Capabilities

- `in-app-guidance`: one-time tooltips, sequential tours with resume/skip, disabled-state explanations, spotlight highlighting, and auto-positioned popups with screen clamping.

### Modified Capabilities

None — this is additive UI guidance; no existing spec's behavior changes.

## Impact

- **New directories**: `lib/onboarding/` (types, placement geometry, storage abstraction, context provider, overlay).
- **New components**: `components/FeatureBadge.tsx`, `components/Tooltip.tsx`, `components/DisabledStateHelper.tsx`.
- **Modified files**: `app/_layout.tsx` (root `OnboardingProvider`), `app/(tabs)/_layout.tsx` (first-run tour + target registration), `app/settings/index.tsx` (badge + tooltip demo), `components/PromptForm.tsx` (Save wrapped in `DisabledStateHelper`).
- **Storage**: reads/writes `app_meta` via the existing `db/promptRepository` (`getAppMeta`/`setAppMeta`) — no AsyncStorage/MMKV.
- **Tests**: new unit/integration suites (`__tests__/onboarding*.test.ts`, `placement.test.ts`, `FeatureBadge.test.tsx`).
- **No new dependencies** — pure React Native + existing stack.
