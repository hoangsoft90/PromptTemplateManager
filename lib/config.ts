// lib/config.ts — app-level configuration flags.
//
// TEST_ADS: when false (PRODUCTION), every ad format uses the REAL AdMob
// unit IDs in lib/ads.ts and all requests are gated on the UMP consent flow
// (EEA/UK users see Google's consent form). This is the mode for the build
// submitted to the Play Store / App Store.
//
// When true (development/testing), every format uses Google's official TEST
// unit IDs on both platforms and the UMP consent gate is skipped — test ads
// always fill and never serve real traffic, so AdMob will not limit or flag
// the account for test activity. Only lib/ads.ts reads this flag.
export const TEST_ADS = false;
