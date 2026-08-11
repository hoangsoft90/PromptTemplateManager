// components/ImportPreviewList.tsx — new/skipped/invalid breakdown with
// expandable invalid-reason rows (spec B6 preview screen).

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../lib/theme';
import type { ImportOutcome } from '../types/prompt';

interface Props {
  outcomes: ImportOutcome[];
}

export function ImportPreviewList({ outcomes }: Props) {
  const [expanded, setExpanded] = useState(false);

  const counts = useMemo(() => {
    let created = 0;
    let skipped = 0;
    let invalid = 0;
    for (const o of outcomes) {
      if (o.action === 'created' || o.action === 'created_new_id') created += 1;
      else if (o.action === 'skipped_duplicate') skipped += 1;
      else invalid += 1;
    }
    return { created, skipped, invalid };
  }, [outcomes]);

  const invalidRows = useMemo(
    () => outcomes.filter((o): o is Extract<ImportOutcome, { action: 'invalid' }> => o.action === 'invalid'),
    [outcomes]
  );

  const summaryParts = [
    `${counts.created} new`,
    `${counts.skipped} skipped (duplicate)`,
    `${counts.invalid} invalid`,
  ];

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        {summaryParts.map((part, i) => (
          <View key={part} style={styles.chip}>
            <Text style={styles.chipText}>{part}</Text>
            {i < summaryParts.length - 1 ? <Text style={styles.dot}>·</Text> : null}
          </View>
        ))}
      </View>

      {invalidRows.length > 0 && (
        <>
          <Pressable onPress={() => setExpanded((e) => !e)} style={styles.expandRow} hitSlop={6}>
            <Text style={styles.expandLabel}>
              {expanded ? 'Hide' : 'Show'} invalid records ({invalidRows.length})
            </Text>
            <Text style={styles.expandCaret}>{expanded ? '▲' : '▼'}</Text>
          </Pressable>
          {expanded && (
            <ScrollView style={styles.invalidList}>
              {invalidRows.map((o) => (
                <View key={`${o.index}`} style={styles.invalidRow}>
                  <Text style={styles.invalidIndex}>#{o.index + 1}</Text>
                  <Text style={styles.invalidReason}>{o.reason}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  dot: { marginLeft: spacing.sm, color: colors.textMuted },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  expandLabel: { ...typography.bodySecondary, color: colors.primary, fontWeight: '600' },
  expandCaret: { color: colors.primary, fontSize: 12 },
  invalidList: { maxHeight: 160, marginTop: spacing.xs },
  invalidRow: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  invalidIndex: { fontSize: 13, fontWeight: '700', color: colors.danger },
  invalidReason: { flex: 1, fontSize: 13, color: colors.textSecondary },
});
