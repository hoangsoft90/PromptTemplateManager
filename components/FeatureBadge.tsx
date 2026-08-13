// components/FeatureBadge.tsx — small "New" dot/label badge.
//
// Two modes:
//   - wrapping children: the badge floats on the top-right corner of the
//     wrapped element (e.g. an icon button) — `position` lets you pick the corner.
//   - standalone: renders just the pill (e.g. next to a section title).
//
// Usage:
//   <FeatureBadge label="New"><Icon /></FeatureBadge>
//   <FeatureBadge label="New" />

import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../lib/theme';

interface Props {
  label?: string;
  /** Accent color for the dot; default = brand primary. */
  color?: string;
  /** Which corner the badge floats on when wrapping children. */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Dot-only mode (no label) — shows a small pulsing-free indicator. */
  dot?: boolean;
  children?: React.ReactNode;
  style?: ViewStyle;
}

export function FeatureBadge({
  label = 'New',
  color = colors.primary,
  position = 'top-right',
  dot = false,
  children,
  style,
}: Props) {
  const cornerStyle: ViewStyle =
    position === 'top-left'
      ? { top: -6, left: -6 }
      : position === 'bottom-right'
        ? { bottom: -6, right: -6 }
        : position === 'bottom-left'
          ? { bottom: -6, left: -6 }
          : { top: -6, right: -6 };

  const badge = dot ? (
    <View style={[styles.dotBadge, { backgroundColor: color }]} />
  ) : (
    <View style={[styles.pill, { backgroundColor: color }]}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );

  if (!children) return badge;

  return (
    <View style={[styles.wrap, style]}>
      {children}
      <View style={[styles.anchor, cornerStyle]} pointerEvents="none">
        {badge}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  anchor: { position: 'absolute' },
  pill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    // Small elevation so the pill reads above overlapping icons.
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  dotBadge: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    elevation: 3,
  },
});
