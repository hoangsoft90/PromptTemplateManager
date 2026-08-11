// stubs/react-native-google-mobile-ads.web.js
// Web stub for the native-only AdMob module. On web, ADS_ENABLED is false and
// none of these are ever invoked — this stub only exists so Metro can bundle
// the web build (the real module imports RN internals that fail on web).
// See metro.config.js resolveRequest.

const TestIds = {};
const BannerAdSize = {
  BANNER: 'BANNER',
  LARGE_BANNER: 'LARGE_BANNER',
  MEDIUM_RECTANGLE: 'MEDIUM_RECTANGLE',
  FULL_BANNER: 'FULL_BANNER',
  LEADERBOARD: 'LEADERBOARD',
  ADAPTIVE_BANNER: 'ADAPTIVE_BANNER',
  ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER',
  INLINE_ADAPTIVE_BANNER: 'INLINE_ADAPTIVE_BANNER',
  FLUID: 'FLUID',
  WIDE_SKYSCRAPER: 'WIDE_SKYSCRAPER',
};
const AdEventType = {
  LOADED: 'loaded',
  ERROR: 'error',
  OPENED: 'opened',
  CLOSED: 'closed',
  CLICKED: 'clicked',
  PAID: 'paid',
  IMPRESSION: 'impression',
};
const RewardedAdEventType = { LOADED: 'loaded', EARNED_REWARD: 'earned_reward' };
const AdsConsent = {};
const AdsConsentStatus = {};
const AdsConsentDebugGeography = {};

class InterstitialAd {
  static createForAdRequest() {
    return new InterstitialAd();
  }
  load() {}
  show() {
    return Promise.resolve();
  }
  addAdEventListener() {
    return () => {};
  }
}

class RewardedAd {
  static createForAdRequest() {
    return new RewardedAd();
  }
  load() {}
  show() {
    return Promise.resolve();
  }
  addAdEventListener() {
    return () => {};
  }
}

class AppOpenAd {
  static createForAdRequest() {
    return new AppOpenAd();
  }
  load() {}
  show() {
    return Promise.resolve();
  }
  addAdEventListener() {
    return () => {};
  }
}

const BannerAd = () => null;

function MobileAds() {
  return {
    initialize: () => Promise.resolve([]),
  };
}

export default MobileAds;
export {
  MobileAds,
  TestIds,
  BannerAdSize,
  BannerAd,
  InterstitialAd,
  RewardedAd,
  AppOpenAd,
  AdEventType,
  RewardedAdEventType,
  AdsConsent,
  AdsConsentStatus,
  AdsConsentDebugGeography,
};
