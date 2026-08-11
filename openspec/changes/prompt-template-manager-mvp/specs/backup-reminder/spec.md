## Purpose

Gently nudges users to back up their library once it grows, without nagging: a dismissible single-line banner appears after a threshold of prompts when the user has never exported.

## ADDED Requirements

### Requirement: Banner appears after threshold
The system SHALL show a non-blocking, single-line backup reminder banner on the Home screen when the library has at least 5 prompts and the user has never exported.

#### Scenario: banner appears after threshold
- **WHEN** the user has created 5 prompts and has never exported
- **THEN** the backup reminder banner is visible on the Home screen

#### Scenario: banner hidden below threshold
- **WHEN** the library has fewer than 5 prompts
- **THEN** the backup reminder banner is not shown

### Requirement: Banner CTA opens export
The banner SHALL include an "Export now" action that opens the Export flow directly. It SHALL be a banner, never a modal, and SHALL not block usage of the app.

#### Scenario: banner CTA opens export
- **WHEN** the user taps "Export now" on the banner
- **THEN** the Export flow opens directly

### Requirement: Banner dismissal and re-show
The system SHALL let the user dismiss the banner, and SHALL remember the dismissal. If the user still has not exported, the banner SHALL re-appear after a reasonable number of additional prompts are created rather than on every screen visit.

#### Scenario: dismissed banner does not nag immediately
- **WHEN** the user dismisses the banner and has still not exported
- **THEN** the banner does not reappear on the next screen visits within the same session

### Requirement: Banner disappears after export
Once the user has exported, the banner SHALL be hidden and SHALL not reappear.

#### Scenario: banner disappears after export
- **WHEN** the user completes an export
- **THEN** the banner is hidden and has_exported is set to true, and it does not reappear
