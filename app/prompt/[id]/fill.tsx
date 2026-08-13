// app/prompt/[id]/fill.tsx — Fill & Copy screen (spec C4).
// Fields in order of appearance, live preview, required validation, haptic + toast.

import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MissingState } from '../../../components/MissingState';
import { PreviewPane } from '../../../components/PreviewPane';
import { safeBack } from '../../../lib/navigation';
import { useToast } from '../../../components/Toast';
import { VariableField } from '../../../components/VariableField';
import { getPromptById, incrementAppMeta, recordUsage } from '../../../db/promptRepository';
import { onCopyComplete } from '../../../lib/adGateStore';
import { useVariableForm } from '../../../hooks/useVariableForm';
import { colors, radius, spacing, typography } from '../../../lib/theme';
import type { Prompt } from '../../../types/prompt';

export default function FillPromptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const fieldY = useRef<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getPromptById(id);
        if (!cancelled) setPrompt(p);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const form = useVariableForm(prompt?.content ?? '');

  const hasEmptyFields = useMemo(
    () => form.variables.some((v) => !form.values[v.name]?.trim()),
    [form.variables, form.values]
  );

  const handleCopy = async () => {
    if (!prompt) return;
    if (!form.validate()) {
      // Block copy + highlight empty fields red (spec C4).
      const firstInvalid = form.firstInvalidName;
      if (firstInvalid) {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ y: Math.max(0, (fieldY.current[firstInvalid] ?? 0) - 16), animated: true });
        });
      }
      return;
    }
    setCopying(true);
    try {
      const rendered = form.rendered;
      await Clipboard.setStringAsync(rendered);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await recordUsage(prompt.id);
      await incrementAppMeta('nsm_fill_copy_count');
      toast.show('Copied!');
      // safeBack() naturally returns to the previous screen in the stack:
      //   Tab → Fill & Copy            → back → Tab
      //   Tab → Detail → Fill & Copy   → back → Detail
      safeBack();
      void onCopyComplete();
    } catch {
      toast.show('Copy failed');
      setCopying(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!prompt) {
    // Deep link to a deleted prompt: offer a safe way out (no dead end).
    return <MissingState message="This prompt no longer exists." />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.promptTitle}>{prompt.title}</Text>

        {form.variables.map((variable) => (
          <View
            key={variable.name}
            onLayout={(e) => {
              fieldY.current[variable.name] = e.nativeEvent.layout.y;
            }}
          >
            <VariableField
              variable={variable}
              value={form.values[variable.name] ?? ''}
              error={!!form.errors[variable.name]}
              onChangeText={(value) => form.setValue(variable.name, value)}
            />
          </View>
        ))}

        <PreviewPane text={form.rendered} />
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Pressable
            onPress={() => safeBack()}
            disabled={copying}
            style={({ pressed }) => [styles.cancelButton, pressed && !copying && styles.pressed]}
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleCopy}
            disabled={copying}
            style={({ pressed }) => [
              styles.copyButton,
              pressed && !copying && styles.pressed,
            ]}
            accessibilityLabel="Copy final prompt"
          >
            <Text style={styles.copyText}>
              {copying ? 'Copying…' : 'Copy Final Prompt'}
            </Text>
          </Pressable>
        </View>
        {hasEmptyFields && !copying && (
          <Text style={styles.hint}>Fill all highlighted fields to copy</Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  content: { padding: spacing.lg, paddingBottom: 140 },
  promptTitle: { ...typography.title, marginBottom: spacing.xl },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  footerRow: { flexDirection: 'row', gap: spacing.md },
  cancelButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  cancelText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  copyButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  copyText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  hint: { ...typography.caption, textAlign: 'center', marginTop: spacing.sm },
  pressed: { opacity: 0.85 },
});
