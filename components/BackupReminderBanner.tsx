// components/BackupReminderBanner.tsx — non-blocking single-line banner (spec B7).

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../lib/theme';

interface Props {
  onExport: () => void;
  onDismiss: () => void;
}

export function BackupReminderBanner({ onExport, onDismiss }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>💾 Your prompts live only on this device.</Text>
      <Pressable onPress={onExport} hitSlop={8} accessibilityLabel="Export now">
        <Text style={styles.action}>Export now</Text>
      </Pressable>
      <Pressable onPress={onDismiss} hitSlop={8} accessibilityLabel="Dismiss reminder">
        <Text style={styles.dismiss}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.warningSoft,
    borderColor: '#FEDF89',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  text: { flex: 1, fontSize: 13, color: colors.warning, fontWeight: '500' },
  action: { fontSize: 13, fontWeight: '700', color: colors.warning },
  dismiss: { fontSize: 13, color: colors.warning, opacity: 0.7, padding: spacing.xs },
});
