// lib/theme.ts — shared design tokens for a consistent, polished UI.

import { Platform } from 'react-native';

export const colors = {
  background: '#F7F8FA',
  surface: '#FFFFFF',
  border: '#E4E7EC',
  textPrimary: '#1A1D21',
  textSecondary: '#667085',
  textMuted: '#98A2B3',
  primary: '#4F46E5',
  primaryPressed: '#4338CA',
  primarySoft: '#EEF2FF',
  danger: '#D92D20',
  dangerSoft: '#FEF3F2',
  warning: '#B54708',
  warningSoft: '#FFFAEB',
  success: '#079455',
  successSoft: '#ECFDF3',
  star: '#F79009',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
};

export const typography = {
  title: { fontSize: 20, fontWeight: '700' as const, color: colors.textPrimary },
  subtitle: { fontSize: 16, fontWeight: '600' as const, color: colors.textPrimary },
  body: { fontSize: 15, color: colors.textPrimary },
  bodySecondary: { fontSize: 14, color: colors.textSecondary },
  caption: { fontSize: 12, color: colors.textMuted },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
};

export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#101828',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
    },
    android: { elevation: 2 },
    default: {},
  }),
  fab: Platform.select({
    ios: {
      shadowColor: '#101828',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
    },
    android: { elevation: 6 },
    default: {},
  }),
};
