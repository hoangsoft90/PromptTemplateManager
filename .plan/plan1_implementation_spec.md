# Prompt Template Manager — Implementation Spec v3 (AGENT-READY)

> **Sources:** `plan1.md` → `plan1_final.md` → 6 review rounds (12 files) → `plan1_final_1.md` (v2)
> **This document:** v3 — rewritten for direct consumption by a coding agent. Every section below
> is either an OpenSpec-style capability (requirement + scenario) or a concrete artifact (schema,
> TypeScript interface, file tree, regex, task checklist) that needs **no further interpretation**.
> **Status:** READY_FOR_DEV. Do not re-litigate PART A decisions — implement PART B/C/D as written.
> **Date:** 2026-08-10

---

# PART A — DECISIONS LOCKED (context only, do not re-open)

These went through 6 independent AI reviews converging on the same conclusions. Treat as given.

1. Reframe: NOT "prompts in codebase" (team/git problem) → **Personal Prompt Template Library** for individual AI power users.
2. Core differentiator = `{{variable}}` template engine + fill-and-copy loop. Without it, this is just a notes app.
3. No banner ads. No backend. No account/auth. No cloud in MVP.
4. Search = `search_normalized` column (diacritics-stripped, lowercased) + `LIKE`. Not FTS5 (unreliable Vietnamese tokenization).
5. Import/Export JSON = P0 (data ownership / no vendor lock-in).
6. MVP is 100% free. No paywall logic in v1.0 codebase at all.
7. Out of scope for v1.0: Share Extension, Dark mode, Analytics, Markdown import/export, Tags/Categories UI, Cloud sync.
8. North Star Metric = **Weekly Successful Template Reuses / Active User** (not measurable in MVP without analytics — tracked via local counters as proxy only).
9. UX Performance Target (separate from NSM): P50 ≤ 5s, P90 ≤ 8s from template-select to copy-available, excluding user typing/pasting time.
10. Positioning: *"The fastest way to turn your repeated AI instructions into reusable templates."* + *"Zero-cloud. Zero-account. Your prompt library stays strictly on your device."* — never claim "encrypted"/"secure".

---

# PART B — DATA LAYER (implement exactly as specified)

## B1. SQLite Schema

```sql
PRAGMA user_version = 1;

CREATE TABLE IF NOT EXISTS prompts (
  id                  TEXT PRIMARY KEY,          -- uuid v4
  title               TEXT NOT NULL,
  content             TEXT NOT NULL,
  category            TEXT NOT NULL DEFAULT '',
  tags                TEXT NOT NULL DEFAULT '[]', -- JSON array string, e.g. '["dev","email"]'
  is_favorite         INTEGER NOT NULL DEFAULT 0, -- 0/1
  usage_count         INTEGER NOT NULL DEFAULT 0,
  last_used_at        INTEGER,                     -- unix ms, NULL if never used
  search_normalized   TEXT NOT NULL,               -- normalizeVietnamese(title + ' ' + content)
  created_at          INTEGER NOT NULL,             -- unix ms
  updated_at          INTEGER NOT NULL              -- unix ms
);

CREATE INDEX IF NOT EXISTS idx_prompts_search    ON prompts(search_normalized);
CREATE INDEX IF NOT EXISTS idx_prompts_last_used ON prompts(last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_favorite  ON prompts(is_favorite);
CREATE INDEX IF NOT EXISTS idx_prompts_usage     ON prompts(usage_count DESC);

CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- seeded rows: 'has_exported' = '0' | '1', 'samples_loaded' = '0' | '1', 'schema_version' = '1'
```

### Migration scaffold (required from day 1, even though v1.0 has only one migration)

