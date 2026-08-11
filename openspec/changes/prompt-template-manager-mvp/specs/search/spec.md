## Purpose

Vietnamese-aware search: lets users find prompts by typing without diacritics (e.g. "da nang" matches "Đà Nẵng") with relevance-ranked results, replacing the browse sections while a query is active.

## ADDED Requirements

### Requirement: Diacritic-insensitive normalization
The system SHALL normalize searchable text by stripping Unicode tone marks (NFD decomposition), mapping `đ`/`Đ` to `d`/`D`, lowercasing, and trimming. Each prompt MUST store a normalized copy of title + content at create/update time, and user queries MUST be normalized the same way before matching.

#### Scenario: Vietnamese test matrix
- **WHEN** normalizing "Việt", "Đà Nẵng", "Tôi", "Cà phê", "TypeScript"
- **THEN** the results are "viet", "da nang", "toi", "ca phe", "typescript" respectively

#### Scenario: diacritic-insensitive match
- **WHEN** a prompt is titled "Đà Nẵng travel guide" and the user searches "da nang"
- **THEN** the prompt appears in the search results

### Requirement: Substring matching
The system SHALL match prompts whose normalized title-or-content contains the normalized query as a substring.

#### Scenario: partial substring match
- **WHEN** the user types a query that appears in the middle of a prompt's title or content
- **THEN** the prompt appears in the search results

### Requirement: Search result ranking
When a search query is active, results SHALL be ranked in this order: (1) title starts with the query, (2) title contains the query, (3) content contains the query, then by usage count descending, then by most recently used.

#### Scenario: ranking priority
- **WHEN** two prompts match: A (title contains the query) and B (title starts with the query)
- **THEN** B appears before A in the results

### Requirement: Search hides browse sections
While a search query is non-empty, the system SHALL display only ranked search results and SHALL hide the Favorites and Recently Used browse sections.

#### Scenario: search hides browse sections
- **WHEN** a non-empty search query is entered
- **THEN** the Favorites and Recently Used sections are not shown
- **AND** only the ranked search results are displayed
