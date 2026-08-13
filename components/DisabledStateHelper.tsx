// components/DisabledStateHelper.tsx — explains why a control is disabled.
//
// UX problem: a disabled button gives zero feedback — users tap it and nothing
// happens, so they don't know why or what to do. This helper wraps a disabled
// control and intercepts taps with an invisible overlay: when the wrapped
// element is disabled, tapping it shows a short tooltip ("why is this
// disabled?" + what unlocks it) instead of dead silence.
//
// Implementation notes:
//   - The transparent overlay sits on top of the wrapped element, so taps land
//     on it even though the inner control is disabled (RN disabled controls
//     swallow touches and would never fire a handler).
//   - When `enabled` is true the overlay is not rendered at all — touches pass
//     straight through to the real control.
//
// Usage:
//   <DisabledStateHelper
//     enabled={canSave}
//     reason="Save needs a title and content."
//     unlockHint="Fill in the required fields to enable Save."
//   >
//     <Pressable disabled={!canSave}>Save</Pressable>
//   </DisabledStateHelper>

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import {
  useOptionalOnboarding,
  useOnboardingTarget,
} from '../lib/onboarding/OnboardingContext';

interface Props {
  /** Whether the wrapped control is currently usable. */
  enabled: boolean;
  /** Short reason shown in the help tooltip. */
  reason: string;
  /** One-liner describing what unlocks the control. */
  unlockHint: string;
  /** Stable id used to register the wrapped element for measurement. */
  targetId: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function DisabledStateHelper({
  enabled,
  reason,
  unlockHint,
  targetId,
  children,
  style,
}: Props) {
  const onboarding = useOptionalOnboarding();
  // Registers the wrapped element so showDisabledHelp can measure its rect
  // and point the explanation popup at it.
  const targetRef = useOnboardingTarget(targetId);

  const handleTap = useCallback(() => {
    // The overlay only exists while disabled, so this only ever fires for a
    // disabled control. Measure the target + show the explanation.
    onboarding?.showDisabledHelp(targetId, { reason, unlockHint });
  }, [onboarding, targetId, reason, unlockHint]);

  return (
    <View ref={targetRef} style={[styles.wrap, style]} collapsable={false}>
      {children}
      {!enabled && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleTap}
          accessibilityLabel="Why is this disabled?"
          accessibilityRole="button"
        >
          <View style={styles.invisible} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  invisible: { flex: 1, backgroundColor: 'transparent' },
});
