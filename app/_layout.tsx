// app/_layout.tsx — root stack. Loads DB, runs migrations, seeds samples on first run.

import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AdGateHost } from '../components/AdGateHost';
import { ToastProvider } from '../components/Toast';
import { initStorage } from '../db/init';
import { initializeAds } from '../lib/ads';
import { useAppOpenAd } from '../hooks/useAppOpenAd';
import { seedSamplesIfNeeded } from '../lib/samplePrompts';
import { colors, spacing, typography } from '../lib/theme';

export default function RootLayout() {
  useAppOpenAd(); // background → foreground App Open ads (native only, throttled)
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initStorage(); // opens SQLite + migrations (native) / no-op (web)
        await seedSamplesIfNeeded();
        void initializeAds(); // UMP consent flow → SDK init; fire-and-forget, never blocks startup
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorMessage}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Preparing your library…</Text>
      </View>
    );
  }

  return (
    <ToastProvider>
      <AdGateHost />
      <Stack
        screenOptions={{
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: '700' },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="prompt/new" options={{ title: 'New Prompt', presentation: 'modal' }} />
        <Stack.Screen name="prompt/[id]/index" options={{ title: 'Prompt' }} />
        <Stack.Screen name="prompt/[id]/edit" options={{ title: 'Edit Prompt' }} />
        <Stack.Screen name="prompt/[id]/fill" options={{ title: 'Fill & Copy' }} />
        <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
        <Stack.Screen name="settings/import-preview" options={{ title: 'Import Preview' }} />
      </Stack>
    </ToastProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  loadingText: { ...typography.bodySecondary, marginTop: spacing.lg },
  errorTitle: { ...typography.subtitle, color: colors.danger },
  errorMessage: { ...typography.bodySecondary, marginTop: spacing.sm, textAlign: 'center' },
});
