// lib/ads.ts — Google AdMob configuration (react-native-google-mobile-ads).
//
// NOTE: AdMob is a NATIVE module — it does not run on web or in Expo Go.
// It requires a development build (`npx expo run:android` / EAS Build).
// This module is web-safe: on web it exports inert stubs so the web dev
// server keeps working (see metro.config.js resolver alias).
//
// TEST vs PRODUCTION ADS (see lib/config.ts `TEST_ADS`):
//   - TEST_ADS = true: every format uses Google's official test unit IDs on
//     both platforms. Test ads always fill and never serve real traffic, so
//     AdMob never limits the account for test activity. The UMP consent gate
//     is skipped (test ads are non-personalized and harmless).
//   - TEST_ADS = false: production unit IDs below are used. Replace the iOS
//     placeholders with real iOS unit IDs before an iOS release:
//       iOS banner:        ca-app-pub-<PUB>/<ADUNIT>
//       iOS interstitial:  ca-app-pub-<PUB>/<ADUNIT>
//       iOS rewarded:      ca-app-pub-<PUB>/<ADUNIT>
//       iOS app open:      ca-app-pub-<PUB>/<ADUNIT>
//
// MONETIZATION RULE (kept non-intrusive for the core Search → Fill → Copy loop):
//   - Banner: adaptive banner at the bottom of Home, Settings and Detail.
//   - Interstitial: shown after every 10 copies. When the threshold is hit the
//     UI offers a choice: watch a rewarded ad to earn a "shield" that skips
//     interstitials for the next 20 copies, or just show the interstitial.
//   - App Open: highest-eCPM format; shown on background → foreground
//     transitions only, throttled (never within 30s of cold start, at most
//     once every 3 minutes, never stacked on a recently shown interstitial).
//   - Ads only load lazily in the background and only show if ready — they
//     never delay or block the copy flow.
//   - Production (TEST_ADS=false) only: EU/EEA/UK ad requests are gated on
//     Google's consent flow (see initializeAds + canRequestAds).

import { Platform } from 'react-native';
import { getAppMeta, incrementAppMeta, setAppMeta } from '../db/promptRepository';
import { TEST_ADS } from './config';

export { TEST_ADS };

const AD_COPY_COUNT_KEY = 'ad_copy_count';
const AD_SHIELD_KEY = 'ad_shield_copies';

export const AD_FREQUENCY_COPY = 10; // interstitial after this many copies
export const SHIELD_COPIES = 20; // rewarded reward: skip interstitials for N copies

// App Open throttling (Google policy: never on cold start, cap frequency).
const APP_OPEN_SKIP_AFTER_LAUNCH_MS = 30_000; // skip right after cold start
const APP_OPEN_MIN_INTERVAL_MS = 3 * 60_000; // at most one every 3 minutes

export const ADS_ENABLED = Platform.OS !== 'web';

// --- Unit IDs ---
// TEST_ADS=true → Google's official test IDs (fill on any device, no real
// traffic). TEST_ADS=false → production IDs (Android live; iOS placeholders
// that still use test IDs until a release build exists).

// Official Google AdMob test ad unit IDs (both platforms).
// NOTE: banner uses Google's ADAPTIVE banner test unit (…/9214589741) because
// AdBanner renders with BannerAdSize.ANCHORED_ADAPTIVE_BANNER — matching the
// requested size avoids "placeholder but no ad renders" issues.
export const TEST_AD_UNIT_IDS = {
  bannerAndroid: 'ca-app-pub-3940256099942544/9214589741', // adaptive banner
  bannerIos: 'ca-app-pub-3940256099942544/9214589741', // adaptive banner
  interstitialAndroid: 'ca-app-pub-3940256099942544/1033173712',
  interstitialIos: 'ca-app-pub-3940256099942544/4411468910',
  rewardedAndroid: 'ca-app-pub-3940256099942544/5224354917',
  rewardedIos: 'ca-app-pub-3940256099942544/1712485313',
  appOpenAndroid: 'ca-app-pub-3940256099942544/3419835194',
  appOpenIos: 'ca-app-pub-3940256099942544/5662855259',
};

