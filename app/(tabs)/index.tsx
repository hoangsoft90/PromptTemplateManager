// app/(tabs)/index.tsx — All Prompts tab (default).

import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { EmptyState } from '../../components/EmptyState';
import { PromptList } from '../../components/PromptList';
import { usePromptsContext } from '../../lib/PromptsContext';

export default function AllPromptsTab() {
  const { all, results, isSearching, query, loading } = usePromptsContext();

  // Empty library (and not searching) → centered Create / Import CTA.
  if (!isSearching && all.length === 0) {
    return (
      <View style={styles.center}>
        {!loading && (
          <EmptyState
            icon="📋"
            title="Your prompt library is empty"
            message="Turn your repeated AI instructions into reusable templates with {{variables}}."
            primaryLabel="Create prompt"
            secondaryLabel="Import"
            onPrimary={() => router.push('/prompt/new')}
            onSecondary={() => router.push('/settings')}
          />
        )}
      </View>
    );
  }

  return (
    <PromptList
      prompts={isSearching ? results : all}
      loading={loading}
      isSearching={isSearching}
      query={query}
      icon="📋"
      title="Your prompt library is empty"
      message="Turn your repeated AI instructions into reusable templates with {{variables}}."
      primaryLabel="Create prompt"
      secondaryLabel="Import"
      onPrimary={() => router.push('/prompt/new')}
      onSecondary={() => router.push('/settings')}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
});