## Context

See proposal.md — Why for motivation. This is a greenfield Expo (React Native, managed workflow) app with no existing code. The source of truth is `.plan/plan1_implementation_spec.md` v3 (READY_FOR_DEV); PART A decisions are locked and must not be re-opened. The core product loop is **Search → Fill (if needed) → Copy**, and every screen and data write serves it. Data is 100% local; there is no backend, account, or analytics in v1.0.

## Goals / Non-Goals

**Goals:**
- On-device SQLite persistence with a migration scaffold from day 1.
- A `{{variable}}` engine with case-insensitive dedup, order-of-appearance fields, escape syntax, and required-validation that blocks copy.
- Vietnamese diacritic-insensitive search with JS ranking on a small local dataset.
- JSON import/export with an exact file format and a preview/confirm flow.
- Usage tracking that powers Recently Used / Most-Used ordering plus local NSM-proxy counters for a future analytics layer.
- A UX performance target of P50 ≤ 5s / P90 ≤ 8s from template-select to copy-available (excluding user typing time).

**Non-Goals (design-level):**
- No FTS5; leading-wildcard `LIKE` on a full scan is acceptable at MVP scale (<50ms for low thousands of rows).
- No storing a persisted variable list — variables are always derived at render time.
- No cloud, no accounts, no analytics backend, no paywall, no dark mode, no share extension, no Markdown import/export, no tags/categories filter UI.

## Decisions

### D1. Data layer: expo-sqlite + migration scaffold
`expo-sqlite` with `PRAGMA user_version`-driven migrations in `db/migrations/001_init.sql` (future migrations appended as `002_*.sql`). Two tables: `prompts` (with `search_normalized` column, indexes on search/last_used/favorite/usage) and `app_meta` (key/value for flags: `has_exported`, `samples_loaded`, `schema_version`, banner dismissal, NSM counters).

- Rationale: expo-sqlite is the managed-workflow standard; `app_meta` avoids a second storage dependency (no MMKV/AsyncStorage needed).
- Alternative considered: FTS5 — rejected (unreliable Vietnamese tokenization); AsyncStorage/MMKV — unnecessary since `app_meta` covers non-DB prefs.

### D2. Repository as the only data-access surface
All reads/writes go through `db/promptRepository.ts` functions (`createPrompt`, `updatePrompt`, `deletePrompt`, `getPromptById`, `listAll`, `listFavorites`, `listRecentlyUsed`, `searchPrompts`, `toggleFavorite`, `recordUsage`, `bulkInsert`, `countAll`, `hasEverExported`, `markExported`). Screens and hooks never touch SQL directly.

- Update-rule matrix (locked, see PART B3): Fill & Copy → `usage_count +1`, `last_used_at = now`, `updated_at` unchanged, NSM fill-copy counter +1. Quick Copy / 0-var Copy → usage + recent updated but NSM fill-copy counter NOT incremented (informational quick-copy counter +1). Edit → only `updated_at` + `search_normalized` recompute. Import → counters start at 0/null.

### D3. Variable engine in pure functions
`lib/variableEngine.ts` exports `extractVariables(content)`, `renderPrompt(content, values)`, `findUnclosedVariable(content)`. Regex `/{{([a-zA-Z][a-zA-Z0-9_]*)}}/g`; escape syntax `\{{...}}` masked before scanning and un-escaped at render. Textarea heuristic: variable name contains any of `[code, content, body, text, description, context, prompt, message, notes, input]`. Placeholder map for common keys (`language`, `format`, `tone`, `length`, `style`).

- Rationale: pure functions are trivially unit-testable and keep variables derived-from-content (no desync).
- Alternative considered: storing a variable list column — rejected by PART A (desync risk on content edit).

### D4. Search: normalize + LIKE + JS ranking
`lib/normalize.ts` — `normalizeVietnamese`: NFD normalize, strip `[\u0300-\u036f]`, `đ`→`d`, `Đ`→`D`, lowercase, trim. `searchPrompts` runs `WHERE search_normalized LIKE '%' || ? || '%'` (full scan, fine at MVP scale) then ranks in JS: title starts-with > title contains > content contains > `usage_count` DESC > `last_used_at` DESC (nulls last).

- Rationale: simple, correct for Vietnamese; leading-wildcard LIKE can't use the B-tree index but the dataset is tiny. Revisit only past ~50k rows.

### D5. Import/export as pure parse + classify + apply
`lib/importExport.ts`: `buildExportFile` (exact format `{format: "prompt-template-manager", version: 1, exportedAt, prompts[]}` — never export derived fields), `parseImportFile` (validates format/version, rejects wrong file type with clear error), `classifyImport` (4-way conflict table), `applyImport` (bulkInsert only "new" outcomes, returns counts). Flow: pick file → parse → classify → preview screen ("12 new · 3 skipped · 1 invalid" with expandable reasons) → confirm → insert → toast.

### D6. UI: Expo Router file-based routes + shared components
Routes under `app/`: `_layout.tsx` (DB init + migrations + seed), `index.tsx` (Home), `prompt/new.tsx`, `prompt/[id]/index.tsx` (Detail), `prompt/[id]/edit.tsx`, `prompt/[id]/fill.tsx`, `settings/index.tsx`, `settings/import-preview.tsx`. Shared components in `components/` (SearchBar, PromptCard, SectionHeader, VariableField, PreviewPane, EmptyState, BackupReminderBanner, ImportPreviewList, ConfirmDialog, Toast).