export const AD_UNIT_IDS = {
  bannerAndroid: 'ca-app-pub-6917313063209470/9880969806', // production banner
  bannerIos: TEST_AD_UNIT_IDS.bannerIos, // test until an iOS release build
  interstitialAndroid: 'ca-app-pub-6917313063209470/5366295718', // production interstitial
  interstitialIos: TEST_AD_UNIT_IDS.interstitialIos, // test until an iOS release build
  rewardedAndroid: 'ca-app-pub-6917313063209470/7062520767', // production rewarded
  rewardedIos: TEST_AD_UNIT_IDS.rewardedIos, // test until an iOS release build
  appOpenAndroid: 'ca-app-pub-6917313063209470/7967041349', // production app open
  appOpenIos: TEST_AD_UNIT_IDS.appOpenIos, // test until an iOS release build
};

function unitIds(): typeof AD_UNIT_IDS {
  return TEST_ADS ? TEST_AD_UNIT_IDS : AD_UNIT_IDS;
}

export function getBannerUnitId(): string {
  const ids = unitIds();
  return Platform.OS === 'ios' ? ids.bannerIos : ids.bannerAndroid;
}

export function getInterstitialUnitId(): string {
  const ids = unitIds();
  return Platform.OS === 'ios' ? ids.interstitialIos : ids.interstitialAndroid;
}

export function getRewardedUnitId(): string {
  const ids = unitIds();
  return Platform.OS === 'ios' ? ids.rewardedIos : ids.rewardedAndroid;
}

export function getAppOpenUnitId(): string {
  const ids = unitIds();
  return Platform.OS === 'ios' ? ids.appOpenIos : ids.appOpenAndroid;
}

// --- Web-safe lazy import of the native module ---

type NativeAdsModule = typeof import('react-native-google-mobile-ads');

let cachedNative: NativeAdsModule | null = null;

/**
 * Returns the real native module on Android/iOS, or null on web.
 * Imported lazily so the web bundle never evaluates native code.
 */
export function nativeModule(): NativeAdsModule | null {
  if (!ADS_ENABLED) return null;
  if (!cachedNative) {
    cachedNative = require('react-native-google-mobile-ads') as NativeAdsModule;
  }
  return cachedNative;
}

// Shared throttle so interstitial and app open never stack within a short
// window (showing two fullscreen ads back-to-back is a policy + UX problem).
let lastFullscreenAdShownAt = 0;
function markFullscreenAdShown(): void {
  lastFullscreenAdShownAt = Date.now();
}

// --- Interstitial manager (singleton) ---

class InterstitialManager {
  private ad: any = null;
  private loaded = false;
  private loadStarted = false;

  /** Kick off a background load after app start (fire-and-forget). */
  ensureLoaded(): void {
    const mod = nativeModule();
    if (!mod || this.loadStarted) return;
    this.loadStarted = true;
    const { InterstitialAd, AdEventType } = mod;
    try {
      this.ad = InterstitialAd.createForAdRequest(getInterstitialUnitId(), {
        requestNonPersonalizedAdsOnly: true,
      });
      this.ad.addAdEventListener(AdEventType.LOADED, () => {
        this.loaded = true;
      });
      this.ad.addAdEventListener(AdEventType.CLOSED, () => {
        this.loaded = false;
        this.ad?.load(); // preload the next one
      });
      this.ad.addAdEventListener(AdEventType.ERROR, (error: unknown) => {
        if (TEST_ADS) console.warn('[ads] interstitial load failed:', error);
        this.loaded = false;
      });
      this.ad.load();
    } catch {
      this.loadStarted = false;
    }
  }

