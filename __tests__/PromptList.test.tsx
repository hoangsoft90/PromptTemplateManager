// __tests__/PromptList.test.tsx — locks the shared list behavior:
//   - empty states: nothing while loading / "No matching prompts" while
//     searching / the tab's own CTA empty state when truly empty
//   - renders one PromptCard per prompt (i.e. the parent-filtered list)
//   - card wiring: favorite toggle, detail navigation, quick copy

import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { PromptList } from '../components/PromptList';
import { usePromptsContext } from '../lib/PromptsContext';
import { useToast } from '../components/Toast';
import { onCopyComplete } from '../lib/adGateStore';
import { incrementAppMeta, recordUsage } from '../db/promptRepository';
import type { Prompt } from '../types/prompt';
import { labelsIn, press, pressByText, textsIn } from '../jest/testUtils';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
}));

jest.mock('../db/promptRepository', () => ({
  incrementAppMeta: jest.fn(),
  recordUsage: jest.fn(),
}));

jest.mock('../lib/adGateStore', () => ({
  onCopyComplete: jest.fn(),
}));

jest.mock('../lib/PromptsContext', () => ({
  usePromptsContext: jest.fn(),
}));

jest.mock('../components/Toast', () => ({
  useToast: jest.fn(),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockClipboard = Clipboard.setStringAsync as jest.Mock;
const mockRouterPush = router.push as jest.Mock;
const mockRecordUsage = recordUsage as jest.Mock;
const mockIncrementAppMeta = incrementAppMeta as jest.Mock;
const mockOnCopyComplete = onCopyComplete as jest.Mock;
const mockUsePromptsContext = usePromptsContext as jest.Mock;
const mockUseToast = useToast as jest.Mock;
const mockShow = jest.fn();
const mockReload = jest.fn();
const mockToggleFavorite = jest.fn();

function makePrompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: 'p1',
    title: 'Email Writer',
    content: 'Write a {{tone}} email.',
    category: 'Writing',
    tags: [],
    isFavorite: false,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

interface ListProps {
  prompts?: Prompt[];
  loading?: boolean;
  isSearching?: boolean;
  query?: string;
}

interface RenderedList {
  tree: renderer.ReactTestRenderer;
  onPrimary: jest.Mock;
  onSecondary: jest.Mock;
}

// REQUIRED (verified empirically): FlatList's VirtualizedList keeps pending
// async work that outlives the test, so stale renderers must be unmounted
// between tests — without this, later tests fail with "Can't access .root on
// unmounted test renderer". This is independent of the press()-block-body fix.
const trees: renderer.ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    trees.forEach((t) => t.unmount());
  });
  trees.length = 0;
});

function renderList(props: ListProps = {}): RenderedList {
  const p = {
    prompts: [],
    loading: false,
    isSearching: false,
    query: '',
    icon: '📋',
    title: 'Your prompt library is empty',
    message: 'Create some prompts.',
    primaryLabel: 'Create prompt',
    secondaryLabel: 'Import',
    onPrimary: jest.fn(),
    onSecondary: jest.fn(),
    ...props,
  };
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <PromptList
        prompts={p.prompts}
        loading={p.loading}
        isSearching={p.isSearching}
        query={p.query}
        icon={p.icon}
        title={p.title}
        message={p.message}
        primaryLabel={p.primaryLabel}
        secondaryLabel={p.secondaryLabel}
        onPrimary={p.onPrimary}
        onSecondary={p.onSecondary}
      />
    );
  });
  trees.push(tree);
  return { tree, onPrimary: p.onPrimary, onSecondary: p.onSecondary };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUsePromptsContext.mockReturnValue({
    reload: mockReload,
    toggleFavorite: mockToggleFavorite,
  });
  mockUseToast.mockReturnValue({ show: mockShow });
  mockClipboard.mockResolvedValue(undefined);
  mockRecordUsage.mockResolvedValue(undefined);
  mockIncrementAppMeta.mockResolvedValue(undefined);
  mockOnCopyComplete.mockResolvedValue(undefined);
  mockReload.mockResolvedValue(undefined);
  mockToggleFavorite.mockResolvedValue(undefined);
});

describe('PromptList empty states', () => {
  it('renders nothing while loading', () => {
    const { tree } = renderList({ loading: true });

    expect(textsIn(tree)).not.toContain('No matching prompts');
    expect(textsIn(tree)).not.toContain('Your prompt library is empty');
  });

  it('shows the search no-results state with the query', () => {
    const { tree } = renderList({ isSearching: true, query: 'xyz' });

    expect(textsIn(tree)).toContain('No matching prompts');
    expect(textsIn(tree)).toContain('Nothing found for “xyz”. Try fewer or different words.');
  });

  it('shows the tab empty state with wired CTA buttons', () => {
    const { tree, onPrimary, onSecondary } = renderList();

    const texts = textsIn(tree);
    expect(texts).toContain('📋');
    expect(texts).toContain('Your prompt library is empty');
    expect(texts).toContain('Create prompt');
    expect(texts).toContain('Import');

    pressByText(tree, 'Create prompt');
    pressByText(tree, 'Import');

    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });
});

describe('PromptList rendering', () => {
  it('renders one card per prompt (the parent-filtered list)', () => {
    const { tree } = renderList({
      prompts: [makePrompt(), makePrompt({ id: 'p2', title: 'Code Reviewer', content: 'Plain' })],
    });
    const labels = labelsIn(tree);

    expect(labels).toContain('Fill and copy Email Writer');
    expect(labels).toContain('Copy Code Reviewer'); // zero-variable → single Copy
  });

  it('routes favorite toggle to toggleFavorite(id)', () => {
    const { tree } = renderList({ prompts: [makePrompt()] });

    press(tree, 'Add to favorites');

    expect(mockToggleFavorite).toHaveBeenCalledWith('p1');
  });

  it('routes card press to the detail screen', () => {
    const { tree } = renderList({ prompts: [makePrompt()] });

    press(tree, 'Email Writer');

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/prompt/[id]',
      params: { id: 'p1' },
    });
  });

  it('quick copy writes the raw content and triggers the ad-gate + reload', async () => {
    const { tree } = renderList({ prompts: [makePrompt()] });

    // quickCopy is async — call onPress inside the async act (nested act breaks).
    await act(async () => {
      tree.root
        .findAll((n) => n.props.accessibilityLabel === 'Quick copy Email Writer' && typeof n.props.onPress === 'function')[0]
        .props.onPress();
    });

    expect(mockClipboard).toHaveBeenCalledWith('Write a {{tone}} email.');
    expect(mockRecordUsage).toHaveBeenCalledWith('p1');
    expect(mockIncrementAppMeta).toHaveBeenCalledWith('nsm_quick_copy_count');
    expect(mockShow).toHaveBeenCalledWith('Template copied!');
    expect(mockOnCopyComplete).toHaveBeenCalledTimes(1);
    expect(mockReload).toHaveBeenCalled();
  });
});
