## Purpose

Tracks how often and how recently each prompt is reused so Recently Used and Most-Used ordering work, and maintains local NSM-proxy counters for a future analytics layer.

## ADDED Requirements

### Requirement: Fill & Copy records usage
When the user completes a Fill & Copy (all variables valid, prompt copied from the fill form), the system SHALL increment `usage_count`, set `last_used_at` to now, and increment the strict NSM fill-copy counter. `updated_at` SHALL NOT change.

#### Scenario: fill and copy updates recent list and NSM
- **WHEN** a prompt with variables is filled validly and "Copy Final Prompt" is tapped
- **THEN** last_used_at is set to now
- **AND** usage_count is incremented by 1
- **AND** the NSM fill-copy counter is incremented by 1
- **AND** updated_at is not changed

### Requirement: Quick Copy records usage without NSM
When the user copies a raw template directly from a card or detail screen (Quick Copy), the system SHALL increment `usage_count`, set `last_used_at` to now, and increment the informational quick-copy counter. The strict NSM fill-copy counter SHALL NOT be incremented.

#### Scenario: quick copy updates recent list
- **WHEN** the user taps Quick Copy on a never-used prompt's card
- **THEN** last_used_at is set to now
- **AND** usage_count is incremented by 1
- **AND** the prompt appears at the top of "Recently Used"
- **AND** the strict NSM fill-copy counter is NOT incremented

### Requirement: Editing does not alter usage data
Editing a prompt's title or content SHALL NOT change its `usage_count` or `last_used_at`, but SHALL update `updated_at` and recompute the search-normalized text.

#### Scenario: edit preserves usage counters
- **WHEN** the user edits a prompt's title or content and saves
- **THEN** usage_count and last_used_at remain unchanged
- **AND** updated_at is refreshed
- **AND** search normalization reflects the new content

### Requirement: Import does not count as usage
Records created by import SHALL start with `usage_count` 0, `last_used_at` null, and SHALL NOT touch NSM counters.

#### Scenario: imported prompt starts unused
- **WHEN** a prompt is created through import
- **THEN** its usage_count is 0 and last_used_at is null
- **AND** no NSM counter is incremented

### Requirement: Recently Used excludes never-used
The Recently Used section SHALL include only prompts with a non-null `last_used_at`, ordered most recent first.

#### Scenario: never-used prompt absent from recent
- **WHEN** the Recently Used section is built and a prompt has never been used
- **THEN** that prompt does not appear in the section
