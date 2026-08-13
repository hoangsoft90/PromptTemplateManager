// __tests__/placement.test.ts — locks the tooltip/spotlight placement math:
// preferred edge first, auto-fall-back when there is no room, and clamping so
// the popup stays fully on-screen.

import { computePopupPosition, POPUP_GAP } from '../lib/onboarding/placement';
import type { Placement, PopupSize, Rect, ScreenSize } from '../lib/onboarding/placement';

const screen: ScreenSize = { width: 390, height: 844 };
const popup: PopupSize = { width: 280, height: 120 };

const target = (x: number, y: number, width = 100, height = 40): Rect => ({ x, y, width, height });

function placementOf(result: { placement: Placement }): Placement {
  return result.placement;
}

describe('computePopupPosition', () => {
  it('places below the target when there is room (preferred bottom)', () => {
    const r = computePopupPosition(target(50, 100), popup, screen, 'bottom');
    expect(r.placement).toBe('bottom');
    expect(r.y).toBe(100 + 40 + POPUP_GAP);
  });

  it('flips to top when there is no room below', () => {
    // Target near the very bottom: not enough space below for the popup.
    const r = computePopupPosition(target(50, 800), popup, screen, 'bottom');
    expect(r.placement).toBe('top');
    expect(r.y + popup.height).toBeLessThanOrEqual(800);
  });

  it('flips to the side when neither vertical edge fits', () => {
    // Target vertically centered but with no space above/below for 120px.
    const tallScreen: ScreenSize = { width: 390, height: 100 };
    const r = computePopupPosition(target(50, 30, 100, 40), popup, tallScreen, 'bottom');
    // 100 - (30+40) = 30 < gap; below: 100 - 70 = 30 < gap → side placement.
    expect(['left', 'right']).toContain(placementOf(r));
  });

  it('clamps the popup horizontally inside the screen', () => {
    // Target hugging the left edge — centered popup would overflow.
    const r = computePopupPosition(target(0, 100), popup, screen, 'bottom');
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + popup.width).toBeLessThanOrEqual(screen.width);
  });

  it('clamps the popup vertically inside the screen', () => {
    // Target hugging the bottom — a flipped top popup must not overflow the top.
    const r = computePopupPosition(target(100, screen.height - 40), popup, screen, 'top');
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.y + popup.height).toBeLessThanOrEqual(screen.height);
  });

  it('prefers right when requested and roomy, else falls back', () => {
    // Target hugging the left edge: enough room to the right for a 280px popup.
    const r = computePopupPosition(target(0, 200, 90, 40), popup, screen, 'right');
    expect(r.placement).toBe('right');
    expect(r.x).toBe(90 + POPUP_GAP);
    expect(r.x + popup.width).toBeLessThanOrEqual(screen.width);
  });

  it('centers on the target horizontally on a wide screen', () => {
    const r = computePopupPosition(target(145, 100, 100, 40), popup, screen, 'bottom');
    // center of target = 195; popup width 280 → x = 55 (inside margins).
    expect(r.x).toBe(145 + 50 - 140);
  });
});
