## Why

Prompts already carry an optional `category` (single value) and `tags` (array), but the UI treats them as dead metadata: the editor only free-types them (users can't discover or reuse values they've typed before), and search ignores them entirely (a query for "writing" misses a prompt tagged `writing` unless the word happens to appear in title/content). This change makes categories/tags first-class: reusable in the editor, searchable, and filterable on the Home tab.

## What Changes

- **Editor suggestion chips (`PromptForm`)**: existing categories and tags from the library are offered as tap-to-select chips under their fields. Typing a new value still works — chips only *suggest*, they never constrain. Chips self-filter (a category already chosen, or a tag already present in the tags input, is hidden).
- **Search index includes category + tags**: the normalized search field is now `title + content + category + tags`, so a keyword that only appears in a category or tag matches. A schema v2 migration reindexes existing rows (SQLite `db/migrate.ts` + web `initWebStorage`) so old data is searchable identically.
- **Home category filter chips**: a horizontal chip row above the All Prompts list (All + every existing category). Selecting a category narrows the list; tap-again clears. The filter composes with the search bar (query + category both narrow). A filter with zero matches shows a dedicated "No prompts in this category" empty state instead of the create/import CTA.
- **Category/tag listing API**: `listCategories()`/`listTags()` added to the shared `PromptRepository` interface and both backends (SQLite + localStorage), sorted case-insensitively, distinct and non-empty.

## Capabilities

### New Capabilities

- `category-tag-search`: category/tag keywords searchable through the existing search; editor suggestion chips for existing values; Home filter chips composing with search.

### Modified Capabilities

- `search` (MVP): the normalized index source expands from `title + content` to `title + content + category + tags`; matching semantics and ranking are unchanged.

## Impact

- **Modified files**: `db/promptRepository.shared.ts` (`computeSearchNormalized` signature + interface), `db/promptRepository.sqlite.ts` + `.web.ts` (`listCategories`/`listTags`, search row builders), `db/promptRepository.ts` (exports), `db/migrate.ts` (v2 reindex), `db/init.ts` (web migration trigger), `components/PromptForm.tsx` (suggestion chips), `components/PromptList.tsx` (unchanged), `app/(tabs)/index.tsx` (filter chips + empty state), `hooks/usePrompts.ts` (`categoryFilter`/`categories`/`filteredAll`), `app/(tabs)/_layout.tsx` (unchanged — provider already passes new state through).
- **New files**: `components/CategoryFilter.tsx`.
- **Migration**: schema v2 reindex (`search_normalized` recomputed per row) — idempotent, no data loss, no new columns.
- **Tests**: new/updated suites (real-SQLite ×2, web repo ×3, usePrompts ×3, PromptForm ×3, CategoryFilter ×4).
- **No new dependencies** — pure existing stack.
