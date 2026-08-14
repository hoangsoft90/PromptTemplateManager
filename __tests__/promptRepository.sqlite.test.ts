// __tests__/promptRepository.sqlite.test.ts — runs the REAL SQLite backend
// (db/promptRepository.sqlite.ts) against an in-memory node:sqlite database.
//
// Why this exists: the web backend tests use String.includes and never touch
// the LIKE/ESCAPE clause — search on Android/iOS was previously unverified.
// A review suspected the ESCAPE literal had two backslashes ("ESCAPE
// expression must be a single character"); byte-level checks proved it is a
// single backslash, and this suite locks that behavior on real SQLite so it
// cannot regress silently again.
//
// We swap db/client's getDb for a node:sqlite-backed adapter that mimics the
// small expo-sqlite promise API the repository uses (runAsync / getFirstAsync
// / getAllAsync), so every search here runs the exact production SQL.

// The project types only jest (tsconfig `types: ["jest"]`) — no @types/node.
// Node builtins are required at runtime (Node ≥ 22) with minimal local types.
declare const require: (id: string) => unknown;
declare const __dirname: string;
const { readFileSync } = require('node:fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const { join } = require('node:path') as { join: (...parts: string[]) => string };
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (location: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      run(...params: unknown[]): unknown;
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
    };
    close(): void;
  };
};
import { getDb } from '../db/client';
import * as repo from '../db/promptRepository.sqlite';

jest.mock('../db/client', () => ({ getDb: jest.fn() }));

const mockGetDb = getDb as jest.Mock;

// Minimal adapter exposing the expo-sqlite promise surface used by the repo.
function createDb() {
  const db = new DatabaseSync(':memory:');
  const schema = readFileSync(
    join(__dirname, '../db/migrations/001_init.sql'),
    'utf8'
  );
  db.exec(schema);
  return {
    runAsync: (sql: string, params: unknown[] = []) => {
      db.prepare(sql).run(...params);
      return Promise.resolve();
    },
    getFirstAsync: <T>(sql: string, params: unknown[] = []) => {
      const row = db.prepare(sql).get(...params) as T | undefined;
      return Promise.resolve(row ?? null);
    },
    getAllAsync: <T>(sql: string, params: unknown[] = []) =>
      Promise.resolve(db.prepare(sql).all(...params) as T[]),
    close: () => db.close(),
  };
}

let handle: ReturnType<typeof createDb>;

beforeEach(() => {
  jest.clearAllMocks();
  handle = createDb();
  mockGetDb.mockResolvedValue(handle);
});

afterEach(() => {
  handle.close();
});

async function create(title: string, content = 'Content {{var}}') {
  return repo.createPrompt({ title, content, category: '', tags: [] });
}

describe('sqlite backend (real SQL)', () => {
  it('round-trips CRUD', async () => {
    const p = await create('Cà phê', 'Đà Nẵng');
    expect((await repo.getPromptById(p.id))?.title).toBe('Cà phê');
    expect(await repo.countAll()).toBe(1);
    await repo.updatePrompt(p.id, { title: 'Đổi tên' });
    expect((await repo.getPromptById(p.id))?.title).toBe('Đổi tên');
    await repo.deletePrompt(p.id);
    expect(await repo.countAll()).toBe(0);
  });

  it('searches with Vietnamese normalization on real SQL (ESCAPE clause valid)', async () => {
    await create('Đà Nẵng travel guide', 'Beaches and sun');
    // Runs the exact production LIKE ... ESCAPE '\' SQL. If the ESCAPE
    // literal ever becomes two backslashes, SQLite throws "ESCAPE
    // expression must be a single character" here.
    const results = await repo.searchPrompts('da nang');
    expect(results.map((p) => p.title)).toEqual(['Đà Nẵng travel guide']);
    expect((await repo.searchPrompts('DA NANG')).length).toBe(1);
    expect((await repo.searchPrompts('beaches')).length).toBe(1);
  });

  it('treats % and _ literally (no LIKE wildcard semantics)', async () => {
    await create('Discount 50%');
    await create('Other');
    const pct = await repo.searchPrompts('50%');
    expect(pct.map((p) => p.title)).toEqual(['Discount 50%']);
    expect((await repo.searchPrompts('50_')).length).toBe(0);
    // a literal underscore must not match a different character
    await repo.createPrompt({ title: 'a_b', content: 'x', category: '', tags: [] });
    await repo.createPrompt({ title: 'aXb', content: 'y', category: '', tags: [] });
    const underscore = await repo.searchPrompts('a_b');
    expect(underscore.map((p) => p.title)).toEqual(['a_b']);
  });

  it('returns [] for an empty query', async () => {
    await create('Anything');
    expect(await repo.searchPrompts('')).toEqual([]);
    expect(await repo.searchPrompts('   ')).toEqual([]);
  });

  it('searches category and tag keywords (search index includes them)', async () => {
    await repo.createPrompt({
      title: 'Email writer',
      content: 'Write a friendly email',
      category: 'Writing',
      tags: ['sales', 'outreach'],
    });
    // A keyword that only appears in category/tags (never title/content) must
    // still match — this is what migration v2 reindexes old rows to enable.
    expect((await repo.searchPrompts('writing')).map((p) => p.id)).toHaveLength(1);
    expect((await repo.searchPrompts('sales')).map((p) => p.id)).toHaveLength(1);
    expect((await repo.searchPrompts('outreach')).map((p) => p.id)).toHaveLength(1);
    expect((await repo.searchPrompts('nope')).map((p) => p.id)).toHaveLength(0);
  });

  it('lists distinct non-empty categories and tags', async () => {
    await repo.createPrompt({ title: 'A', content: 'x', category: 'Writing', tags: ['dev', 'email'] });
    await repo.createPrompt({ title: 'B', content: 'x', category: 'dev', tags: ['email', 'Work'] });
    await repo.createPrompt({ title: 'C', content: 'x', category: '', tags: [] }); // skipped
    expect(await repo.listCategories()).toEqual(['dev', 'Writing']);
    expect(await repo.listTags()).toEqual(['dev', 'email', 'Work']);
  });
});
