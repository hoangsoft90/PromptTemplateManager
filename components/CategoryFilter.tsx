// components/CategoryFilter.tsx — horizontal category filter chips for the
// Home tab. "All" + every existing category (from listCategories, refreshed by
// usePrompts.reload). Composes with the search bar: query + category both
// narrow the list. Renders nothing when there are no categories yet.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing } from '../lib/theme';

interface Props {
  categories: string[];
  /** '' = All (no filter). */
  selected: string;
  onSelect: (category: string) => void;
}

export function CategoryFilter({ categories, selected, onSelect }: Props) {
  if (categories.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
      accessibilityLabel="Filter by category"
    >
      {['', ...categories].map((cat) => {
        const active = cat === selected;
        return (
          <Pressable
            key={cat || 'all'}
            onPress={() => onSelect(active ? '' : cat)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityLabel={cat ? `Filter by ${cat}` : 'Filter by all'}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {cat || 'All'}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.sm },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: '#FFFFFF' },
});
