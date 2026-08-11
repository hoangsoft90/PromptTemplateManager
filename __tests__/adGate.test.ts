// __tests__/adGate.test.ts — locks the copy-flow ad-gate rules (lib/ads.ts +
// lib/adGateStore.ts):
//   - copies are counted in app_meta; the counter resets at the threshold
//   - an active rewarded shield is decremented per copy and bypasses the counter
//   - onCopyComplete only opens the offer dialog when the threshold is hit
//
// Strategy:
//   - `jest.mock('../db/promptRepository')` with an in-memory app_meta map so
//     the real counting/shield logic runs against controlled state.
//   - `jest.replaceProperty(Platform, 'OS', ...)` (same pattern as fileIO.test)
//     so `ADS_ENABLED` is true on the native path and false on web.
//   - adGateStore keeps module-level dialog state, so each `onCopyComplete`
//     test gets a fresh module instance via `jest.isolateModules`.

import { Platform } from 'react-native';
import {
  getAppMeta,
  incrementAppMeta,
  setAppMeta,
} from '../db/promptRepository';

jest.mock('../db/promptRepository', () => ({
  getAppMeta: jest.fn(),
  setAppMeta: jest.fn(),
  incrementAppMeta: jest.fn(),
}));

const mockGetAppMeta = getAppMeta as jest.Mock;
const mockSetAppMeta = setAppMeta as jest.Mock;
const mockIncrementAppMeta = incrementAppMeta as jest.Mock;

// In-memory stand-in for the app_meta table.
const meta = new Map<string, string>();

function mockPlatform(os: 'ios' | 'android' | 'web'): void {
  jest.restoreAllMocks(); // undo any previous replaceProperty
  jest.replaceProperty(Platform, 'OS', os);
}

beforeEach(() => {
  mockPlatform('ios'); // native path → ADS_ENABLED = true
  meta.clear();
  mockGetAppMeta.mockImplementation((key: string) =>
    Promise.resolve(meta.get(key) ?? null)
  );
  mockSetAppMeta.mockImplementation((key: string, value: string) => {
    meta.set(key, value);
    return Promise.resolve();
  });
  mockIncrementAppMeta.mockImplementation((key: string) => {
    meta.set(key, String(Number(meta.get(key) ?? '0') + 1));
    return Promise.resolve();
  });
});

/** The (cached) ads module — first require happens after Platform is set. */
let ads: typeof import('../lib/ads');

function loadAds(): typeof import('../lib/ads') {
  if (!ads) ads = require('../lib/ads');
  return ads;
}

/** A fresh adGateStore instance so the module-level dialog state resets. */
function freshGate(): typeof import('../lib/adGateStore') {
  let gate!: typeof import('../lib/adGateStore');
  jest.isolateModules(() => {
    gate = require('../lib/adGateStore');
  });
  return gate;
}

describe('trackCopyAndMaybeShowAd (counter)', () => {
  it('increments the counter below the threshold and returns false', async () => {
    meta.set('ad_copy_count', '3');

    const result = await loadAds().trackCopyAndMaybeShowAd();

    expect(result).toBe(false);
    expect(meta.get('ad_copy_count')).toBe('4');
  });

  it('starts counting at 1 when no counter exists yet', async () => {
    const result = await loadAds().trackCopyAndMaybeShowAd();

    expect(result).toBe(false);
    expect(meta.get('ad_copy_count')).toBe('1');
  });

  it('returns true at the threshold and resets the counter to 0', async () => {
    const { AD_FREQUENCY_COPY } = loadAds();
    meta.set('ad_copy_count', String(AD_FREQUENCY_COPY - 1));

    const result = await loadAds().trackCopyAndMaybeShowAd();

    expect(result).toBe(true);
    expect(meta.get('ad_copy_count')).toBe('0');
  });
});

