// app/(tabs)/index.tsx — All Prompts tab (default).
// Category filter chips (from usePrompts) narrow the list and compose with
// the search bar; an active filter with zero matches gets its own empty
// state instead of the create/import CTA.

import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CategoryFilter } from '../../components/CategoryFilter';
import { EmptyState } from '../../components/EmptyState';
import { PromptList } from '../../components/PromptList';
import { usePromptsContext } from '../../lib/PromptsContext';

export default function AllPromptsTab() {
  const {
    all,
    filteredAll,
    results,
    isSearching,
    query,
    loading,
    categories,
    categoryFilter,
    setCategoryFilter,
  } = usePromptsContext();

  // Truly empty library (and not searching) → centered Create / Import CTA.
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

  // While searching, results are already narrowed by category in usePrompts.
  const shown = isSearching ? results : filteredAll;
  // An active category with no matches is "no prompts here", not an empty library.
  const filteredEmpty = !isSearching && !!categoryFilter && shown.length === 0;
  const emptyProps = filteredEmpty
    ? {
        title: 'No prompts in this category',
        message: `Nothing tagged “${categoryFilter}” yet. Pick another category or clear the filter.`,
      }
    : {
        title: 'Your prompt library is empty',
        message: 'Turn your repeated AI instructions into reusable templates with {{variables}}.',
        primaryLabel: 'Create prompt',
        secondaryLabel: 'Import',
        onPrimary: () => router.push('/prompt/new'),
        onSecondary: () => router.push('/settings'),
      };

  return (
    <View style={styles.container}>
      {!isSearching && (
        <CategoryFilter
          categories={categories}
          selected={categoryFilter}
          onSelect={setCategoryFilter}
        />
      )}
      <PromptList
        prompts={shown}
        loading={loading}
        isSearching={isSearching}
        query={query}
        icon="📋"
        {...emptyProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center' },
});
