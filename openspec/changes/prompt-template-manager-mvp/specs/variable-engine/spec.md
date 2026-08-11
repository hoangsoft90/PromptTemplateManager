## Purpose

The `{{variable}}` template engine: extracts variables from prompt content, renders filled templates, and drives the Fill & Copy flow so users can reuse a prompt with different inputs in seconds.

## ADDED Requirements

### Requirement: Variable extraction
The system SHALL detect variables written as `{{name}}` in prompt content using the pattern of a letter followed by letters, digits, or underscores inside double curly braces. Detection MUST be case-insensitive for deduplication: `{{Tone}}`, `{{tone}}`, and `{{TONE}}` count as the same variable, displayed with the first-seen casing. The extracted variable list MUST preserve order of first appearance in content.

#### Scenario: case-insensitive deduplication
- **WHEN** content is "Hi {{Name}}, nice to meet you {{name}}"
- **THEN** exactly 1 variable is extracted with the label "Name"

#### Scenario: order of appearance
- **WHEN** content is "{{recipient}} ... {{topic}} ... {{tone}}"
- **THEN** the extracted variables are returned in order [recipient, topic, tone]

#### Scenario: textarea heuristic
- **WHEN** a variable name contains a hint word such as code, content, body, text, description, context, prompt, message, notes, or input
- **THEN** the variable is rendered as a multiline textarea field instead of a single-line text field

#### Scenario: variables are always derived
- **WHEN** a prompt is displayed or edited
- **THEN** its variables are computed from the current content at render time and are never read from stored data

### Requirement: Render prompt with values
The system SHALL substitute variable values into content at render time. Each variable name matches case-insensitively, and a single value replaces every occurrence of that variable. Escaped variables written as `\{{name}}` SHALL render as the literal text `{{name}}` (backslash stripped, not substituted) in both preview and final copied text.

#### Scenario: same name reused renders same value
- **WHEN** content is "{{tone}} email... end with a {{tone}} closing" and the user enters "Formal" for tone
- **THEN** both occurrences are replaced with "Formal"

#### Scenario: escape syntax
- **WHEN** content contains "\{{variable}}" and variables are extracted
- **THEN** no variable is detected for that occurrence
- **AND** when rendered, the output contains the literal text "{{variable}}"

### Requirement: Fill & Copy validation
When the user taps the copy action on a fill form, the system SHALL require every variable to have a non-empty value. If any variable is empty, the system SHALL highlight that field, block the copy, and not update usage counters.

#### Scenario: required validation blocks copy
- **WHEN** a fill form has 1 empty required variable and the user taps "Copy Final Prompt"
- **THEN** the empty field is highlighted as an error
- **AND** the clipboard is not modified
- **AND** usage_count is not incremented

### Requirement: Zero-variable fast path
For prompts whose content contains no `{{...}}` variables, the system SHALL NOT show a form screen. The primary copy action SHALL copy the raw content directly and record usage.

#### Scenario: zero-variable flow skips the form
- **WHEN** a prompt has no `{{}}` syntax in its content and the user taps the primary copy action
- **THEN** the content is copied directly with no form screen shown
- **AND** usage_count and last_used_at are updated

### Requirement: Fill form and live preview
The system SHALL present a fill form with one field per variable in order of appearance, and SHALL show a live read-only preview of the rendered prompt that updates as the user types.

#### Scenario: live preview updates on keystroke
- **WHEN** the user types a value into a variable field
- **THEN** the preview pane updates to show the rendered prompt with that value substituted

### Requirement: Unclosed variable soft warning
The system SHALL detect an unfinished variable in the editor (opening `{{` without a closing `}}`) and SHALL show a non-blocking inline hint. The warning MUST NOT block saving.

#### Scenario: soft warning for unclosed variable
- **WHEN** the editor content contains "{{name" with no closing "}}"
- **THEN** a non-blocking inline hint is shown and the Save action still works
