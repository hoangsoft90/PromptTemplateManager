// app/index.tsx — '/' redirects to the tab navigator.
// The tab layout is at app/(tabs)/_layout.tsx with All / Favorites / Recent tabs.

import { Redirect } from 'expo-router';

export default function IndexRedirect() {
  return <Redirect href="/(tabs)" />;
}