// __tests__/usePrompts.test.tsx — locks the search/filter state (the real
// "search filter" of the list flow): an empty query loads the three lists,
// a non-empty query goes through searchPrompts, clearing returns to lists,
// and whitespace-only input is never "searching".

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { usePrompts } from '../hooks/usePrompts';
import {
  listAll,
  listCategories,
  listFavorites,
  listRecentlyUsed,
  searchPrompts,
} from '../db/promptRepository';
import type { Prompt } from '../types/prompt';

jest.mock('../db/promptRepository', () => ({
  listAll: jest.fn(),
  listCategories: jest.fn(),
  listFavorites: jest.fn(),
  listRecentlyUsed: jest.fn(),
  searchPrompts: jest.fn(),
  toggleFavorite: jest.fn(),
  deletePrompt: jest.fn(),
}));

const mockListAll = listAll as jest.Mock;
const mockListCategories = listCategories as jest.Mock;
const mockListFavorites = listFavorites as jest.Mock;
const mockListRecentlyUsed = listRecentlyUsed as jest.Mock;
const mockSearchPrompts = searchPrompts as jest.Mock;

const p1: Prompt = {
  id: 'p1',
  title: 'Email Writer',
  content: 'Write an email.',
  category: 'Writing',
  tags: ['email'],
  isFavorite: true,
  usageCount: 0,
  lastUsedAt: null,
  createdAt: 1,
  updatedAt: 2,
};

const p2: Prompt = {
  id: 'p2',
  title: 'Code Reviewer',
  content: 'Review code.',
  category: 'Dev',
  tags: [],
  isFavorite: false,
  usageCount: 0,
  lastUsedAt: null,
  createdAt: 3,
  updatedAt: 4,
};

type HookResult = ReturnType<typeof usePrompts>;
let result!: HookResult;

function Harness() {
  result = usePrompts();
  return null;
}

async function renderHook(): Promise<void> {
  await act(async () => {
    renderer.create(<Harness />);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListAll.mockResolvedValue([p1, p2]);
  mockListCategories.mockResolvedValue(['Dev', 'Writing']);
  mockListFavorites.mockResolvedValue([p1]);
  mockListRecentlyUsed.mockResolvedValue([p2]);
  mockSearchPrompts.mockResolvedValue([p1]);
});

describe('usePrompts search/filter', () => {
  it('loads the three lists on mount with an empty query', async () => {
    await renderHook();

    expect(mockListAll).toHaveBeenCalledTimes(1);
    expect(mockListFavorites).toHaveBeenCalledWith(5);
    expect(mockListRecentlyUsed).toHaveBeenCalledWith(5);
    expect(result.all).toEqual([p1, p2]);
    expect(result.favorites).toEqual([p1]);
    expect(result.recent).toEqual([p2]);
    expect(result.loading).toBe(false);
    expect(result.isSearching).toBe(false);
  });

  it('routes a non-empty query through searchPrompts and flags isSearching', async () => {
    await renderHook();

    await act(async () => {
      result.setQuery('email');
    });

    expect(mockSearchPrompts).toHaveBeenCalledWith('email');
    expect(result.results).toEqual([p1]);
    expect(result.isSearching).toBe(true);
    expect(mockListAll).toHaveBeenCalledTimes(1); // lists untouched by search
  });

  it('clearing the query returns to the full lists', async () => {
    await renderHook();
    await act(async () => {
      result.setQuery('email');
    });
    expect(result.isSearching).toBe(true);

    await act(async () => {
      result.setQuery('');
    });

    expect(result.isSearching).toBe(false);
    expect(mockListAll).toHaveBeenCalledTimes(2); // reload on mount + after clear
    expect(result.all).toEqual([p1, p2]);
  });

  it('treats a whitespace-only query as not searching', async () => {
    await renderHook();

    await act(async () => {
      result.setQuery('   ');
    });

    expect(result.isSearching).toBe(false);
    expect(mockSearchPrompts).not.toHaveBeenCalled();
  });

  it('clears results and finishes loading when search fails (no unhandled rejection)', async () => {
    mockSearchPrompts.mockRejectedValue(new Error('db boom'));
    await renderHook();

    await act(async () => {
      result.setQuery('email');
    });

    expect(result.results).toEqual([]);
    expect(result.loading).toBe(false);
  });

  it('loads categories on mount and narrows filteredAll by categoryFilter', async () => {
    await renderHook();

    expect(mockListCategories).toHaveBeenCalledTimes(1);
    expect(result.categories).toEqual(['Dev', 'Writing']);
    expect(result.filteredAll).toEqual([p1, p2]); // no filter → everything

    await act(async () => {
      result.setCategoryFilter('Writing');
    });

    expect(result.filteredAll).toEqual([p1]); // p1.category === 'Writing'
    expect(mockListAll).toHaveBeenCalledTimes(2); // reload on filter change
  });

  it('composes category filter with search results', async () => {
    await renderHook();
    await act(async () => {
      result.setCategoryFilter('Dev');
    });

    await act(async () => {
      result.setQuery('email');
    });

    // searchPrompts returns [p1] (category 'Writing'); the 'Dev' filter drops it.
    expect(mockSearchPrompts).toHaveBeenCalledWith('email');
    expect(result.results).toEqual([]);
    expect(result.isSearching).toBe(true);
  });

  it('clearing the category filter restores the full list', async () => {
    await renderHook();
    await act(async () => {
      result.setCategoryFilter('Writing');
    });
    expect(result.filteredAll).toEqual([p1]);

    await act(async () => {
      result.setCategoryFilter('');
    });

    expect(result.filteredAll).toEqual([p1, p2]);
  });
});
