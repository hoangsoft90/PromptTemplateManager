// components/SectionHeader.tsx — section titles like "⭐ Favorites".

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../lib/theme';

interface Props {
  title: string;
  count?: number;
}

export function SectionHeader({ title, count }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {count !== undefined && <Text style={styles.count}>{count}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  title: { ...typography.subtitle, flexShrink: 1 },
  count: {
    ...typography.caption,
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
    overflow: 'hidden',
  },
});