  /** Show the interstitial if it's loaded. Resolves true if shown. */
  async showIfLoaded(): Promise<boolean> {
    const mod = nativeModule();
    if (!mod || !this.loaded || !this.ad) return false;
    try {
      this.loaded = false;
      await this.ad.show();
      markFullscreenAdShown();
      return true;
    } catch {
      // Recover from a failed show so interstitials keep working this session.
      this.loaded = false;
      try {
        this.ad?.load();
      } catch {
        // ignore; next app launch re-initializes
      }
      return false;
    }
  }
}

export const interstitial = new InterstitialManager();

// --- Rewarded manager (singleton) ---

class RewardedManager {
  private ad: any = null;
  private loaded = false;
  private loadStarted = false;
  // Resolver for the in-flight show(); resolves true only on EARNED_REWARD.
  private pendingResolve: ((earned: boolean) => void) | null = null;

  /** Kick off a background load after app start (fire-and-forget). */
  ensureLoaded(): void {
    const mod = nativeModule();
    if (!mod || this.loadStarted) return;
    this.loadStarted = true;
    const { RewardedAd, RewardedAdEventType, AdEventType } = mod;
    try {
      this.ad = RewardedAd.createForAdRequest(getRewardedUnitId(), {
        requestNonPersonalizedAdsOnly: true,
      });
      this.ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        this.loaded = true;
      });
      this.ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        // Only EARNED_REWARD grants the reward — closing early does not.
        this.pendingResolve?.(true);
      });
      this.ad.addAdEventListener(AdEventType.CLOSED, () => {
        this.loaded = false;
        // If EARNED_REWARD never fired, the user closed early: no reward.
        this.pendingResolve?.(false);
        this.pendingResolve = null;
        this.ad?.load(); // preload the next one
      });
      this.ad.addAdEventListener(AdEventType.ERROR, (error: unknown) => {
        if (TEST_ADS) console.warn('[ads] rewarded load failed:', error);
        this.loaded = false;
        this.pendingResolve?.(false);
        this.pendingResolve = null;
      });
      this.ad.load();
    } catch {
      this.loadStarted = false;
    }
  }

  /**
   * Show the rewarded ad if loaded. Resolves true only if the user watched it
   * to completion (EARNED_REWARD). Never throws.
   */
  showAndGrantReward(): Promise<boolean> {
    const mod = nativeModule();
    if (!mod || !this.loaded || !this.ad) {
      return Promise.resolve(false);
    }
    this.loaded = false;
    return new Promise<boolean>((resolve) => {
      this.pendingResolve = resolve;
      this.ad.show().catch(() => {
        this.pendingResolve?.(false);
        this.pendingResolve = null;
        try {
          this.ad?.load();
        } catch {
          // ignore
        }
      });
    });
  }
}

export const rewarded = new RewardedManager();

// --- App Open manager (singleton) ---
// Google's highest-eCPM format. Shown on background → foreground transitions
// (see hooks/useAppOpenAd.ts), throttled so it never feels intrusive.

class AppOpenAdManager {
  private ad: any = null;
  private loaded = false;
  private loadStarted = false;
  private lastShownAt = 0;
  private launchedAt = Date.now();

  /** Kick off a background load after app start (fire-and-forget). */
  ensureLoaded(): void {
    const mod = nativeModule();
    if (!mod || this.loadStarted) return;
    this.loadStarted = true;
    const { AppOpenAd, AdEventType } = mod;
    try {
      this.ad = AppOpenAd.createForAdRequest(getAppOpenUnitId(), {
        requestNonPersonalizedAdsOnly: true,
      });
      this.ad.addAdEventListener(AdEventType.LOADED, () => {
        this.loaded = true;
      });
      this.ad.addAdEventListener(AdEventType.CLOSED, () => {
        this.loaded = false;
        this.ad?.load(); // preload the next one
      });
      this.ad.addAdEventListener(AdEventType.ERROR, (error: unknown) => {
        if (TEST_ADS) console.warn('[ads] app open load failed:', error);
        this.loaded = false;
      });
      this.ad.load();
    } catch {
      this.loadStarted = false;
    }
  }

