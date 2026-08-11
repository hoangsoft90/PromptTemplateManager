// app/(tabs)/_layout.tsx — bottom tab navigator.
// Shared UI (search bar, backup reminder) lives above the three tabs.
// The FAB floats above the tab bar; the ad banner is rendered as part of the
// custom tab bar so it sits between the content and the tab bar.

import { router, Tabs, useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdBanner } from '../../components/AdBanner';
import { BackupReminderBanner } from '../../components/BackupReminderBanner';
import { SearchBar } from '../../components/SearchBar';
import { useBackupReminder } from '../../hooks/useBackupReminder';
import { colors, radius, shadows, spacing } from '../../lib/theme';
import { PromptsProvider, usePromptsContext } from '../../lib/PromptsContext';

const AD_HEIGHT = 50;
const TAB_BAR_HEIGHT = Platform.OS === 'android' ? 56 : 49;

function Header({ backup }: { backup: ReturnType<typeof useBackupReminder> }) {
  const { query, setQuery, isSearching } = usePromptsContext();
  return (
    <>
      <View style={styles.searchWrap}>
        <SearchBar value={query} onChangeText={setQuery} />
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

  // Refresh lists + backup banner whenever the tabs regain focus (e.g. after
  // returning from Detail / Settings / a copy action).
  useFocusEffect(
    useCallback(() => {
      void reload();
      void backup.refresh();
    }, [reload, backup.refresh])
  );

  // AdBanner sits between the tab content and the tab bar.
  const adBottom = TAB_BAR_HEIGHT + insets.bottom;
  // FAB sits above the ad banner + tab bar + safe area.
  const fabBottom = adBottom + AD_HEIGHT + spacing.lg;

  return (
    <View style={styles.container}>
      <Header backup={backup} />

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

      {/* Ad banner anchored above the tab bar */}
      <View style={[styles.adWrapper, { bottom: adBottom }]}>
        <AdBanner />
      </View>

      <Pressable
        onPress={() => router.push('/prompt/new')}
        style={({ pressed }) => [styles.fab, { bottom: fabBottom }, pressed && styles.fabPressed]}
        accessibilityLabel="Create new prompt"
      >
        <Text style={styles.fabIcon}>＋</Text>
      </Pressable>
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
  fab: {
    position: 'absolute',
    right: spacing.xl,
    width: 58,
    height: 58,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.fab,
  },
  fabPressed: { backgroundColor: colors.primaryPressed, transform: [{ scale: 0.96 }] },
  fabIcon: { color: '#FFFFFF', fontSize: 28, fontWeight: '400', lineHeight: 30 },
  adWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});