// db/promptRepository.web.ts — localStorage implementation of the
// data-access surface (spec PART B3) for the Web platform.
//
// Mirrors promptRepository.sqlite.ts 1:1 (same exports, same business rules):
// prompts live under `ptm:prompts` as a JSON array of PromptRow, app_meta
// under `ptm:app_meta` as a JSON key/value object. Shared logic (row mapping,
// normalization, ranking) comes from promptRepository.shared.ts.

import { normalizeVietnamese } from '../lib/normalize';
import type { ExportFilePrompt, Prompt, PromptRow } from '../types/prompt';
import {
  buildCreateRow,
  buildImportRow,
  computeSearchNormalized,
  rankSearchResults,
  rowToPrompt,
  type PromptRepository,
} from './promptRepository.shared';

const PROMPTS_KEY = 'ptm:prompts';
const META_KEY = 'ptm:app_meta';
const SCHEMA_VERSION_KEY = 'schema_version';

/** Current localStorage schema — bump + migrate data when the shape changes. */
export const WEB_SCHEMA_VERSION = 1;

/**
 * Web equivalent of sqlite's PRAGMA user_version migrations: records the
 * schema version in app_meta so a future schema change has a migration hook
 * (analogous to db/migrations/ on native). Called by db/init.ts.
 */
export async function initWebStorage(): Promise<void> {
  if ((await getAppMeta(SCHEMA_VERSION_KEY)) === null) {
    await setAppMeta(SCHEMA_VERSION_KEY, String(WEB_SCHEMA_VERSION));
  }
}

// ---------------------------------------------------------------------------
// localStorage helpers (defensive: no-op when unavailable, e.g. Node/SSR)
// ---------------------------------------------------------------------------

function readRows(): PromptRow[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PROMPTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const rows = parsed.filter(
      (r): r is PromptRow => typeof r === 'object' && r !== null && typeof (r as PromptRow).id === 'string'
    );
    if (rows.length !== parsed.length) {
      // Corrupted/foreign rows are dropped defensively; warn so the data loss
      // is at least visible in the console.
      console.warn(
        `[promptRepository.web] Dropped ${parsed.length - rows.length} malformed row(s) from ${PROMPTS_KEY}.`
      );
    }
    return rows;
  } catch {
    return [];
  }
}

