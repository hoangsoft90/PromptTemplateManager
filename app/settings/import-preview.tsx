// app/settings/import-preview.tsx — preview/confirm import (spec B6).

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ImportPreviewList } from '../../components/ImportPreviewList';
import { MissingState } from '../../components/MissingState';
import { useToast } from '../../components/Toast';
import { applyImport } from '../../lib/importExport';
import { clearPendingImport, getPendingImport } from '../../lib/importSession';
import { safeBack } from '../../lib/navigation';
import { colors, radius, spacing, typography } from '../../lib/theme';

export default function ImportPreviewScreen() {
  const toast = useToast();
  const [applying, setApplying] = useState(false);

  const pending = useMemo(() => getPendingImport(), []);

  const handleImport = useCallback(async () => {
    if (!pending) return;
    setApplying(true);
    try {
      const result = await applyImport(pending.outcomes, pending.incoming);
      clearPendingImport();
      toast.show(`Imported ${result.created} prompts`);
      safeBack(); // back to Settings (safe even if deep-linked here)
    } catch {
      toast.show('Import failed');
      setApplying(false);
    }
  }, [pending, toast]);

  if (!pending) {
    // Deep link straight to the preview (no pending session): safe way out.
    return <MissingState message="No import in progress." />;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>
          {pending.fileName} — ready to import
        </Text>
        <ImportPreviewList outcomes={pending.outcomes} />
        <Text style={styles.note}>
          Prompts marked “new” will be added to your library. Duplicates are skipped;
          invalid records are never inserted.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => {
            clearPendingImport();
            safeBack();
          }}
          style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleImport}
          disabled={applying}
          style={({ pressed }) => [styles.importButton, applying && styles.disabled, pressed && styles.pressed]}
          accessibilityLabel="Confirm import"
        >
          <Text style={styles.importText}>{applying ? 'Importing…' : 'Import'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 120 },
  heading: { ...typography.title, marginBottom: spacing.lg },
  note: { ...typography.caption, lineHeight: 18, marginTop: spacing.xs },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  cancelText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  importButton: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  importText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});
