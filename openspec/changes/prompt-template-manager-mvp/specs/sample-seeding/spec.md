## Purpose

On first launch, seed the library with 8 sample prompt templates that demonstrate the variable engine's capabilities so a new user immediately understands the product without instructions.

## ADDED Requirements

### Requirement: Seed samples on first launch
On the first app launch, the system SHALL insert exactly 8 sample prompts (Code Reviewer, Email Writer, Summarizer, Meeting Notes → Action Items, Research Assistant, Prompt Refiner, Image Prompt Generator, Translate & Adapt). Seeding SHALL happen only once and SHALL be guarded by a persisted flag so it never runs again.

#### Scenario: first launch shows samples
- **WHEN** the app is launched for the first time
- **THEN** the library contains the 8 sample prompts and the flag is set so seeding does not repeat

#### Scenario: subsequent launches do not reseed
- **WHEN** the app is launched after the samples were already seeded
- **THEN** no additional sample prompts are inserted

### Requirement: Samples use normal creation path
Sample prompts SHALL be inserted through the same creation path as user-created prompts, with search normalization computed, so they behave identically to user prompts in search, fill, and usage tracking.

#### Scenario: samples are searchable and fillable
- **WHEN** a user searches for a term inside a sample prompt or fills its variables
- **THEN** the sample behaves exactly like a user-created prompt

### Requirement: Samples demonstrate engine capabilities
The seeded content SHALL collectively demonstrate: the textarea heuristic, multiple short variables, a self-referential (meta) template, and a language-target variable.

#### Scenario: samples exercise distinct features
- **WHEN** the 8 samples are seeded
- **THEN** the set includes prompts that exercise textarea fields, multiple variables, a meta/self-referential template, and a target-language variable
