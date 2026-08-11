// db/client.ts — opens the SQLite database once and runs migrations.

import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrate';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('prompts.db');
      await runMigrations(db);
      return db;
    })();
  }
  return dbPromise;
}

/** Resets the cached connection (used by tests only). */
export function _resetDbForTests(): void {
  dbPromise = null;
}
