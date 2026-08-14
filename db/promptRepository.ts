// db/promptRepository.ts — the entire data-access surface (spec PART B3).
// Screens and hooks must never touch storage directly.
//
// Platform storage split (project decision):
//   - iOS/Android → SQLite (expo-sqlite)  → promptRepository.sqlite.ts
//   - Web         → localStorage          → promptRepository.web.ts
//
// The public interface below is identical on every platform. Business logic
// (ranking tuple, row mapping, normalization) lives in
// promptRepository.shared.ts so both backends share exactly one implementation.

import { Platform } from 'react-native';
import type { PromptRepository } from './promptRepository.shared';
import { repository as sqliteRepository } from './promptRepository.sqlite';
import { repository as webRepository } from './promptRepository.web';

const impl: PromptRepository =
  Platform.OS === 'web' ? webRepository : sqliteRepository;

export const createPrompt = impl.createPrompt;
export const updatePrompt = impl.updatePrompt;
export const deletePrompt = impl.deletePrompt;
export const getPromptById = impl.getPromptById;
export const listAll = impl.listAll;
export const listFavorites = impl.listFavorites;
export const listRecentlyUsed = impl.listRecentlyUsed;
export const searchPrompts = impl.searchPrompts;
export const listCategories = impl.listCategories;
export const listTags = impl.listTags;
export const toggleFavorite = impl.toggleFavorite;
export const recordUsage = impl.recordUsage;
export const bulkInsert = impl.bulkInsert;
export const countAll = impl.countAll;
export const getAppMeta = impl.getAppMeta;
export const setAppMeta = impl.setAppMeta;
export const incrementAppMeta = impl.incrementAppMeta;
export const hasEverExported = impl.hasEverExported;
export const markExported = impl.markExported;
