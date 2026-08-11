// types/prompt.ts — domain types per implementation spec PART B2

/** Raw row as stored in SQLite (snake_case). */
export interface PromptRow {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string; // raw JSON string as stored
  is_favorite: 0 | 1;
  usage_count: number;
  last_used_at: number | null;
  search_normalized: string;
  created_at: number;
  updated_at: number;
}

/** Domain prompt used across the UI (camelCase, parsed tags). */
export interface Prompt {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[]; // parsed
  isFavorite: boolean;
  usageCount: number;
  lastUsedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Variable {
  name: string; // canonical lowercase key, e.g. "tone"
  label: string; // display casing from first occurrence, e.g. "Tone"
  inputType: 'text' | 'textarea';
  placeholder?: string;
}

export interface ExportFilePrompt {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  isFavorite: boolean;
}

export interface ExportFile {
  format: 'prompt-template-manager';
  version: 1;
  exportedAt: number;
  prompts: ExportFilePrompt[];
}

export type ImportOutcome =
  | { action: 'created'; prompt: ExportFilePrompt }
  | { action: 'skipped_duplicate'; id: string }
  | { action: 'created_new_id'; originalId: string; newId: string }
  | { action: 'invalid'; index: number; reason: string };