  /**
   * Show if eligible: cold-start window passed, throttled, and ad loaded.
   * Never throws and never blocks — the core loop is unaffected.
   */
  async tryShow(): Promise<boolean> {
    const mod = nativeModule();
    if (!mod || !this.loaded || !this.ad) return false;
    const now = Date.now();
    if (now - this.launchedAt < APP_OPEN_SKIP_AFTER_LAUNCH_MS) return false;
    if (now - this.lastShownAt < APP_OPEN_MIN_INTERVAL_MS) return false;
    // Never stack a fullscreen ad on a recently shown interstitial.
    if (now - lastFullscreenAdShownAt < APP_OPEN_MIN_INTERVAL_MS) return false;
    this.loaded = false;
    try {
      await this.ad.show();
      // Only consume the throttle after the ad actually showed, so a failed
      // show() doesn't block the next eligible attempt for 3 minutes.
      this.lastShownAt = Date.now();
      markFullscreenAdShown();
      return true;
    } catch {
      try {
        this.ad?.load();
      } catch {
        // ignore
      }
      return false;
    }
  }
}

export const appOpen = new AppOpenAdManager();

// --- Privacy options (UMP re-review) ---
// Google's UMP expects an in-app path for users to review/change their consent
// choices. Once the consent flow reports `privacyOptionsRequirementStatus` as
// REQUIRED, Settings shows a "Privacy options" row that presents the
// Google-rendered re-review form.

let privacyOptionsRequired = false;
const privacyOptionsListeners = new Set<() => void>();

/** True once the consent flow says the privacy-options form must be offered. */
export function isPrivacyOptionsRequired(): boolean {
  return ADS_ENABLED && privacyOptionsRequired;
}

/** Subscribe to privacy-options visibility changes (replays current value). */
export function subscribePrivacyOptions(listener: () => void): () => void {
  privacyOptionsListeners.add(listener);
  listener();
  return () => {
    privacyOptionsListeners.delete(listener);
  };
}

function setPrivacyOptionsRequired(required: boolean): void {
  if (privacyOptionsRequired === required) return;
  privacyOptionsRequired = required;
  privacyOptionsListeners.forEach((l) => l());
}

/** Present the Google-rendered privacy options form (native only, never throws). */
export async function showPrivacyOptions(): Promise<void> {
  const mod = nativeModule();
  if (!mod) return;
  try {
    await mod.AdsConsent.showPrivacyOptionsForm();
  } catch {
    // privacy options must never break the app
  }
}

// --- EU/EEA/UK consent gate (UMP) ---
// Google's EU User Consent Policy requires a consent flow for EEA/UK users
// before any ad can be requested. At startup we run the UMP flow and only
// start the SDK / preload ads once `canRequestAds` is true. If gathering
// consent fails (offline, etc.) the UMP SDK keeps the previous session's
// status, so we still attempt to load ads rather than losing monetization.
// The app serves non-personalized ads only — the consent choice does not
// change ad targeting, but the form must still be offered in the EEA.

let adsAllowed = false; // ad-request permission (banner + preloads)
const adsAllowedListeners = new Set<() => void>();

/** True once UMP consent allows requesting ads (always false on web). */
export function canRequestAds(): boolean {
  return adsAllowed;
}

/**
 * Subscribe to ad-permission changes (e.g. <AdBanner/> mounts when allowed).
 * The listener is invoked immediately with the current value so a subscriber
 * mounting after the flip always converges (no missed notification).
 */
export function subscribeAdsAllowed(listener: () => void): () => void {
  adsAllowedListeners.add(listener);
  listener();
  return () => {
    adsAllowedListeners.delete(listener);
  };
}

function setAdsAllowed(allowed: boolean): void {
  if (adsAllowed === allowed) return;
  adsAllowed = allowed;
  adsAllowedListeners.forEach((listener) => listener());
}

let sdkStarted = false;

