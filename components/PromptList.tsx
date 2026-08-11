// components/PromptList.tsx — shared FlatList of PromptCards for the 3 tabs.
// Handles quick copy, fill navigation, favorite toggle, and empty states
// (both "no results" while searching and per-tab empty messages).

import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import React, { useCallback } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { incrementAppMeta, recordUsage } from '../db/promptRepository';
import { onCopyComplete } from '../lib/adGateStore';
import { usePromptsContext } from '../lib/PromptsContext';
import { spacing } from '../lib/theme';
import type { Prompt } from '../types/prompt';
import { EmptyState } from './EmptyState';
import { PromptCard } from './PromptCard';
import { useToast } from './Toast';

interface EmptyStateProps {
  icon: string;
  title: string;
  message: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
}

interface Props extends EmptyStateProps {
  prompts: Prompt[];
  loading: boolean;
  isSearching: boolean;
  query: string;
}

export function PromptList({
  prompts,
  loading,
  isSearching,
  query,
  ...empty
}: Props) {
  const { reload, toggleFavorite } = usePromptsContext();
  const toast = useToast();

  const quickCopy = useCallback(
    async (prompt: Prompt) => {
      try {
        await Clipboard.setStringAsync(prompt.content);
        await recordUsage(prompt.id);
        await incrementAppMeta('nsm_quick_copy_count');
        toast.show(prompt.content.includes('{{') ? 'Template copied!' : 'Copied!');
        void reload();
        void onCopyComplete();
      } catch {
        toast.show('Copy failed');
      }
    },
    [toast, reload]
  );

  const goToFill = useCallback((prompt: Prompt) => {
    router.push({ pathname: '/prompt/[id]/fill', params: { id: prompt.id } });
  }, []);

  const renderCard = useCallback(
    ({ item }: { item: Prompt }) => (
      <PromptCard
        prompt={item}
        onPress={() => router.push({ pathname: '/prompt/[id]', params: { id: item.id } })}
        onQuickCopy={() => quickCopy(item)}
        onFillCopy={() => goToFill(item)}
        onFavoriteToggle={() => toggleFavorite(item.id)}
      />
    ),
    [quickCopy, goToFill, toggleFavorite]
  );

  const emptyComponent = () => {
    if (loading) return null;
    if (isSearching) {
      return (
        <EmptyState
          icon="🔎"
          title="No matching prompts"
          message={`Nothing found for “${query.trim()}”. Try fewer or different words.`}
        />
      );
    }
    return (
      <EmptyState
        icon={empty.icon}
        title={empty.title}
        message={empty.message}
        primaryLabel={empty.primaryLabel}
        secondaryLabel={empty.secondaryLabel}
        onPrimary={empty.onPrimary}
        onSecondary={empty.onSecondary}
      />
    );
  };

  return (
    <FlatList
      data={prompts}
      keyExtractor={(item) => item.id}
      renderItem={renderCard}
      contentContainerStyle={[
        styles.content,
        prompts.length === 0 && styles.emptyContent,
      ]}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={emptyComponent}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 120 },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
});