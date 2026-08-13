// components/PromptForm.tsx — shared editor form (create + edit).
// Title/Content required; Category optional; Tags comma-separated → array.
// Soft-warning for unclosed variables (non-blocking, spec C5).

import * as Clipboard from 'expo-clipboard';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { findUnclosedVariable } from '../lib/variableEngine';
import { colors, radius, spacing, typography } from '../lib/theme';
import type { Prompt } from '../types/prompt';
import { DisabledStateHelper } from './DisabledStateHelper';

export interface PromptFormValues {
  title: string;
  content: string;
  category: string;
  tags: string[];
}

interface Props {
  initial?: Prompt;
  submitLabel: string;
  onSubmit: (values: PromptFormValues) => void;
  onCancel: () => void;
  /** Enable the "Paste & Create" shortcut (New Prompt screen only). */
  enablePasteToCreate?: boolean;
}

export function PromptForm({ initial, submitLabel, onSubmit, onCancel, enablePasteToCreate }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [tagsInput, setTagsInput] = useState(initial?.tags.join(', ') ?? '');
  const [pasteNotice, setPasteNotice] = useState(false);

  const unclosed = useMemo(() => findUnclosedVariable(content), [content]);
  const canSave = title.trim().length > 0 && content.trim().length > 0;

  const handleSubmit = () => {
    if (!canSave) return;
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    onSubmit({ title: title.trim(), content, category: category.trim(), tags });
  };

  const handlePasteToCreate = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      const trimmed = text.trim();
      if (!trimmed) return;
      setContent(trimmed);
      if (!title.trim()) {
        // Derive a title from the first line of the pasted content.
        const firstLine = trimmed.split('\n').find((l) => l.trim()) ?? '';
        setTitle(firstLine.slice(0, 48).trim() || 'Pasted prompt');
      }
      setPasteNotice(true);
    } catch {
      // ignore clipboard read failures
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.label}>Title *</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Code Reviewer"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Prompt title"
      />

      <View style={styles.contentLabelRow}>
        <Text style={styles.rowLabel}>Content *</Text>
        {enablePasteToCreate && (
          <Pressable onPress={handlePasteToCreate} hitSlop={8} accessibilityLabel="Paste and create">
            <Text style={styles.pasteLink}>📋 Paste &amp; Create</Text>
          </Pressable>
        )}
      </View>
      <TextInput
        style={[styles.input, styles.contentInput]}
        value={content}
        onChangeText={setContent}
        placeholder={'Write your template… use {{variable}} for fill-in fields.'}
        placeholderTextColor={colors.textMuted}
        multiline
        textAlignVertical="top"
        accessibilityLabel="Prompt content"
      />
      {pasteNotice && (
        <View style={styles.pasteNotice}>
          <Text style={styles.pasteNoticeText}>Pasted from clipboard — edit and save.</Text>
        </View>
      )}
      {unclosed && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            ⚠ Looks like you have an unfinished variable: {'{{'}
            {unclosed}
          </Text>
        </View>
      )}

      <Text style={styles.label}>Category</Text>
      <TextInput
        style={styles.input}
        value={category}
        onChangeText={setCategory}
        placeholder="e.g. Writing, Development (optional)"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Prompt category"
      />

      <Text style={styles.label}>Tags</Text>
      <TextInput
        style={styles.input}
        value={tagsInput}
        onChangeText={setTagsInput}
        placeholder="comma, separated, tags (optional)"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        accessibilityLabel="Prompt tags"
      />

      <View style={styles.actions}>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.pressed]}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        {/* DisabledStateHelper: tapping a disabled Save explains why + what
            unlocks it, instead of dead-silent taps. */}
        <DisabledStateHelper
          enabled={canSave}
          targetId="editor-save"
          reason="Save needs both a title and some content."
          unlockHint="Fill in the required Title and Content fields to enable Save."
          style={styles.button}
        >
          <Pressable
            onPress={handleSubmit}
            disabled={!canSave}
            style={({ pressed }) => [
              styles.submitButton,
              !canSave && styles.submitDisabled,
              pressed && canSave && styles.pressed,
            ]}
            accessibilityLabel={submitLabel}
          >
            <Text style={styles.submitText}>{submitLabel}</Text>
          </Pressable>
        </DisabledStateHelper>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  contentLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  label: { ...typography.body, fontWeight: '600', marginTop: spacing.lg, marginBottom: spacing.sm },
  rowLabel: { ...typography.body, fontWeight: '600', marginTop: 0, marginBottom: 0 },
  pasteLink: { fontSize: 13, fontWeight: '700', color: colors.primary, paddingVertical: spacing.xs },
  pasteNotice: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.sm,
    padding: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  pasteNoticeText: { fontSize: 13, color: colors.success, fontWeight: '500' },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
  },
  contentInput: { minHeight: 180, ...typography.mono, fontSize: 14, lineHeight: 20 },
  warningBox: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  warningText: { fontSize: 13, color: colors.warning, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
  },
  cancelButton: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  submitButton: { backgroundColor: colors.primary },
  submitDisabled: { backgroundColor: colors.primary, opacity: 0.4 },
  cancelText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  submitText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  pressed: { opacity: 0.85 },
});
