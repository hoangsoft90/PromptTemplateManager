// __tests__/consent.test.ts — locks the UMP consent gate in lib/ads.ts:
//   - the SDK + ad preloads only start after gatherConsent returns canRequestAds
//   - canRequestAds = false → nothing starts, banner stays hidden
//   - a failed gatherConsent falls back to the previous session (still starts)
//   - canRequestAds()/subscribeAdsAllowed drive the <AdBanner/> mount decision
//
// Strategy:
//   - `jest.mock('react-native-google-mobile-ads')`: the factory re-runs after
//     `jest.resetModules()`, so every test gets a fresh mock + fresh state
//     (`__mockState`), mirroring the adGate test's module-freshness approach.
//   - `jest.mock('../db/promptRepository')` so lib/ads never touches SQLite.
//   - `jest.replaceProperty(Platform, 'OS', ...)` so ADS_ENABLED is true on
//     the native path and false on web.

import { Platform } from 'react-native';

jest.mock('../db/promptRepository', () => ({
  getAppMeta: jest.fn(() => Promise.resolve(null)),
  setAppMeta: jest.fn(() => Promise.resolve()),
  incrementAppMeta: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-google-mobile-ads', () => {
  const state = {
    gatherError: null as Error | null,
    canRequestAds: true,
    privacyOptionsRequired: false,
    initCalls: 0,
    adLoads: 0,
  };

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
      gatherConsent: jest.fn(async () => {
        if (state.gatherError) throw state.gatherError;
        return {
          status: state.canRequestAds ? 'OBTAINED' : 'REQUIRED',
          canRequestAds: state.canRequestAds,
          privacyOptionsRequirementStatus: state.privacyOptionsRequired
            ? 'REQUIRED'
            : 'NOT_REQUIRED',
          isConsentFormAvailable: true,
        };
      }),
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

type MockModule = {
  __mockState: {
    gatherError: Error | null;
    canRequestAds: boolean;
    privacyOptionsRequired: boolean;
    initCalls: number;
    adLoads: number;
  };
  AdsConsent: { gatherConsent: jest.Mock; showPrivacyOptionsForm: jest.Mock };
};

/** Fresh module registry + fresh mock state, with Platform pointed at 'ios'. */
function freshNative(): { mockState: MockModule['__mockState']; ads: typeof import('../lib/ads') } {
  jest.resetModules();
  jest.replaceProperty(require('react-native').Platform, 'OS', 'ios');
  const mock = require('react-native-google-mobile-ads') as MockModule;
  return { mockState: mock.__mockState, ads: require('../lib/ads') };
}

describe('initializeAds (UMP consent gate)', () => {
  it('starts the SDK and preloads every ad format when consent allows', async () => {
    const { mockState, ads } = freshNative();
    mockState.canRequestAds = true;

    await ads.initializeAds();

    expect(mockState.initCalls).toBe(1);
    expect(mockState.adLoads).toBe(3); // interstitial + rewarded + app open
    expect(ads.canRequestAds()).toBe(true);
  });

  it('stays dormant when consent is required but not yet obtained', async () => {
    const { mockState, ads } = freshNative();
    mockState.canRequestAds = false;

    await ads.initializeAds();

    expect(mockState.initCalls).toBe(0);
    expect(mockState.adLoads).toBe(0);
    expect(ads.canRequestAds()).toBe(false);
  });

  it('falls back to previous-session consent when gathering fails', async () => {
    const { mockState, ads } = freshNative();
    mockState.gatherError = new Error('network down');

    await ads.initializeAds();

    expect(mockState.initCalls).toBe(1);
    expect(mockState.adLoads).toBe(3);
    expect(ads.canRequestAds()).toBe(true);
  });

  it('does not start the SDK twice across repeated calls', async () => {
    const { mockState, ads } = freshNative();
    mockState.canRequestAds = true;

    await ads.initializeAds();
    await ads.initializeAds();

    expect(mockState.initCalls).toBe(1);
    expect(mockState.adLoads).toBe(3);
  });

  it('notifies subscribers when ads become allowed (banner gate)', async () => {
    const { mockState, ads } = freshNative();
    const seen: boolean[] = [];
    // subscribeAdsAllowed replays the current value (false) immediately.
    ads.subscribeAdsAllowed(() => seen.push(ads.canRequestAds()));
    expect(ads.canRequestAds()).toBe(false);

    mockState.canRequestAds = true;
    await ads.initializeAds();

    expect(ads.canRequestAds()).toBe(true);
    expect(seen).toEqual([false, true]);
  });

  it('requests consent with the EEA debug geography in dev builds', async () => {
    const { ads } = freshNative();

    await ads.initializeAds();

    const mock = require('react-native-google-mobile-ads') as MockModule;
    expect(mock.AdsConsent.gatherConsent).toHaveBeenCalledWith(
      expect.objectContaining({ debugGeography: 1 }) // AdsConsentDebugGeography.EEA
    );
  });
});

describe('privacy options (UMP re-review)', () => {
  it('stays hidden when consent did not mark them required', async () => {
    const { mockState, ads } = freshNative();
    mockState.privacyOptionsRequired = false;

    await ads.initializeAds();

    expect(ads.isPrivacyOptionsRequired()).toBe(false);
  });

  it('becomes visible and notifies subscribers when required', async () => {
    const { mockState, ads } = freshNative();
    mockState.privacyOptionsRequired = true;
    const seen: boolean[] = [];
    ads.subscribePrivacyOptions(() => seen.push(ads.isPrivacyOptionsRequired()));

    await ads.initializeAds();

    expect(ads.isPrivacyOptionsRequired()).toBe(true);
    expect(seen).toEqual([false, true]); // replay + flip
  });

  it('presents the privacy options form on demand', async () => {
    const { ads } = freshNative();

    await ads.showPrivacyOptions();

    const mock = require('react-native-google-mobile-ads') as MockModule;
    expect(mock.AdsConsent.showPrivacyOptionsForm).toHaveBeenCalled();
  });
});

describe('web platform', () => {
  it('never starts ads or flips the consent gate on web', async () => {
    jest.resetModules();
    jest.replaceProperty(require('react-native').Platform, 'OS', 'web');
    const webAds = require('../lib/ads');
    const mock = require('react-native-google-mobile-ads') as MockModule;

    await webAds.initializeAds();

    expect(webAds.ADS_ENABLED).toBe(false);
    expect(mock.__mockState.initCalls).toBe(0);
    expect(mock.__mockState.adLoads).toBe(0);
    expect(webAds.canRequestAds()).toBe(false);
  });
});