/** Start the AdMob SDK and preload every ad format (once per app session). */
function startAds(): void {
  const mod = nativeModule();
  if (!mod || sdkStarted) return;
  sdkStarted = true;
  setAdsAllowed(true);
  try {
    // MobileAds is a callable factory: MobileAds().initialize()
    mod.default().initialize();
    interstitial.ensureLoaded();
    rewarded.ensureLoaded();
    appOpen.ensureLoaded();
  } catch {
    // ads must never break the app
  }
}

/**
 * Initialize the AdMob SDK (call once at app start, fire-and-forget).
 *
 * TEST_ADS=true: starts the SDK immediately — no consent gate. Google test
 * ads are non-personalized and never serve real traffic, so nothing blocks
 * them from loading on any device. This is the mode to verify the ad
 * pipeline before launch.
 *
 * TEST_ADS=false: runs the UMP consent flow first — on EEA/UK the
 * Google-rendered consent form is presented before any ad is requested.
 * Never blocks app startup and never throws.
 */
export async function initializeAds(): Promise<void> {
  const mod = nativeModule();
  if (!mod) return;
  if (TEST_ADS) {
    // Test mode: skip the consent gate entirely so test ads always load.
    startAds();
    return;
  }
  try {
    // Dev builds force the EEA geography so the form can be exercised on
    // emulators (auto-whitelisted) or whitelisted test devices; release
    // builds use the real geography. On a non-whitelisted physical device
    // the debug geography is ignored — whitelist it in the AdMob console to
    // test.
    const options = __DEV__
      ? { debugGeography: mod.AdsConsentDebugGeography.EEA }
      : undefined;
    const info = await mod.AdsConsent.gatherConsent(options);
    setPrivacyOptionsRequired(info?.privacyOptionsRequirementStatus === 'REQUIRED');
    if (info?.canRequestAds) {
      startAds();
    }
  } catch {
    // Consent gathering failed — UMP keeps the previous session's status, so
    // still try to load ads.
    startAds();
  }
}

/**
 * Grant the rewarded reward: skip interstitials for the next SHIELD_COPIES
 * copies. Call after the rewarded ad completes. Returns true on success.
 */
export async function grantAdShield(): Promise<boolean> {
  if (!ADS_ENABLED) return false;
  try {
    await setAppMeta(AD_SHIELD_KEY, String(SHIELD_COPIES));
    return true;
  } catch {
    return false;
  }
}

/** Number of copies still shielded from interstitials (0 = not shielded). */
export async function getShieldRemaining(): Promise<number> {
  if (!ADS_ENABLED) return 0;
  try {
    const raw = await getAppMeta(AD_SHIELD_KEY);
    return Math.max(0, Number(raw ?? '0'));
  } catch {
    return 0;
  }
}

/**
 * Called after every copy action (Fill & Copy + Quick Copy).
 * - If shielded (rewarded reward active): decrements the shield, no ad.
 * - Otherwise increments the counter; when the threshold is reached, resets
 *   the counter and returns true so the UI can offer the rewarded choice or
 *   show the interstitial. Never blocks the copy flow.
 *
 * @returns true when the interstitial threshold was just hit.
 */
export async function trackCopyAndMaybeShowAd(): Promise<boolean> {
  if (!ADS_ENABLED) return false;
  try {
    // Shielded? consume a shield copy and skip entirely.
    const shield = Number((await getAppMeta(AD_SHIELD_KEY)) ?? '0');
    if (shield > 0) {
      await setAppMeta(AD_SHIELD_KEY, String(shield - 1));
      return false;
    }

    const raw = await getAppMeta(AD_COPY_COUNT_KEY);
    const count = Number(raw ?? '0') + 1;
    if (count >= AD_FREQUENCY_COPY) {
      await setAppMeta(AD_COPY_COUNT_KEY, '0');
      return true; // UI decides: rewarded offer or interstitial
    }
    await incrementAppMeta(AD_COPY_COUNT_KEY);
    return false;
  } catch {
    return false;
  }
}
