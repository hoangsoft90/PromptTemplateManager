// lib/importSession.ts — transient store for import preview state.
// expo-router params are string-only; the parsed import outcome list is
// kept here between the Settings screen (picker) and Import Preview screen.

import type { ExportFilePrompt, ImportOutcome } from '../types/prompt';

interface PendingImport {
  outcomes: ImportOutcome[];
  incoming: ExportFilePrompt[];
  fileName: string;
}

let pending: PendingImport | null = null;

export function setPendingImport(data: PendingImport): void {
  pending = data;
}

export function getPendingImport(): PendingImport | null {
  return pending;
}

export function clearPendingImport(): void {
  pending = null;
}
