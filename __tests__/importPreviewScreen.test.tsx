// __tests__/importPreviewScreen.test.tsx — locks the Import Preview screen
// (spec B6):
//   - shows the pending file name + breakdown
//   - Confirm import → applyImport(outcomes, incoming) → clear session →
//     toast "Imported N prompts" → safeBack()
//   - Cancel → clear session + safeBack(), never imports
//   - applyImport failure → toast "Import failed", stays on screen
//   - deep link without a pending session → MissingState fallback

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import ImportPreviewScreen from '../app/settings/import-preview';
import { applyImport } from '../lib/importExport';
import { clearPendingImport, getPendingImport } from '../lib/importSession';
import { safeBack } from '../lib/navigation';
import { useToast } from '../components/Toast';
import type { ExportFilePrompt, ImportOutcome } from '../types/prompt';
import { pressByText, textsIn } from '../jest/testUtils';

jest.mock('../lib/importSession', () => ({
  getPendingImport: jest.fn(),
  clearPendingImport: jest.fn(),
}));

jest.mock('../lib/importExport', () => ({
  applyImport: jest.fn(),
}));

jest.mock('../lib/navigation', () => ({
  safeBack: jest.fn(),
}));

jest.mock('../components/Toast', () => ({
  useToast: jest.fn(),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockGetPendingImport = getPendingImport as jest.Mock;
const mockClearPendingImport = clearPendingImport as jest.Mock;
const mockApplyImport = applyImport as jest.Mock;
const mockSafeBack = safeBack as jest.Mock;
const mockUseToast = useToast as jest.Mock;
const mockShow = jest.fn();

const prompt: ExportFilePrompt = {
  id: 'p1',
  title: 'T',
  content: 'C',
  category: '',
  tags: [],
  isFavorite: false,
};

const pending = {
  fileName: 'backup.json',
  outcomes: [
    { action: 'created', prompt },
    { action: 'skipped_duplicate', id: 'old' },
  ] as ImportOutcome[],
  incoming: [prompt],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseToast.mockReturnValue({ show: mockShow });
  mockGetPendingImport.mockReturnValue(pending);
  mockApplyImport.mockResolvedValue({ created: 2 });
});

function renderScreen(): renderer.ReactTestRenderer {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<ImportPreviewScreen />);
  });
  return tree;
}

async function confirmImport(tree: renderer.ReactTestRenderer): Promise<void> {
  await act(async () => {
    tree.root
      .findAll((n) => n.props.accessibilityLabel === 'Confirm import' && typeof n.props.onPress === 'function')[0]
      .props.onPress();
  });
}

describe('ImportPreviewScreen', () => {
  it('shows the pending file name and the outcome breakdown', () => {
    const tree = renderScreen();
    const texts = textsIn(tree);

    expect(texts).toContain('backup.json — ready to import');
    expect(texts).toContain('1 new');
    expect(texts).toContain('1 skipped (duplicate)');
  });

  it('Confirm import applies (outcomes, incoming), clears, toasts and goes back', async () => {
    const tree = renderScreen();

    await confirmImport(tree);

    expect(mockApplyImport).toHaveBeenCalledTimes(1);
    expect(mockApplyImport).toHaveBeenCalledWith(pending.outcomes, pending.incoming);
    expect(mockClearPendingImport).toHaveBeenCalledTimes(1);
    expect(mockShow).toHaveBeenCalledWith('Imported 2 prompts');
    expect(mockSafeBack).toHaveBeenCalledTimes(1);
  });

  it('Cancel clears the session and goes back without importing', () => {
    const tree = renderScreen();

    pressByText(tree, 'Cancel');

    expect(mockClearPendingImport).toHaveBeenCalledTimes(1);
    expect(mockSafeBack).toHaveBeenCalledTimes(1);
    expect(mockApplyImport).not.toHaveBeenCalled();
  });

  it('toasts an error and stays on screen when applyImport fails', async () => {
    mockApplyImport.mockRejectedValue(new Error('boom'));
    const tree = renderScreen();

    await confirmImport(tree);

    expect(mockShow).toHaveBeenCalledWith('Import failed');
    expect(mockClearPendingImport).not.toHaveBeenCalled();
    expect(mockSafeBack).not.toHaveBeenCalled();
  });

  it('renders the MissingState fallback when there is no pending session', () => {
    mockGetPendingImport.mockReturnValue(null);

    const tree = renderScreen();

    expect(textsIn(tree)).toContain('No import in progress.');
    expect(mockApplyImport).not.toHaveBeenCalled();
  });
});
