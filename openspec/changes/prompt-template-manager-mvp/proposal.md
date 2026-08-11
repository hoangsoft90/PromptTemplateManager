## Why

AI power users repeat the same long instructions ("review this code", "write an email", "summarize this") dozens of times a day. Most apps that store these snippets are plain notes apps or team/git-based prompt repos — neither fits the personal, offline, copy-fast workflow of an individual power user.

**Prompt Template Manager** fixes this with a personal, zero-cloud prompt template library on the device: a `{{variable}}` template engine plus a fill-and-copy loop so a template becomes a 3-tap operation — Search → Fill (if needed) → Copy. The design (`.plan/plan1_implementation_spec.md` v3) has been through 6 independent AI review rounds and is locked as `READY_FOR_DEV`; this change turns that spec into an OpenSpec change so implementation can proceed task-by-task.

## What Changes

This is a greenfield Expo (React Native, managed workflow) app. It introduces:

- **Local SQLite data layer** (`expo-sqlite`) with migrations from day 1: `prompts` table + `app_meta` table + `search_normalized` column for diacritics-insensitive Vietnamese search.
- **`{{variable}}` template engine**: case-insensitive dedup, order-of-appearance form fields, text/textarea heuristic, `\{{...}}` escape syntax, required-field validation that blocks copy, live preview.
- **Fill & Copy core loop**: variable form screen, live preview pane, clipboard copy + haptic + toast. Zero-variable prompts skip the form entirely (direct Copy).
- **Search**: `normalizeVietnamese()` (NFD strip + `đ`→`d` + lowercase) with `LIKE '%q%'` and JS ranking (title starts-with > title contains > content contains > usage count > last used). Favorites/Recent sections hidden while searching.
- **Usage tracking**: `usage_count`/`last_used_at` per copy type, plus local NSM-proxy counters (`nsm_fill_copy_count`, `nsm_quick_copy_count`) for a future analytics layer.
- **JSON Import/Export** (P0 data ownership): exact file format, conflict resolution table (skip duplicate id+content / new id on content diff / duplicates allowed / invalid reported), preview screen with breakdown, `markExported()` on success.
- **Backup reminder banner**: appears at ≥5 prompts when never exported, dismissible, disappears after export.
- **8 sample prompts** seeded once on first launch, demonstrating distinct engine capabilities.
- **Editor** with required-field validation and non-blocking "unfinished variable" soft-warning.
- **AdMob monetization** (added by user decision, revises original PART A #3 "no ads" / #6 "100% free"): adaptive banner on Home + interstitial after every 10 copy actions, using test ad units by default and non-personalized ads only. Requires a dev build (native module); no ads on web.

Explicitly **out of scope** for this change: backend, accounts, cloud sync, share extension, dark mode, analytics backend, Markdown import/export, tags/categories filter UI, paywall, rewarded ads.

## Capabilities

### New Capabilities

- `prompt-library`: Core CRUD — create/edit/delete prompts, favorite toggle, home screen sections (Favorites top-5, Recently Used top-5, All), editor validation (title+content required, unclosed-variable soft warning), detail screen actions.
- `variable-engine`: `{{variable}}` extraction (case-insensitive dedup, order of appearance, text/textarea heuristic), rendering with escape-syntax `\{{...}}`, required-value validation blocking copy, zero-variable fast path, fill-form + preview behavior.
- `search`: Vietnamese diacritics-insensitive normalization and `LIKE` matching, JS ranking tuple, section-hiding while a query is active.
- `usage-tracking`: `usage_count`/`last_used_at` update rules per action type (fill&copy, quick copy, edit, import), NSM-proxy counters.
- `import-export`: Exact JSON export format (derived fields never exported), import validation + conflict-resolution classification, preview/confirm flow, `has_exported` bookkeeping.
- `backup-reminder`: Threshold-based banner show/dismiss/re-show logic, export clears it.
- `sample-seeding`: One-time seeding of 8 sample prompts through the normal `createPrompt` path, guarded by `app_meta['samples_loaded']`.
- `ads-monetization`: AdMob banner on Home and interstitial cadence (every 10 copies), non-personalized-only, test unit IDs by default, native-only (no web).

### Modified Capabilities

None — this is a greenfield project with no existing specs.

## Impact

- **New app scaffold**: `app.json`, `package.json`, `tsconfig.json`, Expo Router file-based routes.
- **New directories**: `app/` (routes), `components/`, `db/` (client, migrate, migrations/, repository), `lib/` (variable engine, normalize, import/export, samples, ads), `hooks/`, `types/`, `__tests__/`.
- **Dependencies**: `expo-sqlite`, `expo-clipboard`, `expo-haptics`, `expo-document-picker`, `expo-file-system`, `expo-sharing`, `expo-crypto`, `expo-router`, `react-native-google-mobile-ads`; dev deps for unit tests (Jest).
- **No backend or third-party services** — 100% on-device.
- **Source of truth**: `.plan/plan1_implementation_spec.md` v3 — every screen, button, and data write must serve the loop Search → Fill (if needed) → Copy.
