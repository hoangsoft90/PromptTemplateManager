// hooks/usePrompts.ts — list/search state for the Home screen.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deletePrompt as deletePromptRepo,
  listAll,
  listCategories,
  listFavorites,
  listRecentlyUsed,
  searchPrompts,
  toggleFavorite as toggleFavoriteRepo,
} from '../db/promptRepository';
import type { Prompt } from '../types/prompt';

// Narrow a list to the selected category ('' = no filter) — used for both the
// browse list and search results so the rule lives in exactly one place.
function narrowByCategory(list: Prompt[], category: string): Prompt[] {
  return category ? list.filter((p) => p.category === category) : list;
}

export function usePrompts() {
  const [all, setAll] = useState<Prompt[]>([]);
  const [favorites, setFavorites] = useState<Prompt[]>([]);
  const [recent, setRecent] = useState<Prompt[]>([]);
  const [results, setResults] = useState<Prompt[]>([]);
  const [query, setQuery] = useState('');
  // '' = no filter; otherwise only prompts with this exact category.
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [a, f, r, cats] = await Promise.all([
      listAll(),
      listFavorites(5),
      listRecentlyUsed(5),
      listCategories(),
    ]);
    setAll(a);
    setFavorites(f);
    setRecent(r);
    setCategories(cats);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (query.trim()) {
          // Category filter composes with search: results are narrowed to the
          // selected category (empty = all). Filtering in JS is fine at this
          // scale and keeps the repo search signature unchanged.
          const found = await searchPrompts(query);
          if (!cancelled) setResults(narrowByCategory(found, categoryFilter));
        } else {
          await reload();
        }
      } catch {
        // A search/list failure must not surface as an unhandled rejection
        // nor leave stale results for the current query — clear results and
        // let the list state stand as-is.
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, categoryFilter, reload]);

  const toggleFavorite = useCallback(
    async (id: string) => {
      const updated = await toggleFavoriteRepo(id);
      // Patch local state so the UI updates immediately, including search results.
      setAll((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setFavorites((prev) => {
        const without = prev.filter((p) => p.id !== id);
        return updated.isFavorite ? [updated, ...without].slice(0, 5) : without;
      });
      setRecent((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setResults((prev) => prev.map((p) => (p.id === id ? updated : p)));
      await reload();
    },
    [reload]
  );

  const deletePrompt = useCallback(
    async (id: string) => {
      await deletePromptRepo(id);
      await reload();
    },
    [reload]
  );

  const isSearching = useMemo(() => query.trim().length > 0, [query]);

  // The All tab shows this instead of `all` — narrowed by categoryFilter.
  const filteredAll = useMemo(() => narrowByCategory(all, categoryFilter), [all, categoryFilter]);

  return {
    all,
    favorites,
    recent,
    results,
    query,
    setQuery,
    categoryFilter,
    setCategoryFilter,
    categories,
    filteredAll,
    loading,
    isSearching,
    reload,
    toggleFavorite,
    deletePrompt,
  };
}
