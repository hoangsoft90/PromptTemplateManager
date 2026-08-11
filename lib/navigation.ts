// lib/navigation.ts — shared navigation helpers.
//
// safeBack():  calls router.back() when there is history to go back to;
//              otherwise REPLACES the current screen with the tab navigator
//              (e.g. when the user deep-links straight to a sub-screen, so
//              there is no back stack). `replace` (not `push`) avoids leaving
//              the dead-end screen underneath the tabs where a second back
//              would return to it.

import { router } from 'expo-router';

export function safeBack() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/(tabs)');
  }
}