function writeRows(rows: PromptRow[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(PROMPTS_KEY, JSON.stringify(rows));
}

function readMeta(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function writeMeta(meta: Record<string, string>): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createPrompt(input: {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
}): Promise<Prompt> {
  const rows = readRows();
  const row = buildCreateRow(input);
  rows.push(row);
  writeRows(rows);
  return rowToPrompt(row);
}

export async function updatePrompt(
  id: string,
  patch: {
    title?: string;
    content?: string;
    category?: string;
    tags?: string[];
  }
): Promise<Prompt> {
  const rows = readRows();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error(`Prompt not found: ${id}`);

  const existing = rowToPrompt(rows[idx]);
  const title = patch.title !== undefined ? patch.title : existing.title;
  const content = patch.content !== undefined ? patch.content : existing.content;
  const category = patch.category !== undefined ? patch.category : existing.category;
  const tags = patch.tags !== undefined ? patch.tags : existing.tags;

  const updated: PromptRow = {
    ...rows[idx],
    title,
    content,
    category,
    tags: JSON.stringify(tags),
    // Editing title/content recomputes search_normalized (spec B3 matrix).
    search_normalized: computeSearchNormalized(title, content),
    updated_at: Date.now(),
  };
  rows[idx] = updated;
  writeRows(rows);
  return rowToPrompt(updated);
}

export async function deletePrompt(id: string): Promise<void> {
  const rows = readRows();
  const next = rows.filter((r) => r.id !== id);
  if (next.length !== rows.length) writeRows(next);
}

export async function getPromptById(id: string): Promise<Prompt | null> {
  const row = readRows().find((r) => r.id === id);
  return row ? rowToPrompt(row) : null;
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export async function listAll(): Promise<Prompt[]> {
  return readRows()
    .map(rowToPrompt)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function listFavorites(limit?: number): Promise<Prompt[]> {
  const favorites = readRows()
    .filter((r) => r.is_favorite === 1)
    .map(rowToPrompt)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return limit ? favorites.slice(0, limit) : favorites;
}

export async function listRecentlyUsed(limit?: number): Promise<Prompt[]> {
  const recent = readRows()
    .filter((r) => r.last_used_at !== null)
    .map(rowToPrompt)
    .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0));
  return limit ? recent.slice(0, limit) : recent;
}

// ---------------------------------------------------------------------------
// Search (spec B5: substring on search_normalized + JS ranking)
// ---------------------------------------------------------------------------

export async function searchPrompts(query: string): Promise<Prompt[]> {
  const q = normalizeVietnamese(query);
  if (!q) return [];

  // Substring semantics are identical to SQL LIKE '%q%' ESCAPE '\': unlike
  // LIKE, JS String.includes() treats "%" and "_" literally, so no escaping
  // is needed here.
  const rows = readRows().filter((r) => r.search_normalized.includes(q));
  return rankSearchResults(rows.map(rowToPrompt), q);
}

// ---------------------------------------------------------------------------
// Mutations on usage / favorite
// ---------------------------------------------------------------------------

export async function toggleFavorite(id: string): Promise<Prompt> {
  const rows = readRows();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error(`Prompt not found: ${id}`);
  rows[idx] = { ...rows[idx], is_favorite: rows[idx].is_favorite === 1 ? 0 : 1 };
  writeRows(rows);
  return rowToPrompt(rows[idx]);
}

export async function recordUsage(id: string): Promise<void> {
  const rows = readRows();
  const idx = rows.findIndex((r) => r.id === id);
  // Mirrors the SQLite UPDATE: a missing id is a silent no-op.
  if (idx === -1) return;
  rows[idx] = { ...rows[idx], usage_count: rows[idx].usage_count + 1, last_used_at: Date.now() };
  writeRows(rows);
}

// ---------------------------------------------------------------------------
// Bulk / counts / meta
// ---------------------------------------------------------------------------

export async function bulkInsert(prompts: ExportFilePrompt[]): Promise<void> {
  const rows = readRows();
  const now = Date.now();
  const existingIds = new Set(rows.map((r) => r.id));
  for (const p of prompts) {
    // Classification guarantees ids are new; a duplicate id inside one file is
    // malformed input — skip it rather than storing two rows with the same id
    // (the SQLite backend would reject the second INSERT as a PK violation).
    if (existingIds.has(p.id)) continue;
    existingIds.add(p.id);
    rows.push(buildImportRow(p, now));
  }
  writeRows(rows);
}

export async function countAll(): Promise<number> {
  return readRows().length;
}

// --- app_meta helpers (has_exported, samples_loaded, NSM counters, banner) ---

export async function getAppMeta(key: string): Promise<string | null> {
  return readMeta()[key] ?? null;
}

export async function setAppMeta(key: string, value: string): Promise<void> {
  const meta = readMeta();
  meta[key] = value;
  writeMeta(meta);
}

export async function incrementAppMeta(key: string): Promise<void> {
  const meta = readMeta();
  const current = Number.parseInt(meta[key] ?? '0', 10);
  meta[key] = String(Number.isFinite(current) ? current + 1 : 1);
  writeMeta(meta);
}

export async function hasEverExported(): Promise<boolean> {
  return (await getAppMeta('has_exported')) === '1';
}

export async function markExported(): Promise<void> {
  await setAppMeta('has_exported', '1');
}

export const repository: PromptRepository = {
  createPrompt,
  updatePrompt,
  deletePrompt,
  getPromptById,
  listAll,
  listFavorites,
  listRecentlyUsed,
  searchPrompts,
  toggleFavorite,
  recordUsage,
  bulkInsert,
  countAll,
  getAppMeta,
  setAppMeta,
  incrementAppMeta,
  hasEverExported,
  markExported,
};
