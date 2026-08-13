// components/AdBanner.tsx — adaptive AdMob banner.
// Web-safe: renders nothing on web (AdMob is native-only).
// Consent-gated: mounts the BannerAd only after the UMP consent flow permits
// ad requests (see lib/ads.ts canRequestAds). In test mode (TEST_ADS in
// lib/config.ts) ads are allowed immediately and use Google test unit IDs.

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  TEST_ADS,
  canRequestAds,
  getBannerUnitId,
  nativeModule,
  subscribeAdsAllowed,
} from '../lib/ads';
import { colors } from '../lib/theme';

export function AdBanner() {
  const mod = nativeModule();
  const [allowed, setAllowed] = useState(canRequestAds());

  useEffect(
    () => subscribeAdsAllowed(() => setAllowed(canRequestAds())),
    []
  );

  if (!mod || !allowed) return null; // web / unsupported / consent pending

  const { BannerAd, BannerAdSize } = mod;
  // lib/ads.ts picks test vs production IDs from the TEST_ADS flag.
  const unitId = getBannerUnitId();

  return (
    <View style={styles.container} accessibilityLabel="Advertisement">
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={(error) => {
          // Test mode: surface load failures so banner issues are visible
          // (e.g. wrong app ID, no network). Production stays silent.
          if (TEST_ADS) console.warn('[ads] banner load failed:', error);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
    minHeight: 50,
  },
});
