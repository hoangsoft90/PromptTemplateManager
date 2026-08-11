// __tests__/importExport.integration.test.ts — end-to-end import/export flow
// with REAL business logic (no mocks of the flow itself):
//
//   repository (web localStorage backend) → buildExportFile → exportJsonFile
//   readTextFile → parseImportFile → classifyImport → applyImport → repository
//
// Strategy (proven pattern from adGate.test.ts web test + fileIO.test.ts):
//   - `jest.resetModules()` re-requires react-native fresh, so we point the
//     freshly loaded Platform at 'web' BEFORE requiring the modules — the
//     facade then binds the real localStorage backend (all business logic
//     runs for real: row mapping, normalize, ranking, bulk insert).
//   - Top-level jest.mock factories survive resetModules and re-apply to the
//     fresh registry, so native modules (expo-file-system/sharing/sqlite/
//     crypto) stay safe under Node; the SQLite getDb() is lazy and never runs.
//   - fileIO's web path is driven with fetch/document/URL fakes like the
//     existing fileIO.test.ts.

import type { ExportFilePrompt } from '../types/prompt';

jest.mock('expo-crypto', () => ({
  randomUUID: () => `jest-uuid-${Math.random().toString(36).slice(2, 10)}`,
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn(),
  Paths: { cache: '/mock/cache' },
}));

jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn(),
}));

// Insurance: the facade statically imports the SQLite backend on every
// platform. Only the import needs to be safe under Node — getDb() is lazy.
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
  openDatabaseSync: jest.fn(),
}));

const originalDocument = (globalThis as any).document;
const originalURL = (globalThis as any).URL;

// Lazy refs — loaded only after Platform = web + localStorage are installed.
let repo: typeof import('../db/promptRepository');
let importExport: typeof import('../lib/importExport');
let fileIO: typeof import('../lib/fileIO');

function loadWebModules(): void {
  // Fresh registry → fresh react-native with the default (ios) Platform.
  jest.resetModules();
  const freshPlatform = require('react-native').Platform;
  jest.replaceProperty(freshPlatform, 'OS', 'web');

  fileIO = require('../lib/fileIO');
  repo = require('../db/promptRepository');
  importExport = require('../lib/importExport');
}

function installWebPlatform(): void {
  jest.restoreAllMocks(); // undo any previous replaceProperty(Platform.OS)
  jest.clearAllMocks();
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}

beforeEach(() => {
  installWebPlatform();
  loadWebModules();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers(); // safety net: the export test toggles fake timers
  delete (globalThis as any).localStorage;
  (globalThis as any).document = originalDocument;
  (globalThis as any).URL = originalURL;
  (globalThis as any).fetch = undefined;
});

/** readTextFile (web) reads via fetch — mock the file's body. */
function mockFetchFile(contents: string): void {
  (globalThis as any).fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => contents,
  });
}

/** Capture the Blob downloaded by exportJsonFile's web path. */
function captureDownload(): Blob[] {
  const downloaded: Blob[] = [];
  (globalThis as any).document = {
    createElement: jest.fn(() => ({ href: '', download: '', click: jest.fn() })),
    body: { appendChild: jest.fn(), removeChild: jest.fn() },
  };
  (globalThis as any).URL = {
    createObjectURL: jest.fn((blob: Blob) => {
      downloaded.push(blob);
      return 'blob:mock-export';
    }),
    revokeObjectURL: jest.fn(),
  };
  return downloaded;
}

function exportFile(prompts: (ExportFilePrompt | null)[]): string {
  return JSON.stringify({
    format: 'prompt-template-manager',
    version: 1,
    exportedAt: 123,
    prompts,
  });
}

describe('export flow (repository → buildExportFile → exportJsonFile)', () => {
  it('serializes the library to the backup format and downloads it', async () => {
    await repo.createPrompt({
      title: 'Alpha',
      content: 'Hello {{name}}',
      category: 'Dev',
      tags: ['a', 'b'],
    });
    await repo.createPrompt({ title: 'Beta', content: 'Plain copy', category: 'Writing' });

    const file = importExport.buildExportFile(await repo.listAll());
    expect(file.format).toBe('prompt-template-manager');
    expect(file.version).toBe(1);
    expect(file.prompts).toHaveLength(2);

    // Export strips runtime-only fields (spec B6).
    for (const p of file.prompts) {
      expect(p).not.toHaveProperty('usageCount');
      expect(p).not.toHaveProperty('lastUsedAt');
      expect(p).not.toHaveProperty('createdAt');
      expect(p).not.toHaveProperty('updatedAt');
      expect(p).not.toHaveProperty('search_normalized');
    }

    // Capture the actual downloaded Blob (web export path).
    jest.useFakeTimers();
    const downloaded = captureDownload();

    const json = JSON.stringify(file);
    await fileIO.exportJsonFile('backup.json', json);
    expect(downloaded).toHaveLength(1); // web path actually downloaded
    const contents = await downloaded[0].text();

    expect(contents).toBe(json);
    expect(importExport.parseImportFile(contents).ok).toBe(true); // round-trips

    jest.advanceTimersByTime(60_000); // release the revoke timer
    jest.useRealTimers();
  });
});

