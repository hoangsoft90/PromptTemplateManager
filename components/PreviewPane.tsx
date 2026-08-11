// components/PreviewPane.tsx — read-only rendered prompt text (monospace).

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../lib/theme';

interface Props {
  text: string;
  emptyHint?: string;
}

export function PreviewPane({ text, emptyHint = 'Fill in the fields above to see a live preview.' }: Props) {
  const isEmpty = text.trim().length === 0;
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Preview</Text>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {isEmpty ? (
          <Text style={styles.emptyHint}>{emptyHint}</Text>
        ) : (
          <Text style={styles.text} selectable>
            {text}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F1220',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  heading: {
    color: '#A5B4FC',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  scroll: { maxHeight: 280 },
  scrollContent: { padding: spacing.lg },
  text: {
    ...typography.mono,
    color: '#E5E7EB',
    fontSize: 14,
    lineHeight: 21,
  },
  emptyHint: { ...typography.bodySecondary, fontStyle: 'italic' },
});
