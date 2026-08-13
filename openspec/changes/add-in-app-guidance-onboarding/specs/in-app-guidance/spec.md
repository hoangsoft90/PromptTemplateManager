## Purpose

Teach first-time users the core Search → Fill → Copy loop and flag/explain UI affordances through a lightweight in-app guidance layer: one-time tooltips pointing at target elements, sequential spotlight tours with Skip/Next/Done, and on-demand explanations for disabled controls. All "already seen / completed" state persists locally so guidance shows once per install and never nags on repeat actions.

## ADDED Requirements

### Requirement: Tooltips show once per install and point at a target element
The system SHALL provide a tooltip that appears attached to a designated target element with a message (and optional title). A tooltip with a given stable id SHALL be shown at most once per install — repeat triggers (re-mounts, re-taps, tab switches) SHALL be silent no-ops. Tooltip seen-state SHALL persist in on-device storage.

#### Scenario: first trigger shows the tooltip
- **WHEN** a tooltip is triggered for the first time
- **THEN** a popup with the message appears near the target element

#### Scenario: repeat trigger is silent
- **WHEN** the same tooltip id is triggered again later in the same install
- **THEN** no tooltip is shown

### Requirement: Spotlight emphasis for tooltips
The system SHALL support a spotlight mode that dims the rest of the screen and highlights the target element while the tooltip popup is shown.

#### Scenario: spotlight tooltip highlights its target
- **WHEN** a tooltip is configured with spotlight emphasis
- **THEN** the screen is dimmed with the target element highlighted and the popup shown

### Requirement: Sequential tours with resume, Skip, and Done
The system SHALL support multi-step tours: a sequence of steps, each highlighting a target element with a title and message. Tours SHALL run at most once per install; after completion they SHALL NOT start again. An interrupted tour (app closed or navigated away mid-tour) SHALL resume at the first unfinished step rather than restarting. The tour popup SHALL offer Skip and Next controls, with Done on the final step; Skip SHALL permanently mark the tour as completed so it never nags again.

#### Scenario: tour walks through all steps
- **WHEN** a user starts a new tour and taps Next through every step
- **THEN** the tour advances step by step and closes after the last step, and re-triggering it later shows nothing

#### Scenario: tour resumes at the unfinished step
- **WHEN** a tour is interrupted after completing some steps and is triggered again
- **THEN** it resumes at the first step not yet completed

#### Scenario: Skip ends the tour permanently
- **WHEN** a user taps Skip during a tour
- **THEN** the tour closes and is marked completed, and will not start again

### Requirement: Disabled controls explain themselves on tap
The system SHALL let any disabled control be wrapped so that tapping it shows a short explanation of why it is disabled and what unlocks it, instead of doing nothing. When the control is enabled, the wrapper SHALL pass taps through normally.

#### Scenario: tapping a disabled control shows the reason
- **WHEN** a user taps a disabled control wrapped by this helper
- **THEN** a popup explains the reason and the unlock condition

#### Scenario: enabled control behaves normally
- **WHEN** the wrapped control is enabled and tapped
- **THEN** the tap reaches the control and no explanation is shown

### Requirement: Popup positioning is automatic and stays on-screen
The system SHALL position guidance popups relative to their target element automatically, preferring a configured edge and flipping to another edge when there is not enough room. The popup SHALL remain fully inside the screen on any device size and orientation. When the target element cannot be measured (not yet laid out, or measurement unavailable), the popup SHALL still appear in a safe default position so the message is never lost.

#### Scenario: popup flips when the preferred edge has no room
- **WHEN** the preferred edge of a target has insufficient space
- **THEN** the popup appears on an edge that fits and stays fully visible

#### Scenario: unmeasurable target uses a default position
- **WHEN** the target element cannot be measured
- **THEN** the popup appears centered in a safe area of the screen

### Requirement: Guidance never blocks or breaks the app
The guidance layer SHALL be optional and isolated: if the provider is not mounted, guidance-wrapping components SHALL render their children unchanged without errors. Any guidance failure (measurement, storage, rendering) SHALL NOT crash the app or affect the wrapped content.

#### Scenario: guidance components work without a provider
- **WHEN** a screen containing guidance-wrapped components is rendered outside the guidance provider
- **THEN** the screen renders normally and the wrappers pass their children through

### Requirement: New-feature badge
The system SHALL provide a visual "New" badge component that can be attached to icons or buttons to flag newly added features.

#### Scenario: badge is shown next to an element
- **WHEN** a UI element is configured with a new-feature badge
- **THEN** a "New" label is rendered adjacent to the element
