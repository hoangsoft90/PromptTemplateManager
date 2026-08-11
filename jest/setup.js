// Jest setup — mock expo native modules that don't run under Node.

jest.mock('expo-crypto', () => ({
  randomUUID: () =>
    `jest-uuid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
}));
