// __tests__/onboardingStorage.test.ts — locks the onboarding persistence
// rules (show once per install, tours complete once, per-step resume).

import type { MetaStore } from '../lib/onboarding/types';
import * as storage from '../lib/onboarding/onboardingStorage';

/** In-memory MetaStore backed by a Map. */
function makeStore(): { store: MetaStore; map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    store: {
      get: async (key) => map.get(key) ?? null,
      set: async (key, value) => {
        map.set(key, value);
      },
    },
  };
}

describe('tooltip seen-once', () => {
  it('returns false the first time and true after markTooltipSeen', async () => {
    const { store } = makeStore();

    expect(await storage.hasSeenTooltip(store, 'home-fab')).toBe(false);

    await storage.markTooltipSeen(store, 'home-fab');

    expect(await storage.hasSeenTooltip(store, 'home-fab')).toBe(true);
  });

  it('scopes seen state per tooltip id', async () => {
    const { store } = makeStore();
    await storage.markTooltipSeen(store, 'home-fab');

    expect(await storage.hasSeenTooltip(store, 'home-fab')).toBe(true);
    expect(await storage.hasSeenTooltip(store, 'settings-import')).toBe(false);
  });
});

describe('tour completion', () => {
  it('marks a tour completed once', async () => {
    const { store } = makeStore();

    expect(await storage.isTourCompleted(store, 'first-run')).toBe(false);
    await storage.markTourCompleted(store, 'first-run');
    expect(await storage.isTourCompleted(store, 'first-run')).toBe(true);
  });
});

describe('per-step progress & resume', () => {
  const steps = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('starts at step 0 when nothing is done', async () => {
    const { store } = makeStore();
    expect(await storage.firstIncompleteStep(store, 'tour1', steps)).toBe(0);
  });

  it('resumes at the first unfinished step', async () => {
    const { store } = makeStore();
    await storage.markStepCompleted(store, 'tour1', 'a');
    await storage.markStepCompleted(store, 'tour1', 'b');

    expect(await storage.firstIncompleteStep(store, 'tour1', steps)).toBe(2);
  });

  it('returns steps.length when every step is done', async () => {
    const { store } = makeStore();
    for (const s of steps) await storage.markStepCompleted(store, 'tour1', s.id);

    expect(await storage.firstIncompleteStep(store, 'tour1', steps)).toBe(steps.length);
  });

  it('scopes step progress per tour', async () => {
    const { store } = makeStore();
    await storage.markStepCompleted(store, 'tour1', 'a');

    expect(await storage.firstIncompleteStep(store, 'tour2', steps)).toBe(0);
  });
});
