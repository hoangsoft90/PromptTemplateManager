## 1. Project Scaffold & Data Layer

- [x] 1.1 Scaffold Expo project with TypeScript + expo-router (routes: `app/`, `app/prompt/`, `app/settings/`)
- [x] 1.2 Add dependencies: expo-sqlite, expo-clipboard, expo-haptics, expo-document-picker, expo-file-system, expo-sharing, expo-crypto; dev deps for Jest unit tests
- [x] 1.3 Create `db/migrations/001_init.sql` (prompts + app_meta tables, all indexes) and `db/migrate.ts` (`runMigrations` via `PRAGMA user_version`)
- [x] 1.4 Create `db/client.ts` (opens DB, runs migrations)
- [x] 1.5 Create `types/prompt.ts` (PromptRow, Prompt, Variable, ExportFile, ImportOutcome)
- [x] 1.6 Implement all `db/promptRepository.ts` functions (create/update/delete/get/listAll/listFavorites/listRecentlyUsed/search/toggleFavorite/recordUsage/bulkInsert/countAll/hasEverExported/markExported)
- [x] 1.7 Root `_layout.tsx`: init DB + migrations + seed samples on first launch

## 2. Core CRUD Screens

- [x] 2.1 Home screen: list all prompts + FAB → Editor (no sections/search yet)
- [x] 2.2 Editor screen (create): Title/Content required, optional Category/Tags (comma-separated), Save disabled until valid
- [x] 2.3 Editor screen (edit): pre-filled, Save → back to Detail
- [x] 2.4 Detail screen: view raw content, edit/delete (ConfirmDialog), favorite toggle
- [x] 2.5 Empty states: no prompts / no search results with Create + Import CTAs

## 3. Variable Engine & Fill & Copy

- [x] 3.1 Implement `lib/variableEngine.ts`: extractVariables (dedup, order, textarea heuristic, placeholders), renderPrompt (case-insensitive substitution, escape un-masking), findUnclosedVariable
- [x] 3.2 Implement `lib/normalize.ts` (normalizeVietnamese) + unit tests with mandatory matrix ("Việt"→"viet", "Đà Nẵng"→"da nang", "Tôi"→"toi", "Cà phê"→"ca phe", "TypeScript"→"typescript")
- [x] 3.3 Unit tests for variable engine: dedup, order of appearance, reuse, escape, textarea heuristic, unclosed variable
- [x] 3.4 Fill & Copy screen: form renders fields in appearance order (text/textarea + Expand), live PreviewPane (debounced), required validation (red highlight, block copy, no recordUsage)
- [x] 3.5 Copy actions on card + Detail: Quick Copy (raw) icon always; Fill & Copy primary only if variables exist; 0-variable → single Copy button, direct copy, no form
- [x] 3.6 Wire usage tracking per update-rule matrix: recordUsage + NSM proxy counters on both copy paths; haptic + toast on Fill & Copy success
- [x] 3.7 Editor soft-warning: findUnclosedVariable inline hint, non-blocking

## 4. Search, Favorites & Recent

- [x] 4.1 Compute `search_normalized` on create/update (normalizeVietnamese(title + ' ' + content))
- [x] 4.2 Search bar + `searchPrompts` (LIKE query + JS ranking tuple: title starts-with > title contains > content contains > usage DESC > last_used DESC)
- [x] 4.3 Hide Favorites/Recent sections while query non-empty; show only ranked results
- [x] 4.4 Favorites section (top 5) + toggle wiring
- [x] 4.5 Recently Used section (top 5, `last_used_at IS NOT NULL`)

## 5. Import / Export & Backup Reminder

- [x] 5.1 Implement `lib/importExport.ts`: buildExportFile (exact format, never export derived fields), parseImportFile (validate format/version), classifyImport (4-way conflict table), applyImport
- [x] 5.2 Unit tests for conflict resolution: skip duplicate id+content, new id on content diff, identical-content duplicates allowed, invalid record reported
- [x] 5.3 Export flow: document picker/sharing + markExported() + dismiss banner
- [x] 5.4 Import preview screen: breakdown ("12 new · 3 skipped · 1 invalid") with expandable invalid reasons; confirm → applyImport → toast
- [x] 5.5 Implement `hooks/useBackupReminder.ts` + BackupReminderBanner (≥5 prompts, never exported, dismissible, re-show after 20 more prompts; CTA opens Export)

## 6. AdMob Monetization (user decision — revises PART A #3/#6)

- [x] 6.0.1 Install `react-native-google-mobile-ads` via expo install + register config plugin in app.json (test App IDs)
- [x] 6.0.2 Create `lib/ads.ts`: test unit IDs, web-safe lazy native import, interstitial singleton (preload + show-if-loaded)
- [x] 6.0.3 Create `components/AdBanner.tsx` (adaptive banner, web guard) + pin to Home bottom with FAB raised
- [x] 6.0.4 Initialize SDK in root layout; track copy actions in app_meta and trigger interstitial every 10 copies from all copy paths
- [x] 6.0.5 Adjust interstitial frequency to every 15 copies; add rewarded ads granting a 20-copy interstitial shield
- [x] 6.0.6 Add global `AdGateHost` + `adGateStore` (offer dialog survives navigation); rewarded CTA + shield status in Settings; web stub extended with RewardedAd

## 6. Samples, Polish & Ship

- [x] 6.1 Create `lib/samplePrompts.ts` (8 verbatim samples) + one-time seed guard via app_meta['samples_loaded']
- [x] 6.2 Error handling: toast/alert for all CRUD + import/export failure paths
- [x] 6.3 UI polish pass: consistent spacing, typography, loading/empty/error states
- [x] 6.4 Verify Definition of Done (PART I): create→list, search matrix passes, fill&copy→paste works, 0-var direct copy, both copy types update recent, export→import round-trip, re-import all-skipped, favorite/edit/delete, 8 samples on first launch, backup banner lifecycle, `{{Tone}}`/`{{tone}}` collapse
  - Verified: `tsc --noEmit` clean · 28/28 Jest tests pass (normalize matrix, variable engine, import conflict table) · `expo export` bundles for Android + web · code review fixes applied
- [ ] 6.5 Production build (EAS Build): Android APK + iOS (if applicable)

## 7. Optional Stretch

- [x] 7.1 "Paste to Create": detect clipboard content on New Prompt screen, offer one-tap "Paste & Create" pre-fill (only if genuine buffer remains)
