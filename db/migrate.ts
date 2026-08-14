// db/migrate.ts — migration scaffold driven by PRAGMA user_version.
// Each migration corresponds to a file in db/migrations/. The .sql files
// are bundled as Metro assets (see metro.config.js) and read at runtime.

import { Asset } from 'expo-asset';
import type { SQLiteDatabase } from 'expo-sqlite';
import { readTextFile } from '../lib/fileIO';
import { computeSearchNormalized } from './promptRepository.shared';
import type { PromptRow } from '../types/prompt';

type Migration = { version: number; up: (db: SQLiteDatabase) => Promise<void> };

// Static require so Metro can resolve the asset at build time.
const MIGRATION_ASSETS: Record<number, number> = {
  1: require('./migrations/001_init.sql'),
};

async function loadMigrationSql(version: number): Promise<string> {
  const asset = Asset.fromModule(MIGRATION_ASSETS[version]);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  // Web-safe: expo-file-system's File API does not exist on web, so read via
  // fetch (asset.uri is an http URL on web) instead of `new File(uri).text()`.
  return readTextFile(uri);
}

const migrations: Migration[] = [
  {
    version: 1,
    up: async (db) => {
      const sql = await loadMigrationSql(1);
      await db.execAsync(sql);
    },
  },
  {
    // v2: search_normalized now includes category + tags (category/tag search,
    // same computation as buildCreateRow/buildImportRow). Recompute existing
    // rows so old data is searchable the same way as newly created rows.
    // This is idempotent — safe to re-run after a partial failure.
    version: 2,
    up: async (db) => {
      const rows = await db.getAllAsync<PromptRow>('SELECT * FROM prompts');
      for (const row of rows) {
        let tags: string[] = [];
        try {
          const parsed: unknown = JSON.parse(row.tags);
          if (Array.isArray(parsed)) tags = parsed.map(String);
        } catch {
          tags = [];
        }
        await db.runAsync('UPDATE prompts SET search_normalized = ? WHERE id = ?', [
          computeSearchNormalized(row.title, row.content, row.category, tags),
          row.id,
        ]);
      }
    },
  },
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const { user_version } = (await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  )) ?? { user_version: 0 };
  for (const m of migrations) {
    if (m.version > user_version) {
      await m.up(db);
      await db.execAsync(`PRAGMA user_version = ${m.version}`);
    }
  }
}
