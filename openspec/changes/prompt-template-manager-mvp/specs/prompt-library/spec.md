## Purpose

Core prompt library: users can create, edit, delete, and favorite personal prompt templates and browse them on the Home screen in Favorites, Recently Used, and All sections.

## ADDED Requirements

### Requirement: Create prompt
The system SHALL let the user create a prompt by providing a title and content. Title and content MUST both be non-empty for the prompt to be saved. On save, the new prompt MUST appear in the library list. Category and tags are optional.

#### Scenario: Create prompt with valid inputs
- **WHEN** the user taps Save in the editor with a non-empty title and non-empty content
- **THEN** a new prompt is persisted and appears in the All Prompts section

#### Scenario: Save blocked when title or content empty
- **WHEN** the user attempts to Save with an empty title or empty content
- **THEN** the Save action is disabled or blocked and no prompt is persisted

### Requirement: Edit prompt
The system SHALL let the user edit the title, content, category, and tags of an existing prompt. Saving an edit MUST update the stored content, and search matching MUST reflect the new content.

#### Scenario: Edit content updates the stored prompt
- **WHEN** the user edits a prompt's content and saves
- **THEN** the stored prompt reflects the new content and appears under the new search terms

### Requirement: Delete prompt
The system SHALL let the user delete a prompt, with a confirmation step before deletion to prevent accidental data loss.

#### Scenario: Delete with confirmation
- **WHEN** the user chooses Delete and confirms in the confirmation dialog
- **THEN** the prompt is permanently removed from the library

#### Scenario: Delete cancelled
- **WHEN** the user chooses Delete and then cancels the confirmation dialog
- **THEN** the prompt remains in the library unchanged

### Requirement: Toggle favorite
The system SHALL let the user mark a prompt as favorite or remove the favorite mark. Favorite prompts MUST be surfaced in a dedicated Favorites section.

#### Scenario: Toggle favorite on
- **WHEN** the user toggles favorite on a prompt
- **THEN** the prompt is marked as favorite and appears in the Favorites section

#### Scenario: Toggle favorite off
- **WHEN** the user toggles favorite off on a favorite prompt
- **THEN** the prompt is no longer marked as favorite and disappears from the Favorites section

### Requirement: Home screen tabs
When no search query is active, the Home screen SHALL present a 3-tab layout: **All Prompts**, **Favorites**, and **Recently Used**. The Favorites tab SHALL show favorite prompts (top 5), the Recently Used tab SHALL show only prompts with a recorded last-used time (top 5, most recent first), and the All Prompts tab SHALL show every prompt (narrowable by category — see the category-tag-search capability).

#### Scenario: Home tabs show favorites, recent, and all
- **WHEN** the Home screen is displayed with no active search
- **THEN** the user can switch between an All Prompts tab, a Favorites tab (up to 5), and a Recently Used tab (up to 5)

#### Scenario: Empty library shows empty state
- **WHEN** the library contains no prompts
- **THEN** the All Prompts tab shows an actionable empty state offering Create and Import

### Requirement: Detail screen actions
The system SHALL provide a Detail screen for a prompt that shows the raw template content and offers edit, delete, favorite toggle, and copy actions.

#### Scenario: Open detail from list
- **WHEN** the user taps a prompt in the list
- **THEN** the Detail screen opens showing the prompt's raw content with edit, delete, and favorite controls
