// __tests__/promptRepository.web.test.ts — unit tests for the localStorage
// web backend (db/promptRepository.web.ts). These lock the shared business
// rules (spec PART B3/B5) for the web path: CRUD defaults, usage matrix,
// search ranking, app_meta semantics.

import * as repo from '../db/promptRepository.web';

/** Minimal in-memory localStorage shim (jsdom-less Node test env). */
function createLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
}

beforeEach(() => {
  jest.restoreAllMocks();
  // Every test gets a fresh store and a monotonically increasing clock so
  // ordering assertions (created_at DESC, updated_at DESC) are deterministic.
  let now = 1_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now++);
  (globalThis as any).localStorage = createLocalStorage();
});

afterEach(() => {
  delete (globalThis as any).localStorage;
  jest.restoreAllMocks();
});

async function create(
  overrides: Partial<{ title: string; content: string; category: string; tags: string[] }> = {}
) {
  return repo.createPrompt({
    title: 'Title',
    content: 'Content {{var}}',
    category: '',
    tags: [],
    ...overrides,
  });
}

describe('repository interface', () => {
  it('exposes the full PromptRepository surface', () => {
    expect(Object.keys(repo.repository).sort()).toEqual([
      'bulkInsert',
      'countAll',
      'createPrompt',
      'deletePrompt',
      'getAppMeta',
      'getPromptById',
      'hasEverExported',
      'incrementAppMeta',
      'listAll',
      'listFavorites',
      'listRecentlyUsed',
      'markExported',
      'recordUsage',
      'searchPrompts',
      'setAppMeta',
      'toggleFavorite',
      'updatePrompt',
    ]);
  });
});

describe('CRUD', () => {
  it('createPrompt stores with zero usage and computes search_normalized', async () => {
    const p = await repo.createPrompt({
      title: 'Cà phê',
      content: 'Đà Nẵng',
      category: 'Food',
      tags: ['vn'],
    });
    expect(p.id).toBeTruthy();
    expect(p.isFavorite).toBe(false);
    expect(p.usageCount).toBe(0);
    expect(p.lastUsedAt).toBeNull();

    const found = await repo.getPromptById(p.id);
    expect(found?.title).toBe('Cà phê');
    expect(found?.tags).toEqual(['vn']);
  });

  it('updatePrompt recomputes search_normalized and preserves usage', async () => {
    const p = await create({ title: 'Old' });
    const updated = await repo.updatePrompt(p.id, { title: 'Việt mới', content: 'Nội dung' });

    expect(updated.title).toBe('Việt mới');
    expect(updated.usageCount).toBe(0);
    expect(updated.updatedAt).toBeGreaterThan(p.createdAt);
    // "Việt mới Nội dung" normalizes to "viet moi noi dung" → searchable as "viet"
    expect((await repo.searchPrompts('viet')).map((x) => x.id)).toContain(p.id);
    // ...but the old title is gone from search
    expect((await repo.searchPrompts('old')).map((x) => x.id)).not.toContain(p.id);
  });

  it('updatePrompt throws when the id does not exist', async () => {
    await expect(repo.updatePrompt('nope', { title: 'X' })).rejects.toThrow('Prompt not found');
  });

  it('deletePrompt removes the row', async () => {
    const p = await create();
    await repo.deletePrompt(p.id);
    expect(await repo.getPromptById(p.id)).toBeNull();
    expect(await repo.countAll()).toBe(0);
  });

  it('getPromptById returns null for a missing id', async () => {
    expect(await repo.getPromptById('missing')).toBeNull();
  });
});

describe('listing', () => {
  it('listAll orders by created_at DESC', async () => {
    const a = await create({ title: 'A' });
    const b = await create({ title: 'B' });
    const c = await create({ title: 'C' });
    expect((await repo.listAll()).map((p) => p.id)).toEqual([c.id, b.id, a.id]);
  });

  it('listFavorites returns only favorites, updated_at DESC, honors limit', async () => {
    const a = await create({ title: 'A' });
    const b = await create({ title: 'B' });
    const c = await create({ title: 'C' });
    await repo.toggleFavorite(a.id);
    await repo.toggleFavorite(c.id); // updated later than a
    const favs = await repo.listFavorites(1);
    expect(favs.map((p) => p.id)).toEqual([c.id]);
    expect((await repo.listFavorites()).map((p) => p.id)).toEqual([c.id, a.id]);
    expect(await repo.getPromptById(b.id)).not.toBeNull();
  });

  it('listRecentlyUsed excludes never-used prompts and orders by last_used_at DESC', async () => {
    const a = await create({ title: 'A' }); // never used
    const b = await create({ title: 'B' });
    const c = await create({ title: 'C' });
    await repo.recordUsage(b.id);
    await repo.recordUsage(c.id); // used later than b
    const recent = await repo.listRecentlyUsed(5);
    expect(recent.map((p) => p.id)).toEqual([c.id, b.id]);
    expect(recent.map((p) => p.id)).not.toContain(a.id);
  });
});

