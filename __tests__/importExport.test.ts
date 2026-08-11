import {
  buildExportFile,
  classifyImport,
  parseImportFile,
} from '../lib/importExport';
import type { ExportFilePrompt, Prompt } from '../types/prompt';

function makePrompt(overrides: Partial<Prompt>): Prompt {
  return {
    id: 'p1',
    title: 'Title',
    content: 'Content A',
    category: '',
    tags: [],
    isFavorite: false,
    usageCount: 3,
    lastUsedAt: 123,
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

function makeIncoming(overrides: Partial<ExportFilePrompt>): ExportFilePrompt {
  return {
    id: 'p1',
    title: 'Title',
    content: 'Content A',
    category: '',
    tags: [],
    isFavorite: false,
    ...overrides,
  };
}

describe('buildExportFile', () => {
  it('excludes derived/local-only fields', () => {
    const file = buildExportFile([makePrompt({})]);
    const record = file.prompts[0];
    expect(record).toEqual({
      id: 'p1',
      title: 'Title',
      content: 'Content A',
      category: '',
      tags: [],
      isFavorite: false,
    });
    expect(record).not.toHaveProperty('usageCount');
    expect(record).not.toHaveProperty('usage_count');
    expect(record).not.toHaveProperty('lastUsedAt');
    expect(record).not.toHaveProperty('last_used_at');
    expect(record).not.toHaveProperty('search_normalized');
    expect(record).not.toHaveProperty('createdAt');
    expect(record).not.toHaveProperty('updatedAt');
  });
});

describe('parseImportFile', () => {
  it('rejects non-JSON input', () => {
    const result = parseImportFile('not json{{{');
    expect(result.ok).toBe(false);
  });

  it('rejects wrong format', () => {
    const result = parseImportFile(JSON.stringify({ format: 'other-app', version: 1, prompts: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('not a Prompt Template Manager backup');
  });

  it('rejects unsupported version', () => {
    const result = parseImportFile(
      JSON.stringify({ format: 'prompt-template-manager', version: 99, prompts: [] })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Unsupported backup version');
  });

  it('accepts a valid export file', () => {
    const result = parseImportFile(
      JSON.stringify({ format: 'prompt-template-manager', version: 1, exportedAt: 123, prompts: [] })
    );
    expect(result.ok).toBe(true);
  });
});

describe('classifyImport conflict resolution', () => {
  it('skips duplicate id + identical content', async () => {
    const outcomes = await classifyImport([makeIncoming({})], [makePrompt({})]);
    expect(outcomes[0]).toEqual({ action: 'skipped_duplicate', id: 'p1' });
  });

  it('assigns a new id when id exists but content differs', async () => {
    const outcomes = await classifyImport(
      [makeIncoming({ content: 'Content B' })],
      [makePrompt({})]
    );
    expect(outcomes[0].action).toBe('created_new_id');
    if (outcomes[0].action === 'created_new_id') {
      expect(outcomes[0].originalId).toBe('p1');
      expect(outcomes[0].newId).not.toBe('p1');
    }
  });

  it('imports when id absent even if identical content exists elsewhere', async () => {
    const outcomes = await classifyImport(
      [makeIncoming({ id: 'new-id' })],
      [makePrompt({})]
    );
    expect(outcomes[0]).toEqual({ action: 'created', prompt: expect.objectContaining({ id: 'new-id' }) });
  });

  it('marks records missing title/content as invalid with a reason', async () => {
    const outcomes = await classifyImport(
      [makeIncoming({ title: '', content: 'x' }), makeIncoming({ content: '' })],
      []
    );
    expect(outcomes[0]).toEqual({ action: 'invalid', index: 0, reason: 'Missing title.' });
    expect(outcomes[1]).toEqual({ action: 'invalid', index: 1, reason: 'Missing content.' });
  });

  it('handles malformed entries as invalid', async () => {
    const outcomes = await classifyImport([null as unknown as ExportFilePrompt], []);
    expect(outcomes[0].action).toBe('invalid');
  });
});
