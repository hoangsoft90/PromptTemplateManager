// app/settings/index.tsx — Settings: Import / Export / Restore Samples.

import * as DocumentPicker from 'expo-document-picker';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { exportJsonFile, readTextFile } from '../../lib/fileIO';
import { useToast } from '../../components/Toast';
import {
  buildExportFile,
  classifyImport,
  parseImportFile,
} from '../../lib/importExport';
import { AdBanner } from '../../components/AdBanner';
import { setPendingImport } from '../../lib/importSession';
import { restoreSamples } from '../../lib/samplePrompts';
import { markExported, listAll } from '../../db/promptRepository';
import {
  SHIELD_COPIES,
  getShieldRemaining,
  grantAdShield,
  isPrivacyOptionsRequired,
  rewarded,
  showPrivacyOptions,
  subscribePrivacyOptions,
} from '../../lib/ads';
import { colors, radius, shadows, spacing, typography } from '../../lib/theme';

export default function SettingsScreen() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [shield, setShield] = useState(0);
  const [privacyVisible, setPrivacyVisible] = useState(isPrivacyOptionsRequired());

  // Refresh shield status on every focus so it stays accurate after copies
  // elsewhere decrement it.
  useFocusEffect(
    useCallback(() => {
      void getShieldRemaining().then(setShield);
    }, [])
  );

  // Show the "Privacy options" row once the UMP consent flow reports it as
  // required (e.g. EEA/UK users). subscribePrivacyOptions replays the current
  // value, so this also covers the case where consent resolved before mount.
  useEffect(
    () =>
      subscribePrivacyOptions(() =>
        setPrivacyVisible(isPrivacyOptionsRequired())
      ),
    []
  );

  const handleRewarded = useCallback(async () => {
    setBusy(true);
    try {
      const completed = await rewarded.showAndGrantReward();
      if (completed) {
        await grantAdShield();
        setShield(SHIELD_COPIES);
        toast.show(`Ad-free for ${SHIELD_COPIES} copies!`);
      } else {
        toast.show('Ad not available right now');
      }
    } catch {
      toast.show('Ad failed — try again later');
    } finally {
      setBusy(false);
    }
  }, [toast]);

  const handleExport = useCallback(async () => {
    setBusy(true);
    try {
      const prompts = await listAll();
      if (prompts.length === 0) {
        toast.show('Nothing to export yet');
        return;
      }
      const file = buildExportFile(prompts);
      // Web-safe: downloads the file in the browser on web, share sheet on native.
      await exportJsonFile(
        `prompt-template-manager-${Date.now()}.json`,
        JSON.stringify(file, null, 2)
      );
      await markExported();
      toast.show(`Exported ${prompts.length} prompts`);
    } catch {
      toast.show('Export failed');
    } finally {
      setBusy(false);
    }
  }, [toast]);

  const handleImport = useCallback(async () => {
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', 'application/octet-stream'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || result.assets.length === 0) return;

      const asset = result.assets[0];
      // Web-safe: document-picker gives a blob: URL on web, so read via fetch.
      const raw = await readTextFile(asset.uri);

      const parsed = parseImportFile(raw);
      if (!parsed.ok) {
        toast.show(parsed.error);
        return;
      }

      const outcomes = await classifyImport(parsed.file.prompts);
      setPendingImport({
        outcomes,
        incoming: parsed.file.prompts,
        fileName: asset.name ?? 'backup.json',
      });
      router.push('/settings/import-preview');
    } catch {
      toast.show('Import failed');
    } finally {
      setBusy(false);
    }
  }, [toast]);

  const handleRestoreSamples = useCallback(async () => {
    setBusy(true);
    try {
      const added = await restoreSamples();
      toast.show(added > 0 ? `Added ${added} sample prompts` : 'Samples already present');
    } catch {
      toast.show('Failed to restore samples');
    } finally {
      setBusy(false);
    }
  }, [toast]);

  return (
    <View style={styles.container}>
      {busy && (
        <View style={styles.busyOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
      <ScrollView contentContainerStyle={styles.content}>
        {/* Ads are native-only (AdMob); hide the rewarded CTA on web. */}
        {Platform.OS !== 'web' && (
          <>
            <Text style={styles.sectionLabel}>Support the app</Text>

            <Pressable
              onPress={handleRewarded}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={styles.rowIcon}>🎁</Text>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>Watch a short ad</Text>
                <Text style={styles.rowSubtitle}>
                  {shield > 0
                    ? `Active: no interstitials for the next ${shield} copies ✓`
                    : `Skip interstitials for ${SHIELD_COPIES} copies`}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>

            {privacyVisible && (
              <Pressable
                onPress={() => void showPrivacyOptions()}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Text style={styles.rowIcon}>🛡️</Text>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>Privacy options</Text>
                  <Text style={styles.rowSubtitle}>
                    Review or change your ad consent choices
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            )}
          </>
        )}

        <Text style={[styles.sectionLabel, styles.sectionGap]}>Data</Text>

        <Pressable
          onPress={handleExport}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={styles.rowIcon}>📤</Text>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Export backup</Text>
            <Text style={styles.rowSubtitle}>Save all prompts as a portable JSON file</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Pressable
          onPress={handleImport}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={styles.rowIcon}>📥</Text>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Import backup</Text>
            <Text style={styles.rowSubtitle}>Restore prompts from a JSON backup file</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Pressable
          onPress={handleRestoreSamples}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={styles.rowIcon}>✨</Text>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Restore sample prompts</Text>
            <Text style={styles.rowSubtitle}>Re-add the 8 built-in example templates</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <View style={styles.about}>
          <Text style={styles.aboutTitle}>About</Text>
          <Text style={styles.aboutText}>
            The fastest way to turn your repeated AI instructions into reusable templates.
          </Text>
          <Text style={styles.aboutText}>
            Zero-cloud. Zero-account. Your prompt library stays strictly on your device.
          </Text>
        </View>
      </ScrollView>

      {/* Pinned bottom banner (native-only; renders nothing on web). */}
      <AdBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  busyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionLabel: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  sectionGap: { marginTop: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  rowIcon: { fontSize: 22, marginRight: spacing.md },
  rowBody: { flex: 1 },
  rowTitle: { ...typography.body, fontWeight: '600' },
  rowSubtitle: { ...typography.caption, marginTop: 2 },
  chevron: { fontSize: 20, color: colors.textMuted },
  about: {
    marginTop: spacing.xl,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  aboutTitle: { ...typography.subtitle, color: colors.primary, marginBottom: spacing.sm },
  aboutText: { ...typography.bodySecondary, marginBottom: spacing.xs, lineHeight: 19 },
  pressed: { opacity: 0.85 },
});
