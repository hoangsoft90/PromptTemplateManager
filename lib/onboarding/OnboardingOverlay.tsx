// lib/onboarding/OnboardingOverlay.tsx — root overlay for all in-app
// guidance (tooltip / spotlight tour / disabled-help).
//
// Rendered once by OnboardingProvider above the whole app. It:
//   1. dims the background (full dim, or a "spotlight" dim with a hole cut
//      around the target rect using four edge rectangles — RN has no native
//      hole-punch, this is the standard technique),
//   2. draws a highlight box around the target,
//   3. positions a popup near the target via computePopupPosition, clamped to
//      the screen and auto-flipping edges when there is no room.
//
// When the target rect is unavailable (element not yet laid out / not
// registered), the popup falls back to a bottom-center position so the
// message is never lost.

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { computePopupPosition, type Placement, type PopupSize, type Rect } from './placement';
import type { OnboardingView } from './types';

const DIM_COLOR = 'rgba(15, 23, 42, 0.72)';
const SPOTLIGHT_BORDER = '#FFFFFF';
const POPUP_WIDTH = 280;
const FALLBACK_MARGIN = 24;

// Popup dimensions are measured via onLayout once the card mounts, but we
// still need a size to render the first frame (and for tests, where onLayout
// never fires). A fixed estimate is fine — onLayout corrects it immediately
// on device.
const ESTIMATED_POPUP_SIZE: PopupSize = { width: POPUP_WIDTH, height: 170 };

interface Props {
  view: OnboardingView;
  onNext: () => void;
  onSkip: () => void;
  onDismiss: () => void;
}

export function OnboardingOverlay({ view, onNext, onSkip, onDismiss }: Props) {
  const screen = useWindowDimensions();
  const [popupSize, setPopupSize] = useState<PopupSize>(ESTIMATED_POPUP_SIZE);

  const rect = view.rect;

  const placement: Placement | undefined =
    view.kind === 'tour'
      ? view.steps[view.stepIndex].placement
      : view.kind === 'tooltip'
        ? view.spec.placement
        : undefined;

  const isSpotlight =
    view.kind === 'tour' || (view.kind === 'tooltip' && view.spec.spotlight === true);

  const position = useMemo(() => {
    if (!rect) return null;
    return computePopupPosition(rect, popupSize, screen, placement);
  }, [rect, popupSize, screen, placement]);

  // Fallback: center-bottom, used when the target is not measurable.
  const fallbackPos = position
    ? null
    : { x: (screen.width - Math.min(popupSize.width, screen.width - FALLBACK_MARGIN * 2)) / 2, y: screen.height - popupSize.height - 90 };

  const popupLeft = position?.x ?? fallbackPos?.x;
  const popupTop = position?.y ?? fallbackPos?.y;
  const effectivePlacement = position?.placement ?? placement ?? 'bottom';

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      accessibilityViewIsModal
      accessibilityElementsHidden={false}
    >
      {/* --- dim + spotlight hole --- */}
      {isSpotlight ? (
        <SpotlightDim rect={rect} screen={screen} />
      ) : (
        <Pressable
          style={[StyleSheet.absoluteFill, styles.plainDim]}
          onPress={onDismiss}
          accessibilityLabel="Dismiss tip"
          accessibilityRole="button"
        />
      )}

      {/* --- popup card --- */}
      {popupLeft !== undefined && popupTop !== undefined && (
        <View
          style={[
            styles.popup,
            {
              left: popupLeft,
              top: popupTop,
              width: Math.min(POPUP_WIDTH, screen.width - FALLBACK_MARGIN * 2),
            },
          ]}
          accessible
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setPopupSize((prev) =>
              prev && prev.height === height && prev.width === width ? prev : { width, height }
            );
          }}
        >
          <PopupArrow placement={effectivePlacement} />
          <PopupBody view={view} onNext={onNext} onSkip={onSkip} onDismiss={onDismiss} />
        </View>
      )}
    </View>
  );
}

