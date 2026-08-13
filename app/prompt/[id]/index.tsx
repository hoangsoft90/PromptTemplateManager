// app/prompt/[id]/index.tsx — Detail: raw content, edit/delete (confirm), favorite toggle, copy.

import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AdBanner } from '../../../components/AdBanner';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { MissingState } from '../../../components/MissingState';
import { useToast } from '../../../components/Toast';
import {
  deletePrompt,
  getPromptById,
  incrementAppMeta,
  recordUsage,
  toggleFavorite,
} from '../../../db/promptRepository';
import { onCopyComplete } from '../../../lib/adGateStore';
import { colors, radius, spacing, typography } from '../../../lib/theme';
import { extractVariables } from '../../../lib/variableEngine';
import { safeBack } from '../../../lib/navigation';
import type { Prompt } from '../../../types/prompt';

export default function PromptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Deep link lands here with no back stack — offer an in-content way home.
  const [hasHistory] = useState(() => router.canGoBack());

  const load = useCallback(async () => {
    const p = await getPromptById(id);
    setPrompt(p);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const hasVariables = useMemo(
    () => (prompt ? extractVariables(prompt.content).length > 0 : false),
    [prompt]
  );

  const quickCopy = useCallback(async () => {
    if (!prompt) return;
    try {
      await Clipboard.setStringAsync(prompt.content);
      await recordUsage(prompt.id);
      await incrementAppMeta('nsm_quick_copy_count');
      // Match PromptList: a template with variables says "Template copied!",
      // a zero-variable prompt just says "Copied!".
      toast.show(prompt.content.includes('{{') ? 'Template copied!' : 'Copied!');
      void load();
      void onCopyComplete();
    } catch {
      toast.show('Copy failed');
    }
  }, [prompt, toast, load]);

  const handleFavorite = useCallback(async () => {
    if (!prompt) return;
    await toggleFavorite(prompt.id);
    void load();
  }, [prompt, load]);

  const handleDelete = useCallback(async () => {
    if (!prompt) return;
    await deletePrompt(prompt.id);
    toast.show('Prompt deleted');
    safeBack();
  }, [prompt, toast]);

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
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {!hasHistory && (
          <Pressable
            onPress={() => safeBack()}
            style={({ pressed }) => [styles.backPill, pressed && styles.pressed]}
            accessibilityLabel="Back to library"
          >
            <Text style={styles.backPillText}>← Back to library</Text>
          </Pressable>
        )}
        <View style={styles.headerRow}>
          <Text style={styles.title}>{prompt.title}</Text>
          <Pressable onPress={handleFavorite} hitSlop={10} accessibilityLabel="Toggle favorite">
            <Text style={[styles.star, prompt.isFavorite && styles.starActive]}>
              {prompt.isFavorite ? '★' : '☆'}
            </Text>
          </Pressable>
        </View>

        {(prompt.category || prompt.tags.length > 0) && (
          <View style={styles.metaRow}>
            {prompt.category ? <Text style={styles.categoryChip}>{prompt.category}</Text> : null}
            {prompt.tags.map((tag) => (
              <Text key={tag} style={styles.tag}>
                #{tag}
              </Text>
            ))}
          </View>
        )}

        <Text style={styles.usage}>
          Used {prompt.usageCount}×{prompt.lastUsedAt ? ` · last ${formatRelative(prompt.lastUsedAt)}` : ''}
        </Text>

        <View style={styles.contentBox}>
          <Text style={styles.contentText} selectable>
            {prompt.content}
          </Text>
        </View>

        <View style={styles.actions}>
          {hasVariables ? (
            <>
              <Pressable
                onPress={() => router.push({ pathname: '/prompt/[id]/fill', params: { id: prompt.id } })}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryText}>Fill &amp; Copy</Text>
              </Pressable>
              <Pressable
                onPress={quickCopy}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryText}>⧉ Copy raw</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={quickCopy}
              style={({ pressed }) => [styles.primaryButton, styles.copyOnly, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>⧉ Copy</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        {/* Native-only adaptive banner; renders nothing on web. */}
        <AdBanner />
        <View style={styles.footer}>
          <Pressable
            onPress={() => router.push({ pathname: '/prompt/[id]/edit', params: { id: prompt.id } })}
            style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
          >
            <Text style={styles.editText}>✏️ Edit</Text>
          </Pressable>
          <Pressable
            onPress={() => setConfirmDelete(true)}
            style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
          >
            <Text style={styles.deleteText}>🗑 Delete</Text>
          </Pressable>
        </View>
      </View>

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete this prompt?"
        message={`“${prompt.title}” will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmDelete(false);
          void handleDelete();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </View>
  );
}

function formatRelative(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  // Extra bottom clearance for the pinned banner + footer on native; on web
  // the banner renders nothing so the original padding is enough.
  content: { padding: spacing.lg, paddingBottom: Platform.OS === 'web' ? 120 : 200 },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: { ...typography.title, flex: 1 },
  backPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  backPillText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  star: { fontSize: 26, color: colors.textMuted },
  starActive: { color: colors.star },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  categoryChip: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  tag: { fontSize: 13, color: colors.textSecondary },
  usage: { ...typography.caption, marginTop: spacing.md },
  contentBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderColor: colors.border,
    borderWidth: 1,
  },
  contentText: { ...typography.mono, fontSize: 14, lineHeight: 21, color: colors.textPrimary },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  copyOnly: { maxWidth: 180 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  secondaryText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  editButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  editText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  deleteButton: {
    flex: 1,
    backgroundColor: colors.dangerSoft,
    borderColor: '#FECDCA',
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  deleteText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