describe('import flow (readTextFile → parseImportFile → classifyImport → applyImport → repository)', () => {
  it('reads, classifies and applies a mixed file end-to-end', async () => {
    const seeded = await repo.createPrompt({ title: 'Existing', content: 'Hello {{name}}' });

    const incoming: ExportFilePrompt[] = [
      { id: 'new-1', title: 'Brand New', content: 'Fresh content', category: '', tags: [], isFavorite: false },
      { id: seeded.id, title: 'Existing', content: 'Hello {{name}}', category: '', tags: [], isFavorite: false }, // duplicate
      { id: seeded.id, title: 'Existing', content: 'CHANGED', category: '', tags: [], isFavorite: false }, // conflict
      { id: 'bad-title', title: '   ', content: 'x', category: '', tags: [], isFavorite: false }, // invalid
    ];
    const malformed = null as unknown as ExportFilePrompt;
    const raw = exportFile([...incoming, malformed]);

    mockFetchFile(raw);
    const text = await fileIO.readTextFile('blob:backup.json');
    expect(text).toBe(raw);

    const parsed = importExport.parseImportFile(text);
    if (!parsed.ok) throw new Error('expected valid backup');
    expect(parsed.file.prompts).toHaveLength(5);

    const outcomes = await importExport.classifyImport(parsed.file.prompts);
    expect(outcomes.map((o) => o.action)).toEqual([
      'created',
      'skipped_duplicate',
      'created_new_id',
      'invalid',
      'invalid',
    ]);

    const result = await importExport.applyImport(outcomes, parsed.file.prompts);
    expect(result).toEqual({ created: 2, skipped: 1, invalid: 2 });

    const all = await repo.listAll();
    expect(all).toHaveLength(3); // seed + 2 inserts; duplicate + invalids never inserted
    const conflicted = all.find((p) => p.content === 'CHANGED');
    expect(conflicted).toBeTruthy();
    expect(conflicted!.id).not.toBe(seeded.id); // fresh id, original content kept
    expect(await repo.countAll()).toBe(3);
  });

  it('re-importing a fully-created file is idempotent', async () => {
    const incoming: ExportFilePrompt[] = [
      { id: 'x1', title: 'X1', content: 'C1', category: '', tags: [], isFavorite: false },
      { id: 'x2', title: 'X2', content: 'C2', category: '', tags: [], isFavorite: false },
    ];

    const first = await importExport.classifyImport(incoming);
    expect(await importExport.applyImport(first, incoming)).toEqual({
      created: 2,
      skipped: 0,
      invalid: 0,
    });
    expect(await repo.countAll()).toBe(2);

    const again = await importExport.classifyImport(incoming);
    expect(again.every((o) => o.action === 'skipped_duplicate')).toBe(true);
    expect(await importExport.applyImport(again, incoming)).toEqual({
      created: 0,
      skipped: 2,
      invalid: 0,
    });
    expect(await repo.countAll()).toBe(2);
  });

  it('two same-id records inside one file insert only once (web bulkInsert guard)', async () => {
    const incoming: ExportFilePrompt[] = [
      { id: 'dup', title: 'A', content: 'A', category: '', tags: [], isFavorite: false },
      { id: 'dup', title: 'B', content: 'B', category: '', tags: [], isFavorite: false },
    ];

    const outcomes = await importExport.classifyImport(incoming);
    expect(outcomes.map((o) => o.action)).toEqual(['created', 'created']);
    expect(await importExport.applyImport(outcomes, incoming)).toEqual({
      created: 2,
      skipped: 0,
      invalid: 0,
    });
    // applyImport counted 2, but the storage guard keeps only the first id.
    expect(await repo.countAll()).toBe(1);
  });

  it('imported prompts are searchable with Vietnamese diacritics stripped (normalize integration)', async () => {
    const incoming: ExportFilePrompt[] = [
      {
        id: 'v1',
        title: 'Dữ liệu khách hàng',
        content: 'Báo cáo doanh thu {{thang}}',
        category: '',
        tags: [],
        isFavorite: false,
      },
    ];

    const outcomes = await importExport.classifyImport(incoming);
    await importExport.applyImport(outcomes, incoming);

    // buildImportRow recomputes search_normalized via normalizeVietnamese.
    expect((await repo.searchPrompts('du lieu')).map((p) => p.id)).toContain('v1');
    expect((await repo.searchPrompts('bao cao doanh thu')).map((p) => p.id)).toContain('v1');
  });
});

describe('export → fresh install → import round-trip', () => {
  it('restores title/content/tags/isFavorite exactly', async () => {
    const a = await repo.createPrompt({
      title: 'Alpha',
      content: 'Hello {{name}}',
      category: 'Dev',
      tags: ['x', 'y'],
    });
    await repo.toggleFavorite(a.id);
    await repo.recordUsage(a.id);

    const file = importExport.buildExportFile(await repo.listAll());
    const parsed = importExport.parseImportFile(JSON.stringify(file));
    if (!parsed.ok) throw new Error('expected valid backup');

    // Simulate a fresh install.
    (globalThis as any).localStorage.clear();

    const outcomes = await importExport.classifyImport(parsed.file.prompts);
    await importExport.applyImport(outcomes, parsed.file.prompts);

    const restored = await repo.listAll();
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe(a.id); // created-path import keeps the exported id
    expect(restored[0].title).toBe('Alpha');
    expect(restored[0].content).toBe('Hello {{name}}');
    expect(restored[0].category).toBe('Dev');
    expect(restored[0].tags).toEqual(['x', 'y']);
    expect(restored[0].isFavorite).toBe(true);
    // Usage/history are never exported, so they reset to defaults on import.
    expect(restored[0].usageCount).toBe(0);
    expect(restored[0].lastUsedAt).toBeNull();
  });
});