describe('search (spec B5)', () => {
  it('matches Vietnamese without diacritics', async () => {
    await repo.createPrompt({ title: 'Đà Nẵng travel guide', content: 'Beaches' });
    expect((await repo.searchPrompts('da nang')).length).toBe(1);
    expect((await repo.searchPrompts('DA NANG')).length).toBe(1);
    expect((await repo.searchPrompts('beaches')).length).toBe(1);
  });

  it('returns [] for an empty query', async () => {
    await create();
    expect(await repo.searchPrompts('')).toEqual([]);
    expect(await repo.searchPrompts('   ')).toEqual([]);
  });

  it('ranks title starts-with above title contains above content contains', async () => {
    const contentOnly = await repo.createPrompt({ title: 'Other', content: 'find me here' });
    const contains = await repo.createPrompt({ title: 'My find Book', content: 'x' });
    const starts = await repo.createPrompt({ title: 'find Book', content: 'x' });
    const ids = (await repo.searchPrompts('find')).map((p) => p.id);
    expect(ids).toEqual([starts.id, contains.id, contentOnly.id]);
  });

  it('ranks by usage_count then last_used_at within the same tier', async () => {
    const low = await create({ title: 'Query one' });
    const high = await create({ title: 'Query two' });
    await repo.recordUsage(high.id);
    await repo.recordUsage(high.id); // usage 2
    await repo.recordUsage(low.id); // usage 1
    expect((await repo.searchPrompts('query')).map((p) => p.id)).toEqual([high.id, low.id]);
  });

  it('treats % and _ literally (no LIKE wildcard semantics)', async () => {
    await repo.createPrompt({ title: 'Discount 50%', content: 'x' });
    expect((await repo.searchPrompts('50%')).length).toBe(1);
    expect((await repo.searchPrompts('50_')).length).toBe(0);
  });
});

describe('usage & favorite matrix (spec B3)', () => {
  it('recordUsage increments usage and sets last_used_at without touching updated_at', async () => {
    const p = await create();
    const before = p.updatedAt;
    await repo.recordUsage(p.id);
    const after = await repo.getPromptById(p.id);
    expect(after?.usageCount).toBe(1);
    expect(after?.lastUsedAt).not.toBeNull();
    expect(after?.updatedAt).toBe(before);
  });

  it('recordUsage on a missing id is a silent no-op', async () => {
    await expect(repo.recordUsage('missing')).resolves.toBeUndefined();
  });

  it('toggleFavorite flips the flag and throws on a missing id', async () => {
    const p = await create();
    const fav = await repo.toggleFavorite(p.id);
    expect(fav.isFavorite).toBe(true);
    const unfav = await repo.toggleFavorite(p.id);
    expect(unfav.isFavorite).toBe(false);
    await expect(repo.toggleFavorite('missing')).rejects.toThrow('Prompt not found');
  });
});

describe('bulkInsert & counts', () => {
  it('bulkInsert creates rows with zero usage and imported ids', async () => {
    await repo.bulkInsert([
      { id: 'imp-1', title: 'Imported 1', content: 'x', category: '', tags: [], isFavorite: true },
      { id: 'imp-2', title: 'Imported 2', content: 'y', category: '', tags: [], isFavorite: false },
    ]);
    expect(await repo.countAll()).toBe(2);
    const imp1 = await repo.getPromptById('imp-1');
    expect(imp1?.isFavorite).toBe(true);
    expect(imp1?.usageCount).toBe(0);
    expect(imp1?.lastUsedAt).toBeNull();
  });
});

describe('app_meta', () => {
  it('get/set/overwrite round-trips', async () => {
    expect(await repo.getAppMeta('missing')).toBeNull();
    await repo.setAppMeta('k', 'v1');
    expect(await repo.getAppMeta('k')).toBe('v1');
    await repo.setAppMeta('k', 'v2');
    expect(await repo.getAppMeta('k')).toBe('v2');
  });

  it('incrementAppMeta starts at 1 and increments', async () => {
    await repo.incrementAppMeta('counter');
    await repo.incrementAppMeta('counter');
    expect(await repo.getAppMeta('counter')).toBe('2');
  });

  it('hasEverExported / markExported lifecycle', async () => {
    expect(await repo.hasEverExported()).toBe(false);
    await repo.markExported();
    expect(await repo.hasEverExported()).toBe(true);
  });
});
