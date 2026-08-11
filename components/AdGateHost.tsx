// components/AdGateHost.tsx — renders the "fewer ads?" offer dialog once at
// the root layout. Visibility is driven by the module-level adGateStore so it
// survives navigation (the copy flow navigates away immediately after copy).

import React, { useEffect, useState } from 'react';
import {
  chooseShowInterstitial,
  chooseWatchRewarded,
  isAdGateVisible,
  subscribeAdGate,
} from '../lib/adGateStore';
import { ConfirmDialog } from './ConfirmDialog';

export function AdGateHost() {
  const [visible, setVisible] = useState(isAdGateVisible());

  useEffect(() => subscribeAdGate(setVisible), []);

  return (
    <ConfirmDialog
      visible={visible}
      title="Want fewer ads?"
      message="Watch a short rewarded ad to skip interstitials for your next 20 copies. Or show the ad now."
      confirmLabel="Watch ad"
      cancelLabel="Show ad"
      destructive={false}
      onConfirm={() => void chooseWatchRewarded()}
      onCancel={() => void chooseShowInterstitial()}
    />
  );
}