```
/db/migrations/
  001_init.sql        -- CREATE TABLE prompts, app_meta + all indexes above
```
```ts
// db/migrate.ts
type Migration = { version: number; up: (db: SQLiteDatabase) => Promise<void> };

const migrations: Migration[] = [
  { version: 1, up: async (db) => { /* run 001_init.sql */ } },
  // future: { version: 2, up: async (db) => { await db.execAsync('ALTER TABLE prompts ADD COLUMN ...') } }
];

export async function runMigrations(db: SQLiteDatabase) {
  const { user_version } = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  for (const m of migrations) {
    if (m.version > user_version) {
      await m.up(db);
      await db.execAsync(`PRAGMA user_version = ${m.version}`);
    }
  }
}
```

## B2. TypeScript domain types

```ts
// types/prompt.ts
export interface PromptRow {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string;            // raw JSON string as stored
  is_favorite: 0 | 1;
  usage_count: number;
  last_used_at: number | null;
  search_normalized: string;
  created_at: number;
  updated_at: number;
}

export interface Prompt {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];           // parsed
  isFavorite: boolean;
  usageCount: number;
  lastUsedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Variable {
  name: string;             // canonical lowercase key, e.g. "tone"
  label: string;             // display casing from first occurrence, e.g. "Tone"
  inputType: 'text' | 'textarea';
  placeholder?: string;
}

export interface ExportFilePrompt {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  isFavorite: boolean;
}

export interface ExportFile {
  format: 'prompt-template-manager';
  version: 1;
  exportedAt: number;
  prompts: ExportFilePrompt[];
}

export type ImportOutcome =
  | { action: 'created'; prompt: ExportFilePrompt }
  | { action: 'skipped_duplicate'; id: string }
  | { action: 'created_new_id'; originalId: string; newId: string }
  | { action: 'invalid'; index: number; reason: string };
```

## B3. Repository functions (implement all — this is the entire data-access surface)

```ts
// db/promptRepository.ts
export async function createPrompt(input: { title: string; content: string; category?: string; tags?: string[] }): Promise<Prompt>;
export async function updatePrompt(id: string, patch: { title?: string; content?: string; category?: string; tags?: string[] }): Promise<Prompt>;
export async function deletePrompt(id: string): Promise<void>;
export async function getPromptById(id: string): Promise<Prompt | null>;
export async function listAll(): Promise<Prompt[]>;
export async function listFavorites(limit?: number): Promise<Prompt[]>;
export async function listRecentlyUsed(limit?: number): Promise<Prompt[]>;   // WHERE last_used_at IS NOT NULL ORDER BY last_used_at DESC
export async function searchPrompts(query: string): Promise<Prompt[]>;        // see B5 for ranking
export async function toggleFavorite(id: string): Promise<Prompt>;
export async function recordUsage(id: string): Promise<void>;                 // usage_count += 1, last_used_at = Date.now(); does NOT touch updated_at
export async function bulkInsert(prompts: ExportFilePrompt[]): Promise<void>; // used by import + sample seeding
export async function countAll(): Promise<number>;
export async function hasEverExported(): Promise<boolean>;                    // reads app_meta['has_exported']
export async function markExported(): Promise<void>;                          // sets app_meta['has_exported'] = '1'
```

**Update-rule matrix (do not deviate):**

| Action | `usage_count` | `last_used_at` | `updated_at` | `search_normalized` | Counts toward NSM proxy |
|---|---|---|---|---|---|
| Fill & Copy (variable form → copy) | +1 | `now()` | unchanged | unchanged | ✅ yes |
| Quick Copy (raw template from card) | +1 | `now()` | unchanged | unchanged | ❌ no |
| Copy (0-variable prompt, direct) | +1 | `now()` | unchanged | unchanged | ❌ no |
| Edit title/content | unchanged | unchanged | `now()` | recomputed | — |
| Toggle favorite | unchanged | unchanged | unchanged | unchanged | — |
| Import (new record) | 0 | `null` | `now()` | computed | — |

