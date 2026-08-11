-- 001_init.sql — initial schema for Prompt Template Manager
-- Executed by db/migrate.ts as migration version 1.

CREATE TABLE IF NOT EXISTS prompts (
  id                  TEXT PRIMARY KEY,          -- uuid v4
  title               TEXT NOT NULL,
  content             TEXT NOT NULL,
  category            TEXT NOT NULL DEFAULT '',
  tags                TEXT NOT NULL DEFAULT '[]', -- JSON array string, e.g. '["dev","email"]'
  is_favorite         INTEGER NOT NULL DEFAULT 0, -- 0/1
  usage_count         INTEGER NOT NULL DEFAULT 0,
  last_used_at        INTEGER,                     -- unix ms, NULL if never used
  search_normalized   TEXT NOT NULL,               -- normalizeVietnamese(title + ' ' + content)
  created_at          INTEGER NOT NULL,             -- unix ms
  updated_at          INTEGER NOT NULL              -- unix ms
);

CREATE INDEX IF NOT EXISTS idx_prompts_search    ON prompts(search_normalized);
CREATE INDEX IF NOT EXISTS idx_prompts_last_used ON prompts(last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_favorite  ON prompts(is_favorite);
CREATE INDEX IF NOT EXISTS idx_prompts_usage     ON prompts(usage_count DESC);

CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