/** Cuts a spotlight "hole" around `rect` using four dim edge rectangles. */
function SpotlightDim({ rect, screen }: { rect: Rect | null; screen: { width: number; height: number } }) {
  // Without a rect we can only offer a full dim (no hole).
  if (!rect) return <View style={[StyleSheet.absoluteFill, styles.fullDim]} />;

  const { x, y, width, height } = rect;
  const PAD = 6; // breathing room around the highlighted element

  const edge = (style: object) => <View style={[styles.dimEdge, style]} />;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* top strip */}
      {edge({ top: 0, left: 0, right: 0, height: Math.max(0, y - PAD) })}
      {/* bottom strip */}
      {edge({
        top: y + height + PAD,
        left: 0,
        right: 0,
        height: Math.max(0, screen.height - (y + height + PAD)),
      })}
      {/* left strip */}
      {edge({
        top: y - PAD,
        left: 0,
        width: Math.max(0, x - PAD),
        height: height + PAD * 2,
      })}
      {/* right strip */}
      {edge({
        top: y - PAD,
        left: x + width + PAD,
        width: Math.max(0, screen.width - (x + width + PAD)),
        height: height + PAD * 2,
      })}
      {/* highlight outline around the target */}
      <View
        style={{
          position: 'absolute',
          left: x - PAD,
          top: y - PAD,
          width: width + PAD * 2,
          height: height + PAD * 2,
          borderWidth: 2,
          borderColor: SPOTLIGHT_BORDER,
          borderRadius: radius.md,
        }}
      />
    </View>
  );
}

/** Little arrow pointing from the popup toward the target edge. */
function PopupArrow({ placement }: { placement: Placement }) {
  const arrowStyle =
    placement === 'top'
      ? styles.arrowBottom
      : placement === 'left'
        ? styles.arrowRight
        : placement === 'right'
          ? styles.arrowLeft
          : styles.arrowTop;
  return <View style={[styles.arrow, arrowStyle]} pointerEvents="none" />;
}

function PopupBody({
  view,
  onNext,
  onSkip,
  onDismiss,
}: {
  view: OnboardingView;
  onNext: () => void;
  onSkip: () => void;
  onDismiss: () => void;
}) {
  if (view.kind === 'tooltip') {
    return (
      <>
        {view.spec.title ? <Text style={styles.title}>{view.spec.title}</Text> : null}
        <Text style={styles.message}>{view.spec.message}</Text>
        <View style={styles.actions}>
          <Pressable style={[styles.button, styles.primaryButton]} onPress={onDismiss} accessibilityLabel="Got it">
            <Text style={styles.primaryText}>Got it</Text>
          </Pressable>
        </View>
      </>
    );
  }

  if (view.kind === 'help') {
    return (
      <>
        <Text style={styles.title}>Why is this disabled?</Text>
        <Text style={styles.message}>{view.help.reason}</Text>
        <Text style={styles.hint}>🔓 {view.help.unlockHint}</Text>
        <View style={styles.actions}>
          <Pressable style={[styles.button, styles.primaryButton]} onPress={onDismiss} accessibilityLabel="Got it">
            <Text style={styles.primaryText}>Got it</Text>
          </Pressable>
        </View>
      </>
    );
  }

  // --- tour ---
  const { steps, stepIndex } = view;
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  return (
    <>
      <View style={styles.stepRow}>
        {steps.map((s, i) => (
          <View key={s.id} style={[styles.dot, i === stepIndex && styles.dotActive]} />
        ))}
      </View>
      <Text style={styles.title}>{step.title}</Text>
      <Text style={styles.message}>{step.message}</Text>
      <View style={styles.actions}>
        <Pressable style={[styles.button, styles.skipButton]} onPress={onSkip} accessibilityLabel="Skip tour">
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.primaryButton, styles.nextButton]}
          onPress={onNext}
          accessibilityLabel={isLast ? 'Finish tour' : 'Next step'}
        >
          <Text style={styles.primaryText}>{isLast ? 'Done' : 'Next'}</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // --- dim layers ---
  plainDim: { backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  fullDim: { backgroundColor: DIM_COLOR },
  dimEdge: { position: 'absolute', backgroundColor: DIM_COLOR },

  // --- popup card ---
  popup: {
    position: 'absolute',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    // Strong elevation so the card sits above dim + app content.
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  arrow: {
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: colors.surface,
    transform: [{ rotate: '45deg' }],
  },
  arrowTop: { top: -5, left: 24 },
  arrowBottom: { bottom: -5, left: 24 },
  arrowLeft: { left: -5, top: 24 },
  arrowRight: { right: -5, top: 24 },

  // --- content ---
  title: { ...typography.subtitle, marginBottom: spacing.sm },
  message: { ...typography.bodySecondary, lineHeight: 20 },
  hint: { ...typography.caption, marginTop: spacing.sm, color: colors.success, fontWeight: '600' },
  stepRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.primary, width: 18 },

  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  primaryButton: { flex: 1, backgroundColor: colors.primary },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  skipButton: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 },
  skipText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  nextButton: { flex: 2 },
});
