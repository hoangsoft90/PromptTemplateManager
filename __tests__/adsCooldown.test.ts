// __tests__/adsCooldown.test.ts — locks the App Open ad cooldown rules in
// lib/ads.ts (AppOpenAdManager.tryShow):
//   - never shows within 30s of cold start (APP_OPEN_SKIP_AFTER_LAUNCH_MS)
//   - at most one app open per 3 minutes (APP_OPEN_MIN_INTERVAL_MS)
//   - never stacks on a recently shown interstitial (shared
//     lastFullscreenAdShownAt)
//   - a failed show() does NOT consume the throttle (lastShownAt is only set
//     after the ad actually displayed)
//   - returns false when the ad is not loaded yet
//
// Strategy:
//   - jest.mock('react-native-google-mobile-ads') with FakeAd instances that
//     actually EMIT the LOADED event on load(), so the manager's `loaded`
//     flag flips to true (the mocks in adsConfig/consent tests never fire
//     events and only cover init/consent paths).
//   - jest.useFakeTimers() + jest.setSystemTime() control Date.now(), which
//     is what launchedAt/lastShownAt/fullscreen throttle all read.
//   - jest.resetModules() per test gives a fresh ads module → fresh
//     launchedAt, lastShownAt and fullscreen-timestamp state.

import { Platform } from 'react-native';

jest.mock('../lib/config', () => ({ TEST_ADS: true }));

jest.mock('../db/promptRepository', () => ({
  getAppMeta: jest.fn(() => Promise.resolve(null)),
  setAppMeta: jest.fn(() => Promise.resolve()),
  incrementAppMeta: jest.fn(() => Promise.resolve()),
}));

const state = {
  failShowOnce: false,
  showCalls: 0,
};

jest.mock('react-native-google-mobile-ads', () => {
  class FakeAd {
    private listeners = new Map<string, (() => void)[]>();
    static createForAdRequest() {
      return new FakeAd();
    }
    addAdEventListener(type: string, cb: () => void) {
      const list = this.listeners.get(type) ?? [];
      list.push(cb);
      this.listeners.set(type, list);
      return () => {};
    }
    /** Emit an event to any registered listeners (e.g. 'loaded'). */
    private emit(type: string) {
      (this.listeners.get(type) ?? []).forEach((cb) => cb());
    }
    load() {
      // Real SDK fires LOADED after a successful load — emit it so the
      // manager sets `loaded = true`.
      this.emit('loaded');
    }
    show() {
      state.showCalls += 1;
      if (state.failShowOnce) {
        state.failShowOnce = false;
        return Promise.reject(new Error('ad failed to show'));
      }
      // Real SDK emits CLOSED when the fullscreen ad is dismissed; the
      // manager reloads on CLOSED (→ LOADED), so `loaded` recovers for the
      // next attempt. Without this the ad stays marked not-loaded after a
      // successful show and throttle tests would fail for the wrong reason.
      return Promise.resolve().then(() => this.emit('closed'));
    }
  }

  function MobileAds() {
    return { initialize: () => Promise.resolve() };
  }

  return {
    __esModule: true,
    default: MobileAds,
    MobileAds,
    AdsConsent: {
      gatherConsent: jest.fn(() => Promise.resolve({ canRequestAds: true })),
      showPrivacyOptionsForm: jest.fn(() => Promise.resolve()),
    },
    AdsConsentDebugGeography: { EEA: 1, DISABLED: 0 },
    AdEventType: { LOADED: 'loaded', CLOSED: 'closed', ERROR: 'error' },
    RewardedAdEventType: { LOADED: 'loaded', EARNED_REWARD: 'earned_reward' },
    InterstitialAd: FakeAd,
    RewardedAd: FakeAd,
    AppOpenAd: FakeAd,
    __mockState: state,
  };
});

const COLD_START_WINDOW_MS = 30_000;
const MIN_INTERVAL_MS = 3 * 60_000;

// Base "launch" instant, in the same magnitude as real epoch ms so the
// `lastShownAt = 0` initial value never accidentally trips the throttle.
const T0 = 1_700_000_000_000;

type AdsModule = typeof import('../lib/ads');
type MockState = { failShowOnce: boolean; showCalls: number };

