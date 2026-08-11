// components/MissingState.tsx — fallback for screens reached with a stale
// deep link / param whose resource no longer exists (e.g. a prompt deleted
// after the link was opened). Always offers a safe way out, so there is never
// a dead end even when the header back button has no history to pop.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { safeBack } from '../lib/navigation';
import { colors, radius, spacing, typography } from '../lib/theme';

export function MissingState({
  message = 'This item no longer exists.',
}: {
  message?: string;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        onPress={() => safeBack()}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        accessibilityLabel="Go back"
      >
        <Text style={styles.buttonText}>Go back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  message: { ...typography.bodySecondary, textAlign: 'center', marginBottom: spacing.lg },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
