// hooks/useAppOpenAd.ts — shows an App Open ad (Google's highest-eCPM format)
// when the app returns from background to foreground.
//
// Rules (throttling lives in lib/ads.ts, this hook only detects the transition):
//   - Cold start never triggers an ad (the first foreground isn't a transition).
//   - Only real background → active transitions count (iOS 'inactive' blips
//     like the notification shade do not trigger).
//   - Frequency caps inside appOpen.tryShow() (30s cold-start window, 3-min
//     interval, never stacked on a recent interstitial).

import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { appOpen } from '../lib/ads';

export function useAppOpenAd(): void {
  const prevState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (prevState.current === 'background' && next === 'active') {
        void appOpen.tryShow();
      }
      prevState.current = next;
    });
    return () => sub.remove();
  }, []);
}
