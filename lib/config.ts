// lib/config.ts — app-level configuration flags.
//
// TEST_ADS: when true, EVERY ad format (banner, interstitial, rewarded,
// app open) uses Google's official TEST unit IDs on both platforms and the
// UMP consent gate is skipped.
//
//   - Google test ads always fill and never serve real traffic, so AdMob
//     will not limit or flag the account for test activity.
//   - Use this for development builds AND for verifying the release APK
//     before launch.
//
// Flip to false for the real monetization build that you submit to the
// Play Store / App Store. Only lib/ads.ts reads this flag.
export const TEST_ADS = true;
