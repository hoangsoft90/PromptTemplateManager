## Context

See proposal.md — Why for motivation. Built on the shipped MVP (Expo/React Native, expo-sqlite + localStorage web backend). The data model already has `category` (single string) and `tags` (JSON array) per prompt; the search index (`search_normalized`) is computed in exactly one place — `db/promptRepository.shared.ts` `computeSearchNormalized` — and consumed by both backends, which makes expanding the index a one-line semantic change plus a reindex migration.

## Goals / Non-Goals

**Goals:**
- Make categories/tags findable via the existing search box (index expansion, no new search UI).
- Let users reuse existing categories/tags in the editor via suggestion chips without constraining free input.
- Add a lightweight category filter on the Home tab that composes with search.
- Reindex existing data so old prompts are searchable identically (no silent gaps after upgrade).

**Non-Goals (design-level):**
- No tag filter on Home (only category — tags remain search keywords only; keeps the chip row short).
- No multi-select filtering, no "exclude category", no category management screen.
- No schema change beyond recomputing an existing column; no new columns, no export-format change.

## Decisions

### D1. Expand the existing normalized index (no new column, no FTS)
`computeSearchNormalized(title, content, category, tags)` joins all four into one normalized string — same normalization/ranking pipeline as before. The `LIKE '%q%' ESCAPE` search (SQLite) and `String.includes` (web) are unchanged.

- Rationale: MVP design deliberately rejected FTS5 (unreliable Vietnamese tokenization); at hundreds-to-thousands of rows a full scan on an expanded index is still <50ms. Reusing the single shared function keeps both backends and the migration identical by construction.
- Alternative considered: a separate `category_tags_normalized` column queried with OR — rejected (two indexes to maintain, ranking gets messy).

### D2. Migration v2 = recompute, idempotent, no data loss
SQLite: `db/migrate.ts` adds version 2 — read every row, recompute `search_normalized` from title/content/category/tags, `UPDATE ... WHERE id`. Web: `initWebStorage` bumps `WEB_SCHEMA_VERSION` to 2 and recomputes stored rows. Both run before any prompt is read.

- Rationale: the column already exists with a known shape; reindexing is the smallest correct change. Idempotent so a partial failure can re-run safely.
- Alternative considered: lazy reindex on first search — rejected (first search would silently miss old rows; eager migration is a few ms at this scale).

### D3. Suggestion chips are advisory, never constraining
`PromptForm` loads `listCategories()`/`listTags()` once on mount (best-effort — failures swallowed). Category chips show values matching the typed prefix (or all while empty), minus the exact value chosen; tag chips show values not already present in the comma-separated input (case-insensitive set). Tapping a tag chip appends `, <tag>`. Cap 8 chips per row.

- Rationale: chips must never block free typing (users still invent new values); self-filtering avoids redundant options. Best-effort loading means the editor never depends on the listings query.
- Alternative considered: a picker/dropdown replacing the text input — rejected (heavier, and free-typing is the existing UX).

### D4. Category filter lives in `usePrompts` state, composed with search
`usePrompts` adds `categoryFilter` ('' = all), `categories` (from `listCategories()` in `reload`), and `filteredAll` (memo: `all` narrowed). When a query is active, search results are filtered in JS by `categoryFilter` after `searchPrompts` (repo signature untouched). The Home tab renders `CategoryFilter` chips above `PromptList` and a dedicated "No prompts in this category" empty state when a filter has no matches.

- Rationale: single source of truth for the tab's visible list; filtering in JS at this scale avoids complicating the SQL; the existing empty-library CTA must not masquerade as a filtered-empty state.
- Alternative considered: category filter inside the SQL query (`WHERE category = ?`) — rejected (would fork the search SQL path for a feature that's equally correct in JS).

### D5. No new dependencies
Pure React Native components + existing repository layer. No storage, navigation, or UI libraries added.

## Risks / Trade-offs

- [Migration v2 runs on every existing install] → Mitigation: recompute is a few ms per row; idempotent; no data loss (only `search_normalized` rewritten).
- [Tag dedup/listings cost on huge libraries] → Mitigation: distinct-in-JS is fine at MVP scale; revisit with JSON1/FTS only if the library ever grows orders of magnitude.
- [Filter + search interaction confusion] → Mitigation: the chip row is hidden while searching is *not* the choice — chips stay visible and compose (D4); the filtered-empty state names the active category so the user can clear it.
- [Save button wrapped in DisabledStateHelper previously looked broken] → Mitigation: fixed in this change — the wrapper is layout-only (`submitWrap`), real button styles stay on the inner Pressable.

## Migration Plan

- Schema v2: recompute `search_normalized` per row (SQLite `db/migrate.ts`; web `initWebStorage`). Idempotent, no column changes, no data loss.
- Rollback: reverting the feature keeps the recomputed index (harmless — it is a superset of the old index); no separate rollback migration needed.
- New users: nothing special — rows are built with the expanded index from the start.

## Open Questions

None. Visual details (chip styling, max chip count) are implementation polish already covered by the shipped code and tests.
