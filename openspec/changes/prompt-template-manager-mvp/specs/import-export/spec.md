## Purpose

Data ownership: export the library to a portable JSON file and restore it on any device via import, with clear conflict resolution and a preview step so nothing is silently dropped.

## ADDED Requirements

### Requirement: Export file format
The system SHALL export prompts to a JSON file with format "prompt-template-manager", version 1, an exportedAt timestamp, and the prompt list. Each exported record SHALL contain only: id, title, content, category, tags, isFavorite. Derived or local-only fields (usage_count, last_used_at, search_normalized, created_at, updated_at) SHALL NEVER be exported.

#### Scenario: export excludes derived fields
- **WHEN** a prompt is exported
- **THEN** its JSON record contains no usage_count, last_used_at, search_normalized, created_at, or updated_at fields

#### Scenario: export file structure
- **WHEN** the user exports the library
- **THEN** a JSON file is produced containing format "prompt-template-manager", version 1, and the prompt records

### Requirement: Export bookkeeping
After a successful export, the system SHALL record that the user has exported (has_exported), and SHALL dismiss the backup reminder banner if visible.

#### Scenario: export marks has_exported
- **WHEN** an export completes successfully
- **THEN** has_exported is set to true
- **AND** the backup reminder banner is hidden

### Requirement: Import validation
The system SHALL validate an import file before processing: the top-level format MUST equal "prompt-template-manager" and the version MUST be supported. A wrong file type SHALL be rejected with a clear error message and no records processed.

#### Scenario: reject wrong file type
- **WHEN** the user picks a file whose format is not "prompt-template-manager"
- **THEN** import is rejected with a clear error and no records are inserted

### Requirement: Import conflict resolution
For each incoming record, the system SHALL classify it in this order: (1) id exists and content identical → skip as duplicate; (2) id exists and content differs → import as a new row with a freshly generated id; (3) id absent but identical content exists elsewhere → import anyway (duplicates allowed); (4) record missing title or content, or is malformed → mark invalid with a reason, never insert.

#### Scenario: duplicate id + identical content is skipped
- **WHEN** importing a record whose id exists in the library and whose content is identical to the existing prompt
- **THEN** the record is classified as skipped (duplicate) and not inserted

#### Scenario: duplicate id + different content gets new id
- **WHEN** importing a record whose id exists but whose content differs from the existing prompt
- **THEN** a new row is inserted with a freshly generated id, leaving the original untouched

#### Scenario: identical content with new id is imported
- **WHEN** importing a record whose id does not exist but another row has identical content
- **THEN** the record is imported as a new prompt (duplicates allowed)

#### Scenario: malformed record is reported, not silently dropped
- **WHEN** an import file contains one record missing "content"
- **THEN** the preview shows 1 invalid record with a specific reason
- **AND** that record is not inserted when the user confirms import

### Requirement: Import preview and confirm
The system SHALL show a preview screen summarizing the classification breakdown (new / skipped duplicates / invalid, with expandable reasons for invalid records) and SHALL insert only the "new" records after the user explicitly confirms. On success the system SHALL confirm the number of imported prompts.

#### Scenario: preview shows breakdown before insert
- **WHEN** an import file is parsed and classified
- **THEN** the preview screen shows counts such as "12 new · 3 skipped (duplicate) · 1 invalid" with expandable invalid reasons
- **AND** nothing is inserted until the user taps the confirm action

#### Scenario: re-importing the same file creates no duplicates
- **WHEN** the user re-imports a file that was previously imported into the same library
- **THEN** all records are classified as skipped (duplicate) and no new rows are created
