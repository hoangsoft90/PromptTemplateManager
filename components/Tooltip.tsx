// components/Tooltip.tsx — drop-in tooltip that points at whatever it wraps.
//
// Registers the wrapped element as an onboarding target, then shows a one-time
// tooltip pointing at it when the element mounts. Combined with the root
// OnboardingOverlay this gives a clean "highlight + popup attached to the
// element" without the caller doing any positioning math.
//
// Trigger rule: the tooltip only ever shows once per install (persisted in
// app_meta via the onboarding store); repeat visits are silent.
//
// Usage:
//   <Tooltip id="home-fab" title="Create a template" message="Tap + to start.">
//     <Pressable>…</Pressable>
//   </Tooltip>

import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useOnboardingTarget } from '../lib/onboarding/OnboardingContext';
import type { Placement } from '../lib/onboarding/placement';
import { useOptionalOnboarding } from '../lib/onboarding/OnboardingContext';

interface Props {
  /** Stable id — the tooltip shows only once per install. */
  id: string;
  title?: string;
  message: string;
  /** Preferred edge; auto-falls back when there is no room. */
  placement?: Placement;
  /** Dim + spotlight-hole emphasis around the target. */
  spotlight?: boolean;
  children: React.ReactNode;
}

export function Tooltip({ id, title, message, placement, spotlight, children }: Props) {
  const targetRef = useOnboardingTarget(id);
  const onboarding = useOptionalOnboarding();

  // Show once on first mount. showTooltip itself guards the "seen once" rule,
  // so re-mounts (tab switches, focus changes) are safe no-ops. Without a
  // provider (unit tests) this is a plain passthrough wrapper.
  useEffect(() => {
    onboarding?.showTooltip({ id, title, message, targetId: id, placement, spotlight });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View ref={targetRef} collapsable={false}>
      {children}
    </View>
  );
}
