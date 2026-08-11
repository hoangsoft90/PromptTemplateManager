// lib/adGateStore.ts — module-level ad-gate state.
// The offer dialog must survive navigation (copy → router.back() unmounts the
// source screen), so the visibility state lives here and is rendered once by
// <AdGateHost/> at the root layout, not per screen.

import {
  grantAdShield,
  interstitial,
  rewarded,
  trackCopyAndMaybeShowAd,
} from './ads';

type Listener = (visible: boolean) => void;

let visible = false;
let pending = false;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((l) => l(visible));
}

export function subscribeAdGate(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isAdGateVisible(): boolean {
  return visible;
}

/** Call after every successful copy. Threshold hit → open the offer dialog. */
export async function onCopyComplete(): Promise<void> {
  const thresholdHit = await trackCopyAndMaybeShowAd();
  if (!thresholdHit || pending) return;
  pending = true;
  visible = true;
  notify();
}

async function closeGate(): Promise<void> {
  visible = false;
  pending = false;
  notify();
}

/** User chose "Watch ad" → rewarded; on failure falls through to interstitial. */
export async function chooseWatchRewarded(): Promise<void> {
  await closeGate();
  try {
    const completed = await rewarded.showAndGrantReward();
    if (completed) {
      await grantAdShield();
    } else {
      await interstitial.showIfLoaded();
    }
  } catch {
    // ads must never break the app
  }
}

/** User chose "Show ad" → interstitial. */
export async function chooseShowInterstitial(): Promise<void> {
  await closeGate();
  try {
    await interstitial.showIfLoaded();
  } catch {
    // ignore
  }
}
