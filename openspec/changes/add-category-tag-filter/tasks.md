## 1. Data Layer

- [x] 1.1 Extend `computeSearchNormalized` to include category + tags; update `buildCreateRow`/`buildImportRow`/`updatePrompt` to use it (single shared implementation)
- [x] 1.2 Add `listCategories()`/`listTags()` to the shared `PromptRepository` interface
- [x] 1.3 Implement `listCategories`/`listTags` in `db/promptRepository.sqlite.ts` (DISTINCT category `COLLATE NOCASE`; tags deduped in JS — no JSON1 reliance)
- [x] 1.4 Implement `listCategories`/`listTags` in `db/promptRepository.web.ts` + export both via `db/promptRepository.ts`
- [x] 1.5 Migration v2: reindex `search_normalized` for existing rows — `db/migrate.ts` (SQLite, per-row UPDATE, idempotent) + `initWebStorage` (web, `WEB_SCHEMA_VERSION = 2`)

## 2. Editor Suggestions

- [x] 2.1 Load existing categories/tags on `PromptForm` mount (best-effort — failures never block the editor)
- [x] 2.2 Suggestion chips under Category + Tags fields: tap-to-select, self-filtering (hide category already chosen / tags already present), capped at 8 chips

## 3. Home Filter

- [x] 3.1 Create `components/CategoryFilter.tsx` (horizontal chips: All + categories; tap-again clears; renders nothing with no categories)
- [x] 3.2 Add `categoryFilter`/`categories`/`filteredAll` state to `usePrompts`; compose filter with search results; dedicated empty state for a filter with no matches
- [x] 3.3 Wire chips into `app/(tabs)/index.tsx`

## 4. Tests & Validation

- [x] 4.1 Tests: real-SQLite ×2 (category/tag search + listings), web repo ×3 (surface + listings + category/tag search), usePrompts ×3 (categories/filteredAll, compose with search, clear filter), PromptForm ×3 (chips select, chips hide chosen, failure safe), CategoryFilter ×4
- [x] 4.2 Validate: `tsc --noEmit` clean · full Jest suite passes (196 tests) · code review applied
