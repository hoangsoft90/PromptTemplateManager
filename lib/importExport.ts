// lib/importExport.ts — JSON import/export (spec PART B6).
// Exact export format, 4-way conflict resolution, preview/confirm flow.

import * as Crypto from 'expo-crypto';
import { bulkInsert, listAll } from '../db/promptRepository';
import type {
  ExportFile,
  ExportFilePrompt,
  ImportOutcome,
  Prompt,
} from '../types/prompt';

export const EXPORT_FORMAT = 'prompt-template-manager';
export const EXPORT_VERSION = 1;

export function buildExportFile(prompts: Prompt[]): ExportFile {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    prompts: prompts.map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      category: p.category,
      tags: p.tags,
      isFavorite: p.isFavorite,
      // Never export: usage_count, last_used_at, search_normalized, created_at, updated_at
    })),
  };
}

export function parseImportFile(
  raw: string
): { ok: true; file: ExportFile } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'File does not contain a valid backup object.' };
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.format !== EXPORT_FORMAT) {
    return {
      ok: false,
      error: 'This file is not a Prompt Template Manager backup.',
    };
  }
  if (obj.version !== EXPORT_VERSION) {
    return {
      ok: false,
      error: `Unsupported backup version: ${String(obj.version)}. Expected version ${EXPORT_VERSION}.`,
    };
  }
  if (!Array.isArray(obj.prompts)) {
    return { ok: false, error: 'Backup file is missing the prompts list.' };
  }
  return {
    ok: true,
    file: {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: typeof obj.exportedAt === 'number' ? obj.exportedAt : Date.now(),
      prompts: obj.prompts as ExportFilePrompt[],
    },
  };
}

/**
 * Classify incoming records per the conflict-resolution table (spec B6):
 * 1. id exists + content identical        → skipped_duplicate
 * 2. id exists + content differs          → created_new_id (fresh UUID)
 * 3. id absent (even if content identical to another row) → created (duplicates allowed)
 * 4. missing title/content or malformed   → invalid (never inserted)
 *
 * `existing` is optional for testability (defaults to the live DB).
 */
export async function classifyImport(
  incoming: ExportFilePrompt[],
  existing?: Prompt[]
): Promise<ImportOutcome[]> {
  const base = existing ?? (await listAll());
  const byId = new Map(base.map((p) => [p.id, p]));

  return incoming.map((record, index): ImportOutcome => {
    if (!record || typeof record !== 'object') {
      return { action: 'invalid', index, reason: 'Malformed record: not an object.' };
    }
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    const content = typeof record.content === 'string' ? record.content : '';
    if (!title) {
      return { action: 'invalid', index, reason: 'Missing title.' };
    }
    if (!content) {
      return { action: 'invalid', index, reason: 'Missing content.' };
    }

    const existingPrompt = byId.get(record.id);
    if (existingPrompt) {
      if (existingPrompt.content === content) {
        return { action: 'skipped_duplicate', id: record.id };
      }
      return {
        action: 'created_new_id',
        originalId: record.id,
        newId: Crypto.randomUUID(),
      };
    }
    return { action: 'created', prompt: record };
  });
}

/**
 * Apply classified outcomes, inserting only the 'created' / 'created_new_id'
 * records. `incoming` is the original parsed prompt list so created_new_id
 * outcomes can re-attach their record content under the fresh id.
 */
export async function applyImport(
  outcomes: ImportOutcome[],
  incoming: ExportFilePrompt[]
): Promise<{ created: number; skipped: number; invalid: number }> {
  const toInsert: ExportFilePrompt[] = [];
  outcomes.forEach((outcome, index) => {
    if (outcome.action === 'created') {
      toInsert.push(outcome.prompt);
    } else if (outcome.action === 'created_new_id') {
      const source = incoming[index];
      if (source) {
        toInsert.push({ ...source, id: outcome.newId });
      }
    }
  });

  if (toInsert.length > 0) {
    await bulkInsert(toInsert);
  }

  return {
    created: toInsert.length,
    skipped: outcomes.filter((o) => o.action === 'skipped_duplicate').length,
    invalid: outcomes.filter((o) => o.action === 'invalid').length,
  };
}