describe('trackCopyAndMaybeShowAd (shield)', () => {
  it('decrements an active shield and skips the counter entirely', async () => {
    const { AD_FREQUENCY_COPY } = loadAds();
    meta.set('ad_shield_copies', '5');
    // Even one copy away from the threshold, the shield must win.
    meta.set('ad_copy_count', String(AD_FREQUENCY_COPY - 1));

    const result = await loadAds().trackCopyAndMaybeShowAd();

    expect(result).toBe(false);
    expect(meta.get('ad_shield_copies')).toBe('4');
    expect(meta.get('ad_copy_count')).toBe(String(AD_FREQUENCY_COPY - 1)); // untouched
  });

  it('drops the shield to 0 on the last shielded copy', async () => {
    meta.set('ad_shield_copies', '1');

    const result = await loadAds().trackCopyAndMaybeShowAd();

    expect(result).toBe(false);
    expect(meta.get('ad_shield_copies')).toBe('0');
  });

  it('grantAdShield writes the full shield amount (reward path)', async () => {
    const { grantAdShield, SHIELD_COPIES } = loadAds();

    await grantAdShield();

    expect(meta.get('ad_shield_copies')).toBe(String(SHIELD_COPIES));
  });

  it('getShieldRemaining reports 0 without a shield and the stored value otherwise', async () => {
    const adsApi = loadAds();

    await expect(adsApi.getShieldRemaining()).resolves.toBe(0);

    meta.set('ad_shield_copies', '7');
    await expect(adsApi.getShieldRemaining()).resolves.toBe(7);
  });
});

describe('onCopyComplete (offer dialog)', () => {
  it('keeps the dialog hidden below the threshold', async () => {
    const gate = freshGate();
    meta.set('ad_copy_count', '3');

    await gate.onCopyComplete();

    expect(gate.isAdGateVisible()).toBe(false);
  });

  it('opens the dialog at the threshold and resets the counter', async () => {
    const { AD_FREQUENCY_COPY } = loadAds();
    const gate = freshGate();
    meta.set('ad_copy_count', String(AD_FREQUENCY_COPY - 1));

    await gate.onCopyComplete();

    expect(gate.isAdGateVisible()).toBe(true);
    expect(meta.get('ad_copy_count')).toBe('0');
  });

  it('notifies subscribers when the dialog opens', async () => {
    const { AD_FREQUENCY_COPY } = loadAds();
    const gate = freshGate();
    const seen: boolean[] = [];
    gate.subscribeAdGate((visible) => seen.push(visible));
    meta.set('ad_copy_count', String(AD_FREQUENCY_COPY - 1));

    await gate.onCopyComplete();

    expect(seen).toEqual([true]);
  });

  it('does not re-open while the dialog is already pending', async () => {
    const { AD_FREQUENCY_COPY } = loadAds();
    const gate = freshGate();
    meta.set('ad_copy_count', String(AD_FREQUENCY_COPY - 1));
    await gate.onCopyComplete();
    expect(gate.isAdGateVisible()).toBe(true);

    // A second copy while the dialog is open must not change anything.
    await gate.onCopyComplete();
    expect(gate.isAdGateVisible()).toBe(true);
  });
});

// NOTE: this describe MUST stay last in the file — jest.resetModules()
// re-invokes the promptRepository mock factory on the next require, which
// would invalidate the top-level mockGetAppMeta/mockSetAppMeta/... refs.
describe('web platform', () => {
  it('never enables or triggers ads on web', async () => {
    // ads.ts evaluates `Platform.OS` at module load, and a fresh module
    // registry re-requires react-native with its default platform — so reset
    // the registry and point the freshly loaded Platform at 'web' first.
    jest.resetModules();
    const freshPlatform = require('react-native').Platform;
    jest.replaceProperty(freshPlatform, 'OS', 'web');

    const webAds = require('../lib/ads');

    expect(webAds.ADS_ENABLED).toBe(false);
    await expect(webAds.trackCopyAndMaybeShowAd()).resolves.toBe(false);
    expect(meta.size).toBe(0); // nothing written to app_meta
  });
});
