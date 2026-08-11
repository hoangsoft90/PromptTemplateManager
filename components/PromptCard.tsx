// components/PromptCard.tsx — card with spec C3 action logic:
// - has variables  → primary [Fill & Copy] + secondary [Copy] (Quick Copy, raw)
// - no variables   → single [Copy] (raw, direct, no form)

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { extractVariables } from '../lib/variableEngine';
import { colors, radius, shadows, spacing, typography } from '../lib/theme';
import type { Prompt } from '../types/prompt';

interface Props {
  prompt: Prompt;
  onPress: () => void;
  onQuickCopy: () => void;
  onFillCopy: () => void;
  onFavoriteToggle: () => void;
}

export function PromptCard({ prompt, onPress, onQuickCopy, onFillCopy, onFavoriteToggle }: Props) {
  const hasVariables = useMemo(
    () => extractVariables(prompt.content).length > 0,
    [prompt.content]
  );

  const snippet = useMemo(() => {
    const oneLine = prompt.content.replace(/\s+/g, ' ').trim();
    return oneLine.length > 110 ? `${oneLine.slice(0, 110)}…` : oneLine;
  }, [prompt.content]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityLabel={prompt.title}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>
          {prompt.title}
        </Text>
        <Pressable
          onPress={onFavoriteToggle}
          hitSlop={10}
          accessibilityLabel={prompt.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Text style={[styles.star, prompt.isFavorite && styles.starActive]}>
            {prompt.isFavorite ? '★' : '☆'}
          </Text>
        </Pressable>
      </View>

      {(prompt.category || prompt.tags.length > 0) && (
        <View style={styles.metaRow}>
          {prompt.category ? <Text style={styles.categoryChip}>{prompt.category}</Text> : null}
          {prompt.tags.slice(0, 3).map((tag) => (
            <Text key={tag} style={styles.tag}>
              #{tag}
            </Text>
          ))}
        </View>
      )}

      <Text style={styles.snippet} numberOfLines={2}>
        {snippet}
      </Text>

      <View style={styles.actionRow}>
        {hasVariables ? (
          <>
            <Pressable
              onPress={onFillCopy}
              style={({ pressed }) => [styles.fillButton, pressed && styles.pressed]}
              accessibilityLabel={`Fill and copy ${prompt.title}`}
            >
              <Text style={styles.fillButtonText}>Fill &amp; Copy</Text>
            </Pressable>
            <Pressable
              onPress={onQuickCopy}
              style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}
              accessibilityLabel={`Quick copy ${prompt.title}`}
            >
              <Text style={styles.copyButtonText}>⧉ Copy</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={onQuickCopy}
            style={({ pressed }) => [styles.fillButton, styles.copyOnly, pressed && styles.pressed]}
            accessibilityLabel={`Copy ${prompt.title}`}
          >
            <Text style={styles.fillButtonText}>⧉ Copy</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: { ...typography.subtitle, flex: 1 },
  star: { fontSize: 20, color: colors.textMuted },
  starActive: { color: colors.star },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
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
  tag: { fontSize: 12, color: colors.textSecondary },
  snippet: { ...typography.bodySecondary, marginTop: spacing.sm, lineHeight: 19 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  fillButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
  },
  copyOnly: { maxWidth: 160 },
  fillButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  copyButton: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.sm + 1,
    paddingHorizontal: spacing.lg,
  },
  copyButtonText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
