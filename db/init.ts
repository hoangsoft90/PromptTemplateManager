// db/init.ts — platform-aware storage bootstrap used by the root layout.
//   - iOS/Android: opens the SQLite database + runs migrations (db/client.ts)
//   - Web:         initializes the localStorage backend (schema version marker
//                  so future schema changes have a migration hook).
// Everything else goes through db/promptRepository.ts, which picks the
// platform backend automatically.

import { Platform } from 'react-native';
import { getDb } from './client';
import { initWebStorage } from './promptRepository.web';

export async function initStorage(): Promise<void> {
  if (Platform.OS === 'web') {
    await initWebStorage();
    return;
  }
  await getDb(); // opens DB + runs migrations
}
