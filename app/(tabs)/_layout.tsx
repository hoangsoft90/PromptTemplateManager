// app/(tabs)/_layout.tsx — bottom tab navigator.
// Shared UI (search bar, backup reminder) lives above the three tabs.
// The FAB floats above the tab bar; the ad banner is rendered as part of the
// custom tab bar so it sits between the content and the tab bar.

import { router, Tabs, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdBanner } from '../../components/AdBanner';
import { BackupReminderBanner } from '../../components/BackupReminderBanner';
import { SearchBar } from '../../components/SearchBar';
import { useBackupReminder } from '../../hooks/useBackupReminder';
import {
  useOnboarding,
  useOnboardingTarget,
} from '../../lib/onboarding/OnboardingContext';
import type { OnboardingStep } from '../../lib/onboarding/types';
import { colors, radius, shadows, spacing } from '../../lib/theme';
import { PromptsProvider, usePromptsContext } from '../../lib/PromptsContext';

const AD_HEIGHT = 50;
const TAB_BAR_HEIGHT = Platform.OS === 'android' ? 56 : 49;

// First-run tour (shown once per install): walks a new user through the core
// Search → Fill → Copy loop targets on the Home screen.
const FIRST_RUN_STEPS: OnboardingStep[] = [
  {
    id: 'search',
    targetId: 'home-search',
    title: 'Search without accents',
    message: 'Type “da nang” to find “Đà Nẵng” — diacritics are ignored when searching.',
    placement: 'bottom',
  },
  {
    id: 'fab',
    targetId: 'home-fab',
    title: 'Create a template',
    message: 'Tap + to turn a repeated AI instruction into a reusable {{variable}} template.',
    placement: 'top',
  },
  {
    id: 'tabs',
    targetId: 'home-tabs',
    title: 'Browse your library',
    message: 'Use the tabs to see All, Favorites, and Recently Used prompts.',
    placement: 'top',
  },
];

function Header({ backup }: { backup: ReturnType<typeof useBackupReminder> }) {
  const { query, setQuery, isSearching } = usePromptsContext();
  const searchRef = useOnboardingTarget('home-search');
  return (
    <>
      <View style={styles.searchWrap}>
        <View ref={searchRef} collapsable={false} style={styles.searchTarget}>
          <SearchBar value={query} onChangeText={setQuery} />
        </View>
        <Pressable
          onPress={() => router.push('/settings')}
          style={styles.settingsButton}
          hitSlop={8}
          accessibilityLabel="Settings"
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </Pressable>
      </View>
      {backup.visible && !isSearching && (
        <View style={styles.bannerWrap}>
          <BackupReminderBanner
            onExport={() => router.push('/settings')}
            onDismiss={backup.dismiss}
          />
        </View>
      )}
    </>
  );
}

function TabsContent() {
  const { reload } = usePromptsContext();
  const backup = useBackupReminder();
  const insets = useSafeAreaInsets();
  const { startTour } = useOnboarding();
  const fabRef = useOnboardingTarget('home-fab');
  const tabsRef = useOnboardingTarget('home-tabs');

  // Refresh lists + backup banner whenever the tabs regain focus (e.g. after
  // returning from Detail / Settings / a copy action).
  useFocusEffect(
    useCallback(() => {
      void reload();
      void backup.refresh();
    }, [reload, backup.refresh])
  );

  // First-run tour: start once shortly after the tab bar mounts. startTour
  // itself checks persistence, so this fires repeatedly but only shows once.
  useEffect(() => {
    const timer = setTimeout(() => {
      void startTour('first-run', FIRST_RUN_STEPS);
    }, 800);
    return () => clearTimeout(timer);
  }, [startTour]);

  // AdBanner sits between the tab content and the tab bar.
  const adBottom = TAB_BAR_HEIGHT + insets.bottom;
  // FAB sits above the ad banner + tab bar + safe area.
  const fabBottom = adBottom + AD_HEIGHT + spacing.lg;

  return (
    <View style={styles.container}>
      <Header backup={backup} />

      <View ref={tabsRef} collapsable={false} style={styles.tabsTarget}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'All',
            tabBarIcon: ({ focused, size }) => (
              <Text style={{ fontSize: size - 2, opacity: focused ? 1 : 0.45 }}>📋</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="favorites"
          options={{
            title: 'Favorites',
            tabBarIcon: ({ focused, size }) => (
              <Text style={{ fontSize: size - 2, opacity: focused ? 1 : 0.45 }}>⭐</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="recent"
          options={{
            title: 'Recent',
            tabBarIcon: ({ focused, size }) => (
              <Text style={{ fontSize: size - 2, opacity: focused ? 1 : 0.45 }}>🕘</Text>
            ),
          }}
        />
      </Tabs>
      </View>

      {/* Ad banner anchored above the tab bar */}
      <View style={[styles.adWrapper, { bottom: adBottom }]}>
        <AdBanner />
      </View>

      <View ref={fabRef} collapsable={false} style={[styles.fabWrap, { bottom: fabBottom }]}>
        <Pressable
          onPress={() => router.push('/prompt/new')}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          accessibilityLabel="Create new prompt"
        >
          <Text style={styles.fabIcon}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <PromptsProvider>
      <TabsContent />
    </PromptsProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  settingsButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  settingsIcon: { fontSize: 18 },
  bannerWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  fabWrap: {
    position: 'absolute',
    right: spacing.xl,
    width: 58,
    height: 58,
    borderRadius: radius.full,
  },
  fab: {
    flex: 1,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.fab,
  },
  searchTarget: { flex: 1 },
  tabsTarget: { flex: 1 },
  fabPressed: { backgroundColor: colors.primaryPressed, transform: [{ scale: 0.96 }] },
  fabIcon: { color: '#FFFFFF', fontSize: 28, fontWeight: '400', lineHeight: 30 },
  adWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});