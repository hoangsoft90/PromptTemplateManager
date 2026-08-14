## Purpose

Make prompt categories and tags first-class metadata: searchable through the existing search box, reusable in the editor via suggestion chips, and filterable on the Home tab — so users can find prompts by the concepts they organized them under, not just by title/content words.

## ADDED Requirements

### Requirement: Search index includes category and tags
The normalized search field for each prompt SHALL be the concatenation of title, content, category, and all tags, so a query matching only a category or a tag (never appearing in title/content) still finds the prompt. Matching semantics, normalization (diacritic-insensitive), and result ranking SHALL remain exactly as specified by the MVP `search` capability.

#### Scenario: category keyword matches
- **WHEN** a prompt has category "Writing" and the user searches "writing"
- **THEN** the prompt appears in the search results

#### Scenario: tag keyword matches
- **WHEN** a prompt has a tag "sales" (absent from title and content) and the user searches "sales"
- **THEN** the prompt appears in the search results

### Requirement: Existing rows are reindexed on migration
The system SHALL recompute `search_normalized` for every stored prompt (category + tags included) as part of a schema migration, so data created before this feature is searchable identically to newly created or edited prompts. The migration SHALL be idempotent and SHALL NOT lose or alter any other prompt data.

#### Scenario: old prompt becomes tag-searchable after upgrade
- **WHEN** a prompt was created before the upgrade with a tag "outreach"
- **THEN** after the migration runs, searching "outreach" finds that prompt

### Requirement: Category and tag listings
The data-access surface SHALL expose `listCategories()` and `listTags()` returning distinct, non-empty values across all prompts, sorted case-insensitively. Categories come from the `category` field; tags come from the union of every prompt's tag array.

#### Scenario: listings return distinct sorted values
- **WHEN** prompts have categories ["Writing", "dev", "Writing"] and tags ["email", "email", "Work"]
- **THEN** `listCategories()` returns ["dev", "Writing"] and `listTags()` returns ["email", "Work"]

### Requirement: Editor suggestion chips for existing categories and tags
The prompt editor SHALL offer tap-to-select chips under the Category and Tags fields, populated from `listCategories()`/`listTags()`. Selecting a chip fills that value in (for tags, appends to the comma-separated input). Free-typing a new value SHALL remain fully supported — chips SHALL only suggest and SHALL hide values already present in the field (a category already chosen, a tag already in the tags input). A failure to load suggestions SHALL NOT block or break the editor.

#### Scenario: tap a chip to fill the value
- **WHEN** the Category field is empty and an existing category "Writing" is offered as a chip
- **THEN** tapping the chip sets the Category field to "Writing"

#### Scenario: chips hide already-chosen values
- **WHEN** the tags input already contains "email"
- **THEN** no chip offers "email" again, while other tags are still offered

#### Scenario: suggestion failure never blocks saving
- **WHEN** loading suggestions fails
- **THEN** the editor renders and saves normally with no chips

### Requirement: Home tab category filter chips
The All Prompts tab SHALL show a horizontal row of filter chips: "All" plus every existing category. Selecting a category SHALL narrow the displayed prompts to that exact category; tapping the active chip SHALL clear the filter back to All. The filter SHALL compose with the search bar (a search query and an active category both narrow the results). The row SHALL not render at all when the library has no categories. An active category with zero matching prompts SHALL show a "no prompts in this category" empty state rather than the create/import empty-library CTA.

#### Scenario: selecting a category narrows the list
- **WHEN** the user taps a category chip
- **THEN** only prompts with that category are shown

#### Scenario: tapping the active chip clears the filter
- **WHEN** the active category chip is tapped again
- **THEN** all prompts are shown again

#### Scenario: filter composes with search
- **WHEN** a search query is active and a category is selected
- **THEN** results are the intersection of the query matches and the selected category

#### Scenario: no categories renders no chips
- **WHEN** no prompt has a category
- **THEN** the filter row is not rendered