Card action logic (locked): variables present → primary "Fill & Copy" (navigates to fill) + secondary Quick-Copy icon button; no variables → single "Copy" button that copies raw content directly (no form screen), `recordUsage` on both paths.

### D7. NSM-proxy counters in app_meta
`nsm_fill_copy_count` incremented only on Fill & Copy; `nsm_quick_copy_count` on Quick Copy + 0-var Copy (informational). No UI surfaces them in v1.0; they seed a future analytics layer. Proxy only — real NSM requires opt-in analytics (v1.2, out of scope).

### D8. Tech stack (locked by PART E)
Expo managed + expo-router + expo-sqlite + expo-clipboard + expo-haptics + expo-document-picker + expo-file-system + expo-sharing + expo-crypto (`Crypto.randomUUID()`). Jest for unit tests (`__tests__/`): normalize matrix (mandatory), variable engine (dedup/order/escape/textarea), import/export (conflict table).

### D9. AdMob monetization (added by user decision — revises PART A #3/#6)
`react-native-google-mobile-ads` (v16) with the Expo config plugin. App IDs in `app.json` and unit IDs in `lib/ads.ts` use the **production** AdMob account for Android (`ca-app-pub-6917313063209470...`, package `com.hoangweb.prompttemplate` with `google-services.json` wired via `android.googleServicesFile`); iOS still uses Google test IDs until an iOS release is prepared. Banner (ANCHORED_ADAPTIVE) pinned to the bottom of Home, Settings and Detail; interstitial, rewarded and app-open ads each managed by a singleton that preloads in the background. All ad requests are gated on the UMP consent flow (`lib/ads.ts` `initializeAds`/`canRequestAds`): the SDK and ad preloads only start once `canRequestAds` is true (`delayAppMeasurementInit` + consent proguard rule configured), and Settings shows a privacy-options re-review row when the UMP flow reports it required.

- **Interstitial**: every 10 copy actions (`app_meta['ad_copy_count']`). When the threshold is hit, the global `AdGateHost` dialog offers a choice — watch a rewarded ad to earn a 20-copy shield, or show the interstitial. The dialog lives at the root layout (module-level `adGateStore`) so it survives `router.back()` after copy.
- **App Open**: shown on background → foreground transitions (`hooks/useAppOpenAd` + AppState). Never on cold start (30s window), throttled to once per 3 minutes, never stacked on a recent interstitial (shared `lastFullscreenAdShownAt` throttle), only if already loaded.
- **Rewarded**: grants `app_meta['ad_shield_copies'] = 20`; while >0, each copy decrements the shield and bypasses the interstitial counter entirely. Also available voluntarily from Settings (shows current shield status).
- Non-personalized ads only (`requestNonPersonalizedAdsOnly: true`) → no UMP/GDPR consent form required.
- **Web-safe**: the native module is imported lazily behind `Platform.OS !== 'web'` plus a Metro resolver alias to `stubs/react-native-google-mobile-ads.web.js`, so the web dev build still works and simply renders no ads.
- **Native-only**: requires a development build (Expo Go cannot run it). All ad calls wrapped in try/catch so ads never break the app.
- Frequency gate (every 15 copies) keeps the core loop intact; ads only show if already loaded, never delaying the copy.

## Risks / Trade-offs

- [AdMob on web is impossible] → Mitigation: lazy native import guarded by `Platform.OS` + Metro resolver alias to a web stub; web renders no ads; the web build remains a dev/preview tool.
- [Ads can annoy users in the core loop] → Mitigation: banner only on Home/Settings/Detail; interstitial capped at every 10 copies and only when already loaded (never blocks copy); rewarded shield lets users opt out of interstitials for 20 copies; App Open capped at once per 3 minutes and never on cold start.
- [Test IDs shipped in config] → Mitigation: documented one-place swap to production unit IDs in `lib/ads.ts` + `app.json` before store release; test ads never produce revenue and are clearly visible as test.
- [AdMob requires dev build / cannot run in Expo Go] → Mitigation: documented in README and tasks; EAS Build used for production.
- [Leading-wildcard LIKE full scan] → Mitigation: bounded by MVP dataset size (hundreds to low thousands); documented threshold (~50k rows) to revisit.
- [Import duplicates allowed by design] → Mitigation: classification preview makes the outcome explicit before insertion; re-importing the same file yields all-skipped.
- [NSM proxy ≠ real NSM metric] → Mitigation: clearly labeled as proxy, stored locally for future analytics seeding; no product claims based on it.
- [Sample seeding must not diverge from user-created prompts] → Mitigation: seeds flow through the same `createPrompt` path with a one-time `samples_loaded` guard.
- [Vietnamese normalization edge cases] → Mitigation: mandatory unit-test matrix ("Việt"→"viet", "Đà Nẵng"→"da nang", "Tôi"→"toi", "Cà phê"→"ca phe") must pass before Day 3 is done.

## Migration Plan

- Greenfield app: first install runs `runMigrations` at root-layout mount → creates tables → seeds 8 samples (guarded by `app_meta['samples_loaded']`).
- Rollback: no prior version exists; migration scaffold (`PRAGMA user_version`) ensures future schema changes apply incrementally without data loss.
- Export/Import JSON is the user-facing data portability path (P0) — no server-side migration involved.

## Open Questions

None that would change the specs, approach, or task breakdown. Minor presentation details (exact copy strings, colors, spacing) are left to implementation and polish, per PART C/C1–C2.
