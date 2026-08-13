// lib/onboarding/placement.ts — geometry helpers for in-app guidance.
//
// The tooltip / spotlight popup needs to know WHERE to render relative to a
// target element. React Native gives us the target's window rect via
// `measureInWindow`; this module turns that rect + the popup's own measured
// size + the screen size into a concrete { x, y } with an edge placement,
// clamped inside the screen so the popup is always fully visible.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PopupSize {
  width: number;
  height: number;
}

export interface ScreenSize {
  width: number;
  height: number;
}

export type Placement = 'top' | 'bottom' | 'left' | 'right';

// Gap between the target edge and the popup edge (keeps the arrow readable).
export const POPUP_GAP = 8;
// Minimum distance from any screen edge so the popup never kisses the bezel.
const SCREEN_MARGIN = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Computes where to place a popup of `popup` size next to `target` on a
 * `screen`. `preferred` is tried first; if there is not enough room we fall
 * back through the other edges. The returned position is clamped so the popup
 * is fully on-screen (with a small margin).
 */
export function computePopupPosition(
  target: Rect,
  popup: PopupSize,
  screen: ScreenSize,
  preferred: Placement = 'bottom'
): { x: number; y: number; placement: Placement } {
  const space = {
    top: target.y,
    bottom: screen.height - (target.y + target.height),
    left: target.x,
    right: screen.width - (target.x + target.width),
  } as const;

  const fits = (p: Placement): boolean => {
    if (p === 'top' || p === 'bottom') return space[p] >= popup.height + POPUP_GAP;
    return space[p] >= popup.width + POPUP_GAP;
  };

  // Try preferred first, then its opposite, then the other two edges.
  // Order: preferred → opposite → the other axis (right/left when vertical
  // was requested, top/bottom when horizontal was requested).
  const OPPOSITE: Record<Placement, Placement> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  };
  const otherAxis: Placement[] =
    preferred === 'top' || preferred === 'bottom' ? ['left', 'right'] : ['top', 'bottom'];
  const order: Placement[] = [preferred, OPPOSITE[preferred], ...otherAxis];
  let placement: Placement = preferred;
  for (const p of order) {
    if (fits(p)) {
      placement = p;
      break;
    }
  }

  // Nothing has room (very small screen): fall back to the edge with the
  // most free space — the final clamp still keeps the popup on-screen.
  if (!fits(placement)) {
    placement = order.reduce((best, p) => (space[p] > space[best] ? p : best), order[0]);
  }

  // Horizontal/vertical centering, then clamp into the screen.
  let x = target.x + target.width / 2 - popup.width / 2;
  let y = target.y + target.height / 2 - popup.height / 2;

  if (placement === 'top') y = target.y - popup.height - POPUP_GAP;
  if (placement === 'bottom') y = target.y + target.height + POPUP_GAP;
  if (placement === 'left') x = target.x - popup.width - POPUP_GAP;
  if (placement === 'right') x = target.x + target.width + POPUP_GAP;

  x = clamp(x, SCREEN_MARGIN, screen.width - popup.width - SCREEN_MARGIN);
  y = clamp(y, SCREEN_MARGIN, screen.height - popup.height - SCREEN_MARGIN);

  return { x, y, placement };
}
