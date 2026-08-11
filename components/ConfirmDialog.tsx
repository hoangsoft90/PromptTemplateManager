// components/ConfirmDialog.tsx — confirmation modal (e.g. delete).

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../lib/theme';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={[styles.buttonText, styles.cancelText]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                destructive ? styles.destructiveButton : styles.confirmButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.45)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  title: { ...typography.subtitle, marginBottom: spacing.sm },
  message: { ...typography.bodySecondary, lineHeight: 20, marginBottom: spacing.xl },
  actions: { flexDirection: 'row', gap: spacing.md },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  pressed: { opacity: 0.85 },
  cancelButton: { backgroundColor: colors.background },
  destructiveButton: { backgroundColor: colors.danger },
  confirmButton: { backgroundColor: colors.primary },
  buttonText: { fontSize: 15, fontWeight: '600' },
  cancelText: { color: colors.textPrimary },
  confirmText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
