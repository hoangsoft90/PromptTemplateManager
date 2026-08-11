// db/promptRepository.shared.ts — platform-agnostic business logic shared by
// the two storage implementations:
//   - promptRepository.sqlite.ts (iOS/Android → expo-sqlite)
//   - promptRepository.web.ts   (Web → localStorage)
//
// Keeping row mapping, normalization, row building and the search ranking
// tuple here means the business rules (spec PART B3/B5) live in exactly one
// place and the two backends cannot drift apart.

import * as Crypto from 'expo-crypto';
import { normalizeVietnamese } from '../lib/normalize';
import type {
  ExportFilePrompt,
  Prompt,
  PromptRow,
} from '../types/prompt';

// ---------------------------------------------------------------------------
// Public interface — every backend must implement exactly these functions.
// ---------------------------------------------------------------------------

export interface PromptRepository {
  createPrompt(input: {
    title: string;
    content: string;
    category?: string;
    tags?: string[];
  }): Promise<Prompt>;
  updatePrompt(
    id: string,
    patch: {
      title?: string;
      content?: string;
      category?: string;
      tags?: string[];
    }
  ): Promise<Prompt>;
  deletePrompt(id: string): Promise<void>;
  getPromptById(id: string): Promise<Prompt | null>;
  listAll(): Promise<Prompt[]>;
  listFavorites(limit?: number): Promise<Prompt[]>;
  listRecentlyUsed(limit?: number): Promise<Prompt[]>;
  searchPrompts(query: string): Promise<Prompt[]>;
  toggleFavorite(id: string): Promise<Prompt>;
  recordUsage(id: string): Promise<void>;
  bulkInsert(prompts: ExportFilePrompt[]): Promise<void>;
  countAll(): Promise<number>;
  getAppMeta(key: string): Promise<string | null>;
  setAppMeta(key: string, value: string): Promise<void>;
  incrementAppMeta(key: string): Promise<void>;
  hasEverExported(): Promise<boolean>;
  markExported(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

export function rowToPrompt(row: PromptRow): Prompt {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(row.tags);
    if (Array.isArray(parsed)) tags = parsed.map(String);
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    tags,
    isFavorite: row.is_favorite === 1,
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function computeSearchNormalized(title: string, content: string): string {
  return normalizeVietnamese(`${title} ${content}`);
}

// ---------------------------------------------------------------------------
// Row builders (spec B3 defaults: usage 0, last_used null, now timestamps)
// ---------------------------------------------------------------------------

/** Row for createPrompt — fresh UUID, zero usage. */
export function buildCreateRow(
  input: { title: string; content: string; category?: string; tags?: string[] },
  now: number = Date.now()
): PromptRow {
  return {
    id: Crypto.randomUUID(),
    title: input.title,
    content: input.content,
    category: input.category ?? '',
    tags: JSON.stringify(input.tags ?? []),
    is_favorite: 0,
    usage_count: 0,
    last_used_at: null,
    search_normalized: computeSearchNormalized(input.title, input.content),
    created_at: now,
    updated_at: now,
  };
}

/** Row for bulkInsert (import / sample seeding) — keeps the given id. */
export function buildImportRow(p: ExportFilePrompt, now: number = Date.now()): PromptRow {
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    category: p.category ?? '',
    tags: JSON.stringify(p.tags ?? []),
    is_favorite: p.isFavorite ? 1 : 0,
    usage_count: 0,
    last_used_at: null,
    search_normalized: computeSearchNormalized(p.title, p.content),
    created_at: now,
    updated_at: now,
  };
}

/** Column values in INSERT column order (shared by both backends). */
export function rowToValues(row: PromptRow): (string | number | null)[] {
  return [
    row.id,
    row.title,
    row.content,
    row.category,
    row.tags,
    row.is_favorite,
    row.usage_count,
    row.last_used_at,
    row.search_normalized,
    row.created_at,
    row.updated_at,
  ];
}

// ---------------------------------------------------------------------------
// Search ranking (spec B5 — dataset is small, sort in JS):
// 1. title starts-with query  2. title contains query  3. content contains query
// 4. usage_count DESC         5. last_used_at DESC (nulls last)
// ---------------------------------------------------------------------------

export function rankSearchResults(prompts: Prompt[], q: string): Prompt[] {
  prompts.sort((a, b) => {
    const aTitle = normalizeVietnamese(a.title);
    const bTitle = normalizeVietnamese(b.title);
    const aStarts = aTitle.startsWith(q);
    const bStarts = bTitle.startsWith(q);
    if (aStarts !== bStarts) return aStarts ? -1 : 1;

    const aTitleIn = aTitle.includes(q);
    const bTitleIn = bTitle.includes(q);
    if (aTitleIn !== bTitleIn) return aTitleIn ? -1 : 1;

    const aContentIn = normalizeVietnamese(a.content).includes(q);
    const bContentIn = normalizeVietnamese(b.content).includes(q);
    if (aContentIn !== bContentIn) return aContentIn ? -1 : 1;

    if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount;

    const aUsed = a.lastUsedAt ?? -1;
    const bUsed = b.lastUsedAt ?? -1;
    return bUsed - aUsed;
  });
  return prompts;
}
