// __tests__/adsConfig.test.ts — locks the TEST-ADS code path (lib/ads.ts with
// TEST_ADS = true, mocked below — independent of the live lib/config.ts flag,
// which is false in production):
//   - every ad format getter returns Google's official TEST unit IDs on both
//     Android and iOS
//   - initializeAds starts the SDK immediately — no UMP consent gate, no
//     gatherConsent call — so test ads always load on any device
//   - canRequestAds() flips to true right away (banner mounts)
//
// The production path (TEST_ADS = false) is locked in consent.test.ts.
// Strategy: mock lib/config with TEST_ADS=true, mock react-native-google-mobile-ads
// (recording init/consent calls), and jest.replaceProperty(Platform, 'OS', ...)
// so getters are exercised per platform.

import { Platform } from 'react-native';

jest.mock('../lib/config', () => ({ TEST_ADS: true }));

jest.mock('../db/promptRepository', () => ({
  getAppMeta: jest.fn(() => Promise.resolve(null)),
  setAppMeta: jest.fn(() => Promise.resolve()),
  incrementAppMeta: jest.fn(() => Promise.resolve()),
}));

const state = {
  initCalls: 0,
  adLoads: 0,
  gatherCalls: 0,
};

jest.mock('react-native-google-mobile-ads', () => {
  class FakeAd {
    static createForAdRequest() {
      return new FakeAd();
    }
    load() {
      state.adLoads += 1;
    }
    show() {
      return Promise.resolve();
    }
    addAdEventListener() {
      return () => {};
    }
  }

  function MobileAds() {
    return {
      initialize: () => {
        state.initCalls += 1;
        return Promise.resolve();
      },
    };
  }

  return {
    __esModule: true,
    default: MobileAds,
    MobileAds,
    AdsConsent: {
      gatherConsent: jest.fn(() => {
        state.gatherCalls += 1;
        return Promise.resolve({ canRequestAds: true });
      }),
      showPrivacyOptionsForm: jest.fn(() => Promise.resolve()),
    },
    AdsConsentDebugGeography: { EEA: 1, DISABLED: 0 },
    AdEventType: { LOADED: 'loaded', CLOSED: 'closed', ERROR: 'error' },
    RewardedAdEventType: { LOADED: 'loaded', EARNED_REWARD: 'earned_reward' },
    InterstitialAd: FakeAd,
    RewardedAd: FakeAd,
    AppOpenAd: FakeAd,
  };
});

function freshAds(os: 'ios' | 'android') {
  jest.resetModules();
  jest.replaceProperty(require('react-native').Platform, 'OS', os);
  return require('../lib/ads');
}

describe('test-ads unit IDs (TEST_ADS = true)', () => {
  it('returns Google official test IDs on Android', () => {
    const ads = freshAds('android');
    // Banner uses Google's adaptive-banner test unit (matches the
    // ANCHORED_ADAPTIVE_BANNER size used by AdBanner).
    expect(ads.getBannerUnitId()).toBe('ca-app-pub-3940256099942544/9214589741');
    expect(ads.getInterstitialUnitId()).toBe('ca-app-pub-3940256099942544/1033173712');
    expect(ads.getRewardedUnitId()).toBe('ca-app-pub-3940256099942544/5224354917');
    expect(ads.getAppOpenUnitId()).toBe('ca-app-pub-3940256099942544/3419835194');
  });

  it('returns Google official test IDs on iOS', () => {
    const ads = freshAds('ios');
    expect(ads.getBannerUnitId()).toBe('ca-app-pub-3940256099942544/9214589741');
    expect(ads.getInterstitialUnitId()).toBe('ca-app-pub-3940256099942544/4411468910');
    expect(ads.getRewardedUnitId()).toBe('ca-app-pub-3940256099942544/1712485313');
    expect(ads.getAppOpenUnitId()).toBe('ca-app-pub-3940256099942544/5662855259');
  });

  it('does not leak production unit IDs in test mode', () => {
    const ads = freshAds('android');
    expect(ads.getBannerUnitId()).not.toContain('6917313063209470');
    expect(ads.getInterstitialUnitId()).not.toContain('6917313063209470');
    expect(ads.getRewardedUnitId()).not.toContain('6917313063209470');
    expect(ads.getAppOpenUnitId()).not.toContain('6917313063209470');
  });
});

describe('test-ads initialization (TEST_ADS = true)', () => {
  it('starts the SDK immediately and preloads all formats without consent', async () => {
    state.initCalls = 0;
    state.adLoads = 0;
    state.gatherCalls = 0;
    const ads = freshAds('ios');

    await ads.initializeAds();

    expect(state.initCalls).toBe(1);
    expect(state.adLoads).toBe(3); // interstitial + rewarded + app open
    expect(state.gatherCalls).toBe(0); // consent gate skipped
    expect(ads.canRequestAds()).toBe(true);
  });

  it('stays disabled on web even in test mode', async () => {
    state.initCalls = 0;
    state.adLoads = 0;
    state.gatherCalls = 0;
    jest.resetModules();
    jest.replaceProperty(require('react-native').Platform, 'OS', 'web');
    const webAds = require('../lib/ads');

    expect(webAds.ADS_ENABLED).toBe(false);
    await webAds.initializeAds();
    expect(state.initCalls).toBe(0);
    expect(webAds.canRequestAds()).toBe(false);
  });
});
