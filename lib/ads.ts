// lib/ads.ts — Google AdMob configuration (react-native-google-mobile-ads).
//
// NOTE: AdMob is a NATIVE module — it does not run on web or in Expo Go.
// It requires a development build (`npx expo run:android` / EAS Build).
// This module is web-safe: on web it exports inert stubs so the web dev
// server keeps working (see metro.config.js resolver alias).
//
// AD UNIT IDS: Android uses the real AdMob unit IDs (production, package
// com.hoangweb.prompttemplate). iOS still uses Google test IDs — replace with
// production iOS unit IDs before an iOS release:
//   - iOS banner:        ca-app-pub-<PUB>/<ADUNIT>
//   - iOS interstitial:  ca-app-pub-<PUB>/<ADUNIT>
//   - iOS rewarded:      ca-app-pub-<PUB>/<ADUNIT>
//   - iOS app open:      ca-app-pub-<PUB>/<ADUNIT>
// androidAppId in app.json is already the real Android app ID.
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
//   - EU/EEA/UK (UMP): all ad requests are gated on Google's consent flow
//     (see initializeAds + canRequestAds).

import { Platform } from 'react-native';
import { getAppMeta, incrementAppMeta, setAppMeta } from '../db/promptRepository';

const AD_COPY_COUNT_KEY = 'ad_copy_count';
const AD_SHIELD_KEY = 'ad_shield_copies';

export const AD_FREQUENCY_COPY = 10; // interstitial after this many copies
export const SHIELD_COPIES = 20; // rewarded reward: skip interstitials for N copies

// App Open throttling (Google policy: never on cold start, cap frequency).
const APP_OPEN_SKIP_AFTER_LAUNCH_MS = 30_000; // skip right after cold start
const APP_OPEN_MIN_INTERVAL_MS = 3 * 60_000; // at most one every 3 minutes

export const ADS_ENABLED = Platform.OS !== 'web';

// --- Unit IDs (Android: production; iOS: test until a release build) ---

export const AD_UNIT_IDS = {
  bannerAndroid: 'ca-app-pub-6917313063209470/9880969806', // production banner
  bannerIos: 'ca-app-pub-3940256099942544/2934735716', // test banner (iOS)
  interstitialAndroid: 'ca-app-pub-6917313063209470/5366295718', // production interstitial
  interstitialIos: 'ca-app-pub-3940256099942544/4411468910', // test interstitial (iOS)
  rewardedAndroid: 'ca-app-pub-6917313063209470/7062520767', // production rewarded
  rewardedIos: 'ca-app-pub-3940256099942544/1712485313', // test rewarded (iOS)
  appOpenAndroid: 'ca-app-pub-6917313063209470/7967041349', // production app open
  appOpenIos: 'ca-app-pub-3940256099942544/5575463023', // test app open (iOS)
};

export function getBannerUnitId(): string {
  return Platform.OS === 'ios' ? AD_UNIT_IDS.bannerIos : AD_UNIT_IDS.bannerAndroid;
}

export function getInterstitialUnitId(): string {
  return Platform.OS === 'ios'
    ? AD_UNIT_IDS.interstitialIos
    : AD_UNIT_IDS.interstitialAndroid;
}

export function getRewardedUnitId(): string {
  return Platform.OS === 'ios' ? AD_UNIT_IDS.rewardedIos : AD_UNIT_IDS.rewardedAndroid;
}

export function getAppOpenUnitId(): string {
  return Platform.OS === 'ios' ? AD_UNIT_IDS.appOpenIos : AD_UNIT_IDS.appOpenAndroid;
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
      this.ad.addAdEventListener(AdEventType.ERROR, () => {
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
      this.ad.addAdEventListener(AdEventType.ERROR, () => {
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
      this.ad.addAdEventListener(AdEventType.ERROR, () => {
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
 * Runs the UMP consent flow first — on EEA/UK the Google-rendered consent
 * form is presented before any ad is requested. Never blocks app startup and
 * never throws.
 */
export async function initializeAds(): Promise<void> {
  const mod = nativeModule();
  if (!mod) return;
  try {
    // Dev builds force the EEA geography so the form can be exercised on
    // emulators/test devices; release builds use the real geography.
    // Dev builds force the EEA geography so the form can be exercised on
    // emulators (auto-whitelisted) or whitelisted test devices; release builds
    // use the real geography. On a non-whitelisted physical device the debug
    // geography is ignored — whitelist it in the AdMob console to test.
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