> Both Fill & Copy and Quick Copy call `recordUsage(id)`. The NSM-proxy counter (see B7) is a
> **separate** in-memory/app_meta counter incremented only on Fill & Copy, so Recent/Most-Used stay
> accurate for both copy types while the stricter NSM proxy stays clean.

## B4. Variable engine

**Regex:** `/\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g`
Does not match `{"key": "value"}` or `{{"name": "John"}}` (starts with quote, not a letter).

**Escape:** a `\{{` immediately before a match means "render literal, not a variable". Implementation: before running the detection regex, scan for `\{{...}}` occurrences and mask them (replace with a placeholder token), run detection on the rest, then on final render replace the masked token back with `{{...}}` (backslash stripped).

```ts
// lib/variableEngine.ts
const VAR_REGEX = /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g;
const TEXTAREA_HINTS = ['code','content','body','text','description','context','prompt','message','notes','input'];

export function extractVariables(content: string): Variable[] {
  // 1. Mask `\{{...}}` (escaped literals) before scanning.
  // 2. Run VAR_REGEX on masked content.
  // 3. Case-insensitive dedup: key = match[1].toLowerCase(); first-seen casing becomes `label`.
  // 4. Preserve order of first appearance (Map insertion order = fine for this).
  // 5. inputType = TEXTAREA_HINTS.some(h => key.includes(h)) ? 'textarea' : 'text'.
  // 6. placeholder = PLACEHOLDER_MAP[key] ?? undefined (see below).
  // returns Variable[]
}

export function renderPrompt(content: string, values: Record<string, string>): string {
  // Replace every {{Name}} (case-insensitive match against values keyed by lowercase)
  // with values[lowercase(name)]. Un-escape `\{{...}}` back to literal `{{...}}`.
}

export function findUnclosedVariable(content: string): string | null {
  // soft-warning check for editor: detects `{{name` with no closing `}}` before next `{{` or EOF.
  // returns the partial name or null.
}

const PLACEHOLDER_MAP: Record<string, string> = {
  language: 'TypeScript, Python, Go…',
  format: 'Bullet points, JSON, Markdown…',
  tone: 'Formal, Casual, Friendly…',
  length: 'Short, Medium, Long…',
  style: 'Professional, Creative…',
};
```

**Rules (all mandatory):**
1. Case-insensitive + dedup: `{{Tone}}`, `{{tone}}`, `{{TONE}}` → **one** variable. Label uses first-seen casing.
2. Order of appearance in the form == order of first appearance in `content`. Never alphabetical.
3. Same variable name reused twice in content → same value substituted in both places on render.
4. Required validation: if any variable value is empty string when user taps Copy → highlight that field red, block copy, do not call `recordUsage`.
5. `variables[]` is **never persisted**. Always derived at render time from `content`. This avoids desync when a user edits `content` without touching a nonexistent stored variable list.
6. Escape `\{{name}}` → literal `{{name}}` in both preview and final copied text.

**Editor soft-warning:** if `findUnclosedVariable(content)` returns non-null, show non-blocking inline hint: *"Looks like you have an unfinished variable: {{name"*. Never block Save on this.

## B5. Search

```ts
// lib/normalize.ts
export function normalizeVietnamese(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip tone marks
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}
```

**Mandatory test matrix** (write as unit tests, must pass before Day 3 is considered done):
```
"Việt"     → "viet"
"Đà Nẵng"  → "da nang"
"Tôi"      → "toi"
"Cà phê"   → "ca phe"
"TypeScript" → "typescript"
```

**Query:**
```sql
SELECT * FROM prompts WHERE search_normalized LIKE '%' || ? || '%'
```
`?` = `normalizeVietnamese(userInput)`.

**Correct reasoning (for code comments / doc, not just "it's fast"):** leading-wildcard `LIKE '%x%'` cannot use the B-tree index on `search_normalized` — this is a full table scan. At MVP scale (hundreds to low thousands of local rows) this is <50ms and fully acceptable. Do **not** introduce FTS5. Revisit only past ~50k rows (unlikely for a personal library).

**Ranking** — after fetching the LIKE-matched rows, sort in JS by this tuple (dataset is small, no need for SQL CASE complexity):
1. Title starts-with `query` (normalized) → boolean, true first
2. Title contains `query` → boolean, true first
3. Content contains `query` → boolean, true first
4. `usage_count` DESC
5. `last_used_at` DESC (nulls last)

**Home screen sections:**
- Not searching: Favorites (top 5) → Recently Used (top 5, `last_used_at IS NOT NULL`) → All Prompts.
- Searching (query non-empty): show **only** ranked search results; hide Favorites/Recent sections entirely.

## B6. Import / Export

**Export file format (exact):**
```json
{
  "format": "prompt-template-manager",
  "version": 1,
  "exportedAt": 1780000000000,
  "prompts": [
    { "id": "uuid", "title": "...", "content": "...", "category": "", "tags": [], "isFavorite": false }
  ]
}
```
Never export: `usage_count`, `last_used_at`, `search_normalized`, `created_at`, `updated_at` (derived/local-only data).

On successful export: call `markExported()`, dismiss backup-reminder banner if shown.

**Import conflict resolution** (evaluate in this order per incoming record):

| Scenario | Action |
|---|---|
| `id` exists in DB **and** `content` identical | Skip (not counted as error, shown as "duplicate") |
| `id` exists in DB **and** `content` differs | Import as new row with freshly generated UUID |
| `id` does not exist, but another row has identical `content` | Import anyway (duplicates allowed by design — user's call) |
| Missing `title` or `content`, or malformed JSON entry | Mark invalid, do not insert, collect reason |

**Import flow:** pick file → parse JSON → validate top-level `format`/`version` (reject with clear error if wrong file type) → validate + classify every record per table above → show preview screen: `"12 new · 3 skipped (duplicate) · 1 invalid"` with expandable invalid-reasons list → user taps `[Import]` → `bulkInsert()` the "new"-classified records → toast success count.

```ts
// lib/importExport.ts
export function buildExportFile(prompts: Prompt[]): ExportFile;
export function parseImportFile(raw: string): { ok: true; file: ExportFile } | { ok: false; error: string };
export async function classifyImport(incoming: ExportFilePrompt[]): Promise<ImportOutcome[]>;
export async function applyImport(outcomes: ImportOutcome[]): Promise<{ created: number; skipped: number; invalid: number }>;
```

## B7. Backup reminder banner

```ts
// hooks/useBackupReminder.ts
// Show if: countAll() >= 5 AND hasEverExported() === false.
// Dismissible (store dismissed state in app_meta['backup_banner_dismissed_at'];
// re-show after 20 more prompts created if still not exported — do not nag every screen visit
// once dismissed within the same session).
```
Non-blocking. Never a modal. Single-line banner with a `[Export now]` CTA that opens the Export flow directly.

## B8. NSM proxy counters (local only, no analytics backend in MVP)

```ts
// app_meta keys:
//   'nsm_fill_copy_count'   -- incremented only on Fill & Copy (the strict NSM event)
//   'nsm_quick_copy_count'  -- incremented on Quick Copy + 0-var Copy (informational only)
```
These exist purely so a future analytics layer (v1.2+) has historical local data to seed from. No UI surfaces these numbers in v1.0 except optionally a debug screen — not required.

---

# PART C — UI LAYER

## C1. Screens (Expo Router)

```
app/
  _layout.tsx              -- root stack, loads DB + runs migrations + seeds samples on first run
  index.tsx                -- Home (search bar, sections, FAB)
  prompt/[id].tsx           -- Detail (view raw content, edit/delete, favorite toggle)
  prompt/[id]/fill.tsx      -- Variable Form + Preview + Copy Final Prompt
  prompt/new.tsx            -- Editor (create)
  prompt/[id]/edit.tsx      -- Editor (edit, pre-filled)
  settings/index.tsx        -- Settings (Import/Export/Restore Samples)
  settings/import-preview.tsx -- Import preview/confirm screen
```

## C2. Component inventory

```
components/
  SearchBar.tsx
  PromptCard.tsx            -- props: prompt, onQuickCopy, onFillCopy (shown only if hasVariables), onFavoriteToggle
  SectionHeader.tsx          -- "⭐ Favorites", "🕘 Recently Used", "📋 All Prompts"
  VariableField.tsx          -- text or textarea input, placeholder, error state (red border), Expand toggle
  PreviewPane.tsx             -- read-only rendered prompt text
  EmptyState.tsx              -- actionable: [Create] [Import]
  BackupReminderBanner.tsx
  ImportPreviewList.tsx       -- shows new/skipped/invalid breakdown
  ConfirmDialog.tsx           -- delete confirmation
  Toast.tsx                   -- "Copied!", "Template copied!", "Imported 12 prompts"
```

## C3. Card action logic (critical branch — implement exactly)

```
if (extractVariables(prompt.content).length === 0) {
  // Flow 2b: 0-variable prompt
  primaryAction = "Copy"              // copies content raw, no form
  onPress -> Clipboard.setStringAsync(content) -> recordUsage(id) -> toast("Copied!")
} else {
  // Flow 2: has variables
  primaryAction = "Fill & Copy"       // navigates to fill.tsx
  secondaryAction (on card only, list view) = "Copy" // Quick Copy = raw template incl. {{vars}}
}
```
Card always shows a small `[Copy]` icon-button for Quick Copy (raw, keeps `{{}}` visible) regardless of variable count, **plus** `[Fill & Copy]` only when `extractVariables(content).length > 0`. If 0 variables, `[Copy]` is the only/primary action (no duplicate button).

## C4. Fill & Copy screen behavior

1. On mount: `extractVariables(prompt.content)` → render `VariableField` per variable, in order.
2. Live preview: `renderPrompt(content, currentValues)` updates `PreviewPane` on every keystroke (debounce 150ms fine).
3. Tap `[Copy Final Prompt]`:
   - Validate: any field empty → set that field's error state true, scroll to first error, **do not copy**.
   - All valid → `Clipboard.setStringAsync(rendered)` → haptic (`Haptics.notificationAsync(Success)`) → `recordUsage(id)` + increment `nsm_fill_copy_count` → toast "Copied!" → navigate back to Home.

## C5. Editor screen behavior

- Fields: Title (required), Content (required, multiline, monospace-friendly font ok), Category (optional text), Tags (optional, comma-separated input → array on save).
- Live soft-warning: `findUnclosedVariable(content)` → inline warning text, non-blocking.
- No autosave. Explicit `[Save]` / `[Cancel]`. Save disabled until Title + Content non-empty.
- On Save (create): `createPrompt()` → navigate to Home, new prompt visible.
- On Save (edit): `updatePrompt()` → navigate back to Detail.

---

# PART D — SAMPLE DATA (seed exactly these 8, verbatim content)

Seeded once on first app launch if `app_meta['samples_loaded']` is unset. Sets it to `'1'` after.

```json
[
  {
    "title": "Code Reviewer",
    "content": "Review the following {{language}} code.\n\nFocus on:\n- correctness\n- performance\n- security\n\nCode:\n{{code}}\n\nReturn your answer in {{format}}.",
    "category": "Development", "tags": ["coding"]
  },
  {
    "title": "Email Writer",
    "content": "Write a {{tone}} email to {{recipient}} about {{topic}}.",
    "category": "Writing", "tags": ["email"]
  },
  {
    "title": "Summarizer",
    "content": "Summarize the following content in {{length}}, using a {{style}} style:\n\n{{content}}",
    "category": "Productivity", "tags": ["summary"]
  },
  {
    "title": "Meeting Notes → Action Items",
    "content": "Extract clear action items from these meeting notes. For each item, include owner and deadline if mentioned.\n\nNotes:\n{{notes}}",
    "category": "Productivity", "tags": ["meetings"]
  },
  {
    "title": "Research Assistant",
    "content": "Research {{topic}} at a {{depth}} level of detail. Present the findings as {{format}}.",
    "category": "Research", "tags": ["research"]
  },
  {
    "title": "Prompt Refiner",
    "content": "Improve the following prompt. Make it more precise, structured, and effective.\n\nOriginal prompt:\n{{prompt}}\n\nReturn only the improved version.",
    "category": "Meta", "tags": ["meta"]
  },
  {
    "title": "Image Prompt Generator",
    "content": "Create a detailed image generation prompt for: {{subject}}.\nStyle: {{style}}. Mood: {{mood}}.",
    "category": "Creative", "tags": ["image"]
  },
  {
    "title": "Translate & Adapt",
    "content": "Translate the following text into {{target_language}}, adapting the tone to be {{tone}}.\n\nText:\n{{text}}",
    "category": "Language", "tags": ["translate"]
  }
]
```
Each demonstrates a distinct capability: TextArea heuristic (#1, #4), multiple short variables (#2, #7), meta/self-referential template (#6), language variable (#8). All must import/pass through the exact same `createPrompt` path as user-created prompts (no special-cased sample logic beyond the one-time seed check).

---

# PART E — TECH STACK

| Component | Choice |
|---|---|
| Framework | Expo (React Native), managed workflow |
| Router | expo-router |
| Database | expo-sqlite |
| Clipboard | expo-clipboard |
| Haptics | expo-haptics |
| File I/O | expo-file-system + expo-document-picker (import), expo-sharing (export) |
| UUID | expo-crypto (`Crypto.randomUUID()`) |
| Local prefs (non-DB, e.g. banner dismissed flag) | can live in `app_meta` table — no separate MMKV/AsyncStorage needed unless preferred |
| Backend / Analytics | none |

---

# PART F — PROJECT FILE TREE (target structure)

```
prompt-template-manager/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── prompt/
│   │   ├── new.tsx
│   │   └── [id]/
│   │       ├── index.tsx        (Detail)
│   │       ├── edit.tsx
│   │       └── fill.tsx
│   └── settings/
│       ├── index.tsx
│       └── import-preview.tsx
├── components/
│   ├── SearchBar.tsx
│   ├── PromptCard.tsx
│   ├── SectionHeader.tsx
│   ├── VariableField.tsx
│   ├── PreviewPane.tsx
│   ├── EmptyState.tsx
│   ├── BackupReminderBanner.tsx
│   ├── ImportPreviewList.tsx
│   ├── ConfirmDialog.tsx
│   └── Toast.tsx
├── db/
│   ├── client.ts               (opens db, calls runMigrations)
│   ├── migrate.ts
│   ├── migrations/001_init.sql
│   └── promptRepository.ts
├── lib/
│   ├── variableEngine.ts
│   ├── normalize.ts
│   ├── importExport.ts
│   └── samplePrompts.ts        (the 8 seed records from PART D)
├── hooks/
│   ├── useBackupReminder.ts
│   ├── usePrompts.ts           (list/search state)
│   └── useVariableForm.ts
├── types/
│   └── prompt.ts
├── __tests__/
│   ├── normalize.test.ts       (mandatory Vietnamese test matrix)
│   ├── variableEngine.test.ts  (dedup, order, escape, textarea heuristic)
│   └── importExport.test.ts    (conflict resolution table)
└── app.json / package.json / tsconfig.json
```

---

# PART G — ACCEPTANCE CRITERIA (Given/When/Then, per capability — use these as the OpenSpec `scenarios`)

## Capability: variable-engine

```
Scenario: case-insensitive deduplication
  Given content "Hi {{Name}}, nice to meet you {{name}}"
  When variables are extracted
  Then exactly 1 variable is returned with label "Name"

Scenario: order of appearance
  Given content "{{recipient}} ... {{topic}} ... {{tone}}"
  When variables are extracted
  Then the returned order is [recipient, topic, tone]

Scenario: same name reused renders same value
  Given content "{{tone}} email... end with a {{tone}} closing"
  And user enters "Formal" for tone
  When prompt is rendered
  Then both occurrences are replaced with "Formal"

Scenario: escape syntax
  Given content "Use syntax like \{{variable}} in your template"
  When variables are extracted
  Then no variable is detected for that occurrence
  And when rendered, output contains literal "{{variable}}"

Scenario: required validation blocks copy
  Given a fill form with 1 empty required variable
  When user taps "Copy Final Prompt"
  Then the empty field is highlighted red
  And clipboard is not modified
  And usage_count is not incremented

Scenario: zero-variable flow skips the form
  Given a prompt with no {{}} syntax in content
  When user taps the prompt's primary action
  Then content is copied directly with no form screen shown
  And usage_count/last_used_at are updated
```

## Capability: search

```
Scenario: diacritic-insensitive match
  Given a prompt titled "Đà Nẵng travel guide"
  When user searches "da nang"
  Then the prompt appears in results

Scenario: ranking priority
  Given two prompts: A (title contains query), B (title starts with query)
  When user searches
  Then B appears before A

Scenario: search hides browse sections
  Given a non-empty search query
  When results are displayed
  Then Favorites and Recently Used sections are not shown
```

## Capability: usage-tracking

```
Scenario: quick copy updates recent list
  Given a prompt has never been used
  When user taps Quick Copy on its card
  Then last_used_at is set to now
  And the prompt appears at the top of "Recently Used"
  And the strict NSM fill-copy counter is NOT incremented

Scenario: fill and copy updates recent list and NSM
  Given a prompt with variables, all filled validly
  When user taps "Copy Final Prompt"
  Then last_used_at is set to now
  And usage_count is incremented
  And the NSM fill-copy counter is incremented
```

## Capability: import-export

```
Scenario: export excludes derived fields
  When a prompt is exported
  Then the JSON record contains no usage_count, last_used_at, search_normalized, created_at, updated_at fields

Scenario: duplicate id + identical content is skipped
  Given an existing prompt with id X and content C
  When importing a record with id X and content C
  Then it is classified as skipped_duplicate and not inserted

Scenario: duplicate id + different content gets new id
  Given an existing prompt with id X and content C
  When importing a record with id X and content C2 (C2 != C)
  Then a new row is inserted with a freshly generated id

Scenario: malformed record is reported, not silently dropped
  Given an import file with one record missing "content"
  When import is previewed
  Then the preview shows 1 invalid record with a specific reason
  And that record is not inserted when user confirms import
```

## Capability: backup-reminder

```
Scenario: banner appears after threshold
  Given the user has created 5 prompts and never exported
  When Home screen is displayed
  Then the backup reminder banner is visible

Scenario: banner disappears after export
  Given the banner is visible
  When user completes an export
  Then the banner is hidden and app_meta['has_exported'] = '1'
```

---

# PART H — 4-DAY TASK CHECKLIST (agent should track as literal checkboxes)

## Day 1 — Foundation
- [ ] Expo project scaffold + expo-router + TypeScript config
- [ ] `db/migrations/001_init.sql`, `db/migrate.ts`, `db/client.ts`
- [ ] `types/prompt.ts`
- [ ] `db/promptRepository.ts` — all functions in B3
- [ ] Home screen: list all prompts (no sections/search yet), FAB → Editor
- [ ] Editor screen: create/edit, validation (title+content required)
- [ ] Detail screen: view, edit, delete (with confirm dialog)

## Day 2 — Core Loop
- [ ] `lib/variableEngine.ts` — extractVariables, renderPrompt, findUnclosedVariable
- [ ] `lib/normalize.ts` — normalizeVietnamese + unit tests (mandatory matrix)
- [ ] Fill & Copy screen: form rendering (order of appearance, text/textarea heuristic + Expand), live preview, required validation, haptic + toast on copy
- [ ] Quick Copy button on card + Detail screen
- [ ] 0-variable flow: card shows only "Copy", skips form entirely
- [ ] Wire `recordUsage` + NSM proxy counters for both copy paths per B3 matrix

## Day 3 — Search & Data
- [ ] `search_normalized` computed on create/update
- [ ] Search bar + ranking logic (B5) + section-hiding while searching
- [ ] Favorites toggle + section
- [ ] Recently Used section (`last_used_at DESC`, excludes never-used)
- [ ] `lib/importExport.ts` — build/parse/classify/apply
- [ ] Import preview screen + conflict resolution table (test all 4 scenarios)
- [ ] Export flow (expo-sharing) + `markExported()`

## Day 4 — Polish & Ship
- [ ] Seed 8 sample prompts on first launch (`lib/samplePrompts.ts`)
- [ ] Empty states (no prompts / no search results) with actionable CTAs
- [ ] `BackupReminderBanner` wired to `useBackupReminder`
- [ ] Error handling: toast/alert for all CRUD + import/export failure paths
- [ ] UI polish pass (spacing, typography, empty/loading/error states consistent)
- [ ] Production build (EAS Build) — Android APK + iOS (if applicable)

**Stretch (only if genuine buffer remains):** "Paste to Create" — detect clipboard content on New Prompt screen, offer one-tap "Paste & Create" that pre-fills Content.

**Explicitly out of scope for these 4 days:** Share Extension, Markdown import/export, Tags/Categories filter UI, Dark mode, Analytics backend, Cloud sync, Paywall/IAP, onboarding screens beyond the 8 samples.

---

# PART I — DEFINITION OF DONE (final gate before calling MVP shipped)

1. Create → Save → appears in list.
2. Search "Việt"/"Đà Nẵng"/"Tôi"/"Cà phê" correctly matches non-accented equivalents (unit tests pass).
3. Tap prompt with variables → Fill & Copy → all fields validate → preview correct → copy → paste works in an external app.
4. Tap prompt with zero variables → copies immediately, no form screen shown.
5. Both Quick Copy and Fill & Copy update `usage_count`/`last_used_at`; Recently Used ordering reflects this correctly.
6. Export → Import into a fresh install reproduces the library; re-importing the same file produces all-skipped (no duplicates created).
7. Favorite toggle, edit, delete all work from Detail screen.
8. First launch shows 8 samples; user understands variable concept within ~30 seconds without instructions.
9. Backup reminder banner appears after 5 prompts with no export, disappears after first export.
10. `{{Tone}}`/`{{tone}}` collapse to one field; variable order matches appearance order; empty required field blocks copy.

---

# PART J — POST-MVP ROADMAP (context, not for this build)

```
v1.1  Tags/Categories filter UI · Duplicate prompt · Most Used sort · Export Markdown ·
      Import Markdown · Dropdown presets for tone/format/style · Dark mode · Paste to Create (if not done)
v1.2  Analytics opt-in (measure real NSM) · One-time Pro unlock (pricing TBD from retention data) ·
      "Copy & Open AI App" deep link (only if a reliable target app deep link exists)
v1.3  Version history/diff · Bulk operations · Advanced variable types (dropdown-in-template)
v2.0  Cloud sync (iCloud/Drive) · Cross-device
v3.0  (only if strong PMF) Team sharing · IDE integration · Prompt testing/eval · API
```

---

**Bottom line for the implementing agent:** every screen, button, and data write in v1.0 must serve
one loop — **Search → Fill (if needed) → Copy** — as fast as possible. If a feature request doesn't
serve that loop, it belongs in Part J, not in this build.