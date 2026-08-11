// app/(tabs)/favorites.tsx — Favorites tab.

import { router } from 'expo-router';
import React from 'react';
import { PromptList } from '../../components/PromptList';
import { usePromptsContext } from '../../lib/PromptsContext';

export default function FavoritesTab() {
  const { favorites, results, isSearching, query, loading } = usePromptsContext();

  return (
    <PromptList
      prompts={isSearching ? results : favorites}
      loading={loading}
      isSearching={isSearching}
      query={query}
      icon="⭐"
      title="No favorites yet"
      message="Tap the ☆ on any prompt to mark it as a favorite — it'll show up here."
      primaryLabel="Browse prompts"
      onPrimary={() => router.navigate('/(tabs)')}
    />
  );
}