/**
 * Fresh module registry with fake clock at T0 + offset, Platform = ios.
 * Returns the ads module plus the CURRENT mock state (the jest.mock factory
 * re-runs after resetModules and creates a fresh state object, so we must
 * re-read it through __mockState instead of the stale top-level ref).
 */
function freshAds(offsetMs = 0): { ads: AdsModule; mockState: MockState } {
  jest.resetModules();
  jest.replaceProperty(require('react-native').Platform, 'OS', 'ios');
  jest.setSystemTime(T0 + offsetMs);
  const ads = require('../lib/ads') as AdsModule;
  const mockState = (require('react-native-google-mobile-ads') as {
    __mockState: MockState;
  }).__mockState;
  return { ads, mockState };
}

beforeEach(() => {
  jest.useFakeTimers();
  // The jest.mock factory closes over the top-level `state` object, so every
  // fresh module instance shares it — reset counters here so tests are
  // isolated despite jest.resetModules() creating new FakeAd classes.
  state.failShowOnce = false;
  state.showCalls = 0;
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('App Open cooldown (tryShow)', () => {
  it('returns false when the ad is not loaded yet', async () => {
    const { ads } = freshAds();
    // ensureLoaded never called → `loaded` stays false.

    await expect(ads.appOpen.tryShow()).resolves.toBe(false);
  });

  it('skips the ad within the 30s cold-start window, then allows it after', async () => {
    const { ads } = freshAds(); // launchedAt = T0
    ads.appOpen.ensureLoaded(); // loaded = true

    // Inside the cold-start window: no show.
    await expect(ads.appOpen.tryShow()).resolves.toBe(false);

    // 31s after launch: eligible.
    jest.setSystemTime(T0 + COLD_START_WINDOW_MS + 1000);
    await expect(ads.appOpen.tryShow()).resolves.toBe(true);
  });

  it('throttles to at most one app open per 3 minutes', async () => {
    const { ads, mockState } = freshAds();
    ads.appOpen.ensureLoaded();
    jest.setSystemTime(T0 + COLD_START_WINDOW_MS + 1000);

    await expect(ads.appOpen.tryShow()).resolves.toBe(true);

    // Immediately after a show: throttled (no second ad).
    await expect(ads.appOpen.tryShow()).resolves.toBe(false);

    // Exactly at the 3-minute mark: allowed again.
    jest.setSystemTime(T0 + COLD_START_WINDOW_MS + 1000 + MIN_INTERVAL_MS);
    await expect(ads.appOpen.tryShow()).resolves.toBe(true);
    expect(mockState.showCalls).toBe(2);
  });

  it('never stacks on a recently shown interstitial', async () => {
    const { ads } = freshAds();
    ads.appOpen.ensureLoaded();
    ads.interstitial.ensureLoaded();
    jest.setSystemTime(T0 + COLD_START_WINDOW_MS + 1000);

    // Show the interstitial first → marks the shared fullscreen timestamp.
    await expect(ads.interstitial.showIfLoaded()).resolves.toBe(true);

    // App Open within 3 minutes of that interstitial: blocked.
    await expect(ads.appOpen.tryShow()).resolves.toBe(false);

    // 3 minutes later: app open is allowed again.
    jest.setSystemTime(T0 + COLD_START_WINDOW_MS + 1000 + MIN_INTERVAL_MS);
    await expect(ads.appOpen.tryShow()).resolves.toBe(true);
  });

  it('does not consume the throttle when show() fails', async () => {
    const { ads, mockState } = freshAds();
    ads.appOpen.ensureLoaded();
    jest.setSystemTime(T0 + COLD_START_WINDOW_MS + 1000);

    // show() rejects → tryShow returns false, no throttle consumed, and the
    // manager reloads (LOADED fires again so the ad is ready to retry).
    mockState.failShowOnce = true;
    await expect(ads.appOpen.tryShow()).resolves.toBe(false);

    // A retry within the same window succeeds because lastShownAt was never
    // advanced by the failed attempt.
    await expect(ads.appOpen.tryShow()).resolves.toBe(true);
    expect(mockState.showCalls).toBe(2);
  });
});
