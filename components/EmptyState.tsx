// components/EmptyState.tsx — actionable empty states (no prompts / no results).

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../lib/theme';

interface Props {
  icon?: string;
  title: string;
  message?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
}

export function EmptyState({
  icon = '📋',
  title,
  message,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {(primaryLabel || secondaryLabel) && (
        <View style={styles.actions}>
          {primaryLabel && onPrimary && (
            <Pressable
              onPress={onPrimary}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>{primaryLabel}</Text>
            </Pressable>
          )}
          {secondaryLabel && onSecondary && (
            <Pressable
              onPress={onSecondary}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryText}>{secondaryLabel}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 1.5,
    paddingHorizontal: spacing.xl,
  },
  icon: { fontSize: 44, marginBottom: spacing.lg },
  title: { ...typography.subtitle, textAlign: 'center' },
  message: {
    ...typography.bodySecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
    maxWidth: 280,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  secondaryText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
