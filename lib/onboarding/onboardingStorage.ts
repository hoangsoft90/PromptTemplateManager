// lib/onboarding/onboardingStorage.ts — persistence for in-app guidance.
//
// "Has the user already seen this tooltip / tour?" is the core trigger rule
// (show once for new users, never spam on repeat actions). Per project
// decision (design.md D1), non-DB prefs live in the app_meta table — no extra
// AsyncStorage/MMKV dependency. The platform repository (SQLite on
// iOS/Android, localStorage on web) is injected as a tiny store interface so
// this module is pure & unit-testable.

import type { MetaStore } from './types';

// --- key helpers (namespaced so they can't collide with app_meta) ---

const tooltipSeenKey = (id: string) => `onboarding:tooltip:${id}:seen`;
const tourCompletedKey = (tourId: string) => `onboarding:tour:${tourId}:completed`;
const stepDoneKey = (tourId: string, stepId: string) =>
  `onboarding:tour:${tourId}:step:${stepId}:done`;

// --- tooltips: "shown once per user" ---

/** True if the tooltip with this id has already been shown this install. */
export async function hasSeenTooltip(store: MetaStore, id: string): Promise<boolean> {
  return (await store.get(tooltipSeenKey(id))) === '1';
}

/** Marks a tooltip as shown (called the first time it is displayed). */
export async function markTooltipSeen(store: MetaStore, id: string): Promise<void> {
  await store.set(tooltipSeenKey(id), '1');
}

// --- tours: "completed once", with per-step progress so a skipped/interrupted
//     tour resumes at the first unfinished step instead of restarting ---

/** True if the whole tour has been completed (or explicitly skipped). */
export async function isTourCompleted(store: MetaStore, tourId: string): Promise<boolean> {
  return (await store.get(tourCompletedKey(tourId))) === '1';
}

export async function markTourCompleted(store: MetaStore, tourId: string): Promise<void> {
  await store.set(tourCompletedKey(tourId), '1');
}

/** True if a specific tour step was already completed by the user. */
export async function isStepCompleted(
  store: MetaStore,
  tourId: string,
  stepId: string
): Promise<boolean> {
  return (await store.get(stepDoneKey(tourId, stepId))) === '1';
}

export async function markStepCompleted(
  store: MetaStore,
  tourId: string,
  stepId: string
): Promise<void> {
  await store.set(stepDoneKey(tourId, stepId), '1');
}

/**
 * Index of the first step in `steps` that has not been completed yet.
 * Returns `steps.length` when every step is done (tour effectively finished).
 */
export async function firstIncompleteStep(
  store: MetaStore,
  tourId: string,
  steps: { id: string }[]
): Promise<number> {
  for (let i = 0; i < steps.length; i++) {
    if (!(await isStepCompleted(store, tourId, steps[i].id))) return i;
  }
  return steps.length;
}
