// __tests__/useBackupReminder.test.tsx — locks the backup banner rules
// (spec B7): shown when count >= 5 and never exported; dismissible; re-shows
// only after 20 more prompts; hidden forever after an export.
//
// Strategy (same as adGate.test.ts): the repo mock exposes plain jest.fn()s
// and beforeEach wires them to an in-memory map, so dismiss() → setAppMeta()
// → refresh() → getAppMeta() round-trips through real state instead of
// hand-replayed mocks.
//
// NOTE: the hook's state fields live on the latest render, so assertions read
// the module-level `result` AFTER each `act` (captured refs go stale).

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import {
  countAll,
  getAppMeta,
  hasEverExported,
  setAppMeta,
} from '../db/promptRepository';

jest.mock('../db/promptRepository', () => ({
  countAll: jest.fn(),
  hasEverExported: jest.fn(),
  getAppMeta: jest.fn(),
  setAppMeta: jest.fn(),
}));

const mockCountAll = countAll as jest.Mock;
const mockHasEverExported = hasEverExported as jest.Mock;
const mockGetAppMeta = getAppMeta as jest.Mock;
const mockSetAppMeta = setAppMeta as jest.Mock;

// In-memory stand-in for the backup_banner_dismissed_at app_meta row.
const meta = new Map<string, string>();

import { useBackupReminder } from '../hooks/useBackupReminder';

type HookResult = ReturnType<typeof useBackupReminder>;
let result!: HookResult;

function Harness() {
  result = useBackupReminder();
  return null;
}

async function renderReminder(): Promise<void> {
  await act(async () => {
    renderer.create(<Harness />);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  meta.clear();
  mockCountAll.mockResolvedValue(5);
  mockHasEverExported.mockResolvedValue(false);
  mockGetAppMeta.mockImplementation((key: string) =>
    Promise.resolve(meta.get(key) ?? null)
  );
  mockSetAppMeta.mockImplementation((key: string, value: string) => {
    meta.set(key, value);
    return Promise.resolve();
  });
});

describe('useBackupReminder', () => {
  it('is hidden when the user has never exported but has fewer than 5 prompts', async () => {
    mockCountAll.mockResolvedValue(4);

    await renderReminder();

    expect(result.visible).toBe(false);
    expect(result.loading).toBe(false);
  });

  it('is hidden once the user has exported', async () => {
    mockHasEverExported.mockResolvedValue(true);

    await renderReminder();

    expect(result.visible).toBe(false);
  });

  it('shows at 5+ prompts when never exported and never dismissed', async () => {
    await renderReminder();

    expect(result.visible).toBe(true);
  });

  it('dismisses and remembers the dismissal count', async () => {
    await renderReminder();
    expect(result.visible).toBe(true);

    await act(async () => {
      await result.dismiss();
    });

    expect(result.visible).toBe(false);
    expect(mockSetAppMeta).toHaveBeenCalledWith(
      'backup_banner_dismissed_at',
      expect.stringContaining('"count":5')
    );
  });

  it('stays hidden after dismissal and only re-shows after 20 more prompts', async () => {
    await renderReminder();
    await act(async () => {
      await result.dismiss();
    });

    // 5 + 19 = 24 → still hidden (dismissal record read from the map).
    mockCountAll.mockResolvedValue(24);
    await act(async () => {
      await result.refresh();
    });
    expect(result.visible).toBe(false);

    // 5 + 20 = 25 → re-shows.
    mockCountAll.mockResolvedValue(25);
    await act(async () => {
      await result.refresh();
    });
    expect(result.visible).toBe(true);
  });
});
