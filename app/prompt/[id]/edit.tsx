// app/prompt/[id]/edit.tsx — Editor (edit, pre-filled).

import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { MissingState } from '../../../components/MissingState';
import { PromptForm, type PromptFormValues } from '../../../components/PromptForm';
import { useToast } from '../../../components/Toast';
import { safeBack } from '../../../lib/navigation';
import { getPromptById, updatePrompt } from '../../../db/promptRepository';
import { colors, spacing } from '../../../lib/theme';
import type { Prompt } from '../../../types/prompt';

export default function EditPromptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleSubmit = useCallback(
    async (values: PromptFormValues) => {
      try {
        await updatePrompt(id, values);
        toast.show('Prompt updated');
        safeBack(); // back to Detail
      } catch {
        toast.show('Failed to update prompt');
      }
    },
    [id, toast]
  );

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
    <PromptForm
      initial={prompt}
      submitLabel="Save"
      onSubmit={handleSubmit}
      onCancel={() => safeBack()}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
});
