// app/(tabs)/recent.tsx — Recently Used tab.

import React from 'react';
import { PromptList } from '../../components/PromptList';
import { usePromptsContext } from '../../lib/PromptsContext';

export default function RecentTab() {
  const { recent, results, isSearching, query, loading } = usePromptsContext();

  return (
    <PromptList
      prompts={isSearching ? results : recent}
      loading={loading}
      isSearching={isSearching}
      query={query}
      icon="🕘"
      title="No recently used prompts"
      message="Prompts you copy (Fill & Copy or Quick Copy) will appear here for quick access."
    />
  );
}