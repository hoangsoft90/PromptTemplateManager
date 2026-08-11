// components/AdBanner.tsx — adaptive AdMob banner.
// Web-safe: renders nothing on web (AdMob is native-only).
// Consent-gated: mounts the BannerAd only after the UMP consent flow permits
// ad requests (see lib/ads.ts canRequestAds).

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
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

  const { BannerAd, BannerAdSize, TestIds } = mod;
  // Dev builds always use Google's test ads; production uses configured unit IDs.
  const unitId = __DEV__ ? TestIds.ADAPTIVE_BANNER : getBannerUnitId();

  return (
    <View style={styles.container} accessibilityLabel="Advertisement">
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
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
