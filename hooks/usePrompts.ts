// hooks/usePrompts.ts — list/search state for the Home screen.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deletePrompt as deletePromptRepo,
  listAll,
  listFavorites,
  listRecentlyUsed,
  searchPrompts,
  toggleFavorite as toggleFavoriteRepo,
} from '../db/promptRepository';
import type { Prompt } from '../types/prompt';

export function usePrompts() {
  const [all, setAll] = useState<Prompt[]>([]);
  const [favorites, setFavorites] = useState<Prompt[]>([]);
  const [recent, setRecent] = useState<Prompt[]>([]);
  const [results, setResults] = useState<Prompt[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [a, f, r] = await Promise.all([
      listAll(),
      listFavorites(5),
      listRecentlyUsed(5),
    ]);
    setAll(a);
    setFavorites(f);
    setRecent(r);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (query.trim()) {
          setResults(await searchPrompts(query));
        } else {
          await reload();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, reload]);

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

  return {
    all,
    favorites,
    recent,
    results,
    query,
    setQuery,
    loading,
    isSearching,
    reload,
    toggleFavorite,
    deletePrompt,
  };
}
