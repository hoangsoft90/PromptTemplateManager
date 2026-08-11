// components/Toast.tsx — lightweight toast system (context + animated host).

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../lib/theme';

interface ToastItem {
  id: number;
  message: string;
}

interface ToastContextValue {
  show: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const opacity = useRef(new Animated.Value(0)).current;

  const show = useCallback(
    (message: string) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message }]);
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' }),
        Animated.delay(1600),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: Platform.OS !== 'web' }),
      ]).start(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      });
    },
    [opacity]
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <View style={[styles.host, { pointerEvents: 'none' }]}>
          {toasts.map((t) => (
            <Animated.View key={t.id} style={[styles.toast, { opacity }]}>
              <Text style={styles.text}>{t.message}</Text>
            </Animated.View>
          ))}
        </View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 96,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    maxWidth: '85%',
    backgroundColor: '#1F2937',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
