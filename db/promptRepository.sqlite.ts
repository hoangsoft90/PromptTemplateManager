// db/promptRepository.sqlite.ts — SQLite (expo-sqlite) implementation of the
// data-access surface (spec PART B3). Used on iOS/Android.
// Business logic shared with the web backend lives in promptRepository.shared.ts.

import { normalizeVietnamese } from '../lib/normalize';
import { getDb } from './client';
import {
  buildCreateRow,
  buildImportRow,
  computeSearchNormalized,
  rankSearchResults,
  rowToPrompt,
  rowToValues,
  type PromptRepository,
} from './promptRepository.shared';
import type { ExportFilePrompt, Prompt, PromptRow } from '../types/prompt';

const INSERT_COLUMNS = `(id, title, content, category, tags, is_favorite, usage_count, last_used_at, search_normalized, created_at, updated_at)`;

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createPrompt(input: {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
}): Promise<Prompt> {
  const db = await getDb();
  const row = buildCreateRow(input);
  await db.runAsync(
    `INSERT INTO prompts ${INSERT_COLUMNS} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    rowToValues(row)
  );
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
  const db = await getDb();
  const existing = await getPromptById(id);
  if (!existing) throw new Error(`Prompt not found: ${id}`);

  const title = patch.title !== undefined ? patch.title : existing.title;
  const content = patch.content !== undefined ? patch.content : existing.content;
  const category = patch.category !== undefined ? patch.category : existing.category;
  const tags = patch.tags !== undefined ? patch.tags : existing.tags;

  await db.runAsync(
    `UPDATE prompts SET title = ?, content = ?, category = ?, tags = ?, search_normalized = ?, updated_at = ? WHERE id = ?`,
    [title, content, category, JSON.stringify(tags), computeSearchNormalized(title, content, category, tags), Date.now(), id]
  );

  const updated = await getPromptById(id);
  if (!updated) throw new Error(`Prompt not found after update: ${id}`);
  return updated;
}

export async function deletePrompt(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM prompts WHERE id = ?', [id]);
}

export async function getPromptById(id: string): Promise<Prompt | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<PromptRow>('SELECT * FROM prompts WHERE id = ?', [id]);
  return row ? rowToPrompt(row) : null;
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export async function listAll(): Promise<Prompt[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PromptRow>('SELECT * FROM prompts ORDER BY created_at DESC');
  return rows.map(rowToPrompt);
}

export async function listFavorites(limit?: number): Promise<Prompt[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PromptRow>(
    `SELECT * FROM prompts WHERE is_favorite = 1 ORDER BY updated_at DESC ${limit ? 'LIMIT ?' : ''}`,
    limit ? [limit] : []
  );
  return rows.map(rowToPrompt);
}

export async function listRecentlyUsed(limit?: number): Promise<Prompt[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PromptRow>(
    `SELECT * FROM prompts WHERE last_used_at IS NOT NULL ORDER BY last_used_at DESC ${limit ? 'LIMIT ?' : ''}`,
    limit ? [limit] : []
  );
  return rows.map(rowToPrompt);
}

export async function listCategories(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ category: string }>(
    `SELECT DISTINCT category FROM prompts WHERE category <> '' ORDER BY category COLLATE NOCASE ASC`
  );
  return rows.map((r) => r.category);
}

export async function listTags(): Promise<string[]> {
  const db = await getDb();
  // Tags are stored as one JSON array per row — DISTINCT must happen in JS.
  // At MVP scale (hundreds of rows) this is fast and avoids JSON1 reliance.
  const rows = await db.getAllAsync<PromptRow>('SELECT tags FROM prompts');
  const seen = new Set<string>();
  for (const row of rows) {
    try {
      const parsed: unknown = JSON.parse(row.tags);
      if (Array.isArray(parsed)) {
        for (const t of parsed) {
          const s = String(t).trim();
          if (s) seen.add(s);
        }
      }
    } catch {
      // malformed JSON → ignore this row's tags
    }
  }
  return [...seen].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Search (spec B5: LIKE on search_normalized + JS ranking)
// ---------------------------------------------------------------------------

export async function searchPrompts(query: string): Promise<Prompt[]> {
  const q = normalizeVietnamese(query);
  if (!q) return [];

  const db = await getDb();
  // Leading-wildcard LIKE cannot use the B-tree index — full table scan.
  // At MVP scale (hundreds to low thousands of rows) this is <50ms and fine.
  // Do not introduce FTS5 (unreliable Vietnamese tokenization).
  // Escape LIKE wildcards so user input like "50%" matches literally.
  const likeQuery = q.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  const rows = await db.getAllAsync<PromptRow>(
    `SELECT * FROM prompts WHERE search_normalized LIKE '%' || ? || '%' ESCAPE '\\'`,
    [likeQuery]
  );

  return rankSearchResults(rows.map(rowToPrompt), q);
}

// ---------------------------------------------------------------------------
// Mutations on usage / favorite
// ---------------------------------------------------------------------------

export async function toggleFavorite(id: string): Promise<Prompt> {
  const db = await getDb();
  // Toggle favorite does NOT touch updated_at or search_normalized (spec B3 matrix).
  await db.runAsync(
    'UPDATE prompts SET is_favorite = CASE is_favorite WHEN 1 THEN 0 ELSE 1 END WHERE id = ?',
    [id]
  );
  const updated = await getPromptById(id);
  if (!updated) throw new Error(`Prompt not found: ${id}`);
  return updated;
}

export async function recordUsage(id: string): Promise<void> {
  const db = await getDb();
  // usage_count += 1, last_used_at = now; does NOT touch updated_at (spec B3).
  await db.runAsync(
    'UPDATE prompts SET usage_count = usage_count + 1, last_used_at = ? WHERE id = ?',
    [Date.now(), id]
  );
}

// ---------------------------------------------------------------------------
// Bulk / counts / meta
// ---------------------------------------------------------------------------

export async function bulkInsert(prompts: ExportFilePrompt[]): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  const seen = new Set<string>();
  for (const p of prompts) {
    // Classification guarantees ids are new (created / created_new_id). A
    // duplicate id inside one file is malformed input — skip it rather than
    // crashing on the PRIMARY KEY constraint (mirrors the web backend guard).
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const row = buildImportRow(p, now);
    await db.runAsync(
      `INSERT INTO prompts ${INSERT_COLUMNS} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      rowToValues(row)
    );
  }
}

export async function countAll(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM prompts');
  return row?.count ?? 0;
}

// --- app_meta helpers (has_exported, samples_loaded, NSM counters, banner) ---

export async function getAppMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function setAppMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)',
    [key, value]
  );
}

export async function incrementAppMeta(key: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO app_meta (key, value) VALUES (?, '1')
     ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)`,
    [key]
  );
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
  listCategories,
  listTags,
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
