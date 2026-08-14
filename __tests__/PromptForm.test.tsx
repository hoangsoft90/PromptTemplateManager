// __tests__/PromptForm.test.tsx — locks the editor form rules (spec C5):
// Save disabled until title + content are filled, tags parsed on submit,
// non-blocking unclosed-variable warning, edit pre-fill, and Paste & Create.

import * as Clipboard from 'expo-clipboard';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { PromptForm } from '../components/PromptForm';
import { listCategories, listTags } from '../db/promptRepository';
import type { Prompt } from '../types/prompt';
import { press, textsIn } from '../jest/testUtils';

jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn(),
}));

// The form reads existing categories/tags for suggestion chips on mount —
// mock them so the effect resolves fast and never touches a real DB.
jest.mock('../db/promptRepository', () => ({
  listCategories: jest.fn(),
  listTags: jest.fn(),
}));

const mockGetStringAsync = Clipboard.getStringAsync as jest.Mock;
const mockListCategories = listCategories as jest.Mock;
const mockListTags = listTags as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no existing values, so the suggestion effect resolves to []
  // (the component reads these before chips can render).
  mockListCategories.mockResolvedValue([]);
  mockListTags.mockResolvedValue([]);
});

/** Flush the suggestion-loading effect (mocked promises resolve immediately). */
async function flushSuggestions(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

function makePrompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: 'p1',
    title: 'Existing',
    content: 'Content {{var}}',
    category: 'Dev',
    tags: ['a'],
    isFavorite: false,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

interface FormHarness {
  tree: renderer.ReactTestRenderer;
  onSubmit: jest.Mock;
  onCancel: jest.Mock;
}

function renderForm(props: Partial<Parameters<typeof PromptForm>[0]> = {}): FormHarness {
  const callbacks = { onSubmit: jest.fn(), onCancel: jest.fn() };
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <PromptForm submitLabel="Save" {...callbacks} {...props} />
    );
  });
  return { tree, ...callbacks };
}

function field(tree: renderer.ReactTestRenderer, label: string) {
  return tree.root.findByProps({ accessibilityLabel: label });
}

function submitButton(tree: renderer.ReactTestRenderer) {
  return tree.root.findByProps({ accessibilityLabel: 'Save' });
}

describe('PromptForm validation', () => {
  it('keeps Save disabled until both title and content are filled', () => {
    const { tree, onSubmit } = renderForm();

    expect(submitButton(tree).props.disabled).toBe(true);

    act(() => field(tree, 'Prompt title').props.onChangeText('My title'));
    expect(submitButton(tree).props.disabled).toBe(true); // content still empty

    act(() => field(tree, 'Prompt content').props.onChangeText('My {{var}} content'));
    expect(submitButton(tree).props.disabled).toBe(false);

    press(tree, 'Save');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not submit while disabled', () => {
    const { tree, onSubmit } = renderForm();

    press(tree, 'Save');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('parses comma-separated tags and trims values on submit', () => {
    const { tree, onSubmit } = renderForm();
    act(() => field(tree, 'Prompt title').props.onChangeText('Title'));
    act(() => field(tree, 'Prompt content').props.onChangeText('Content'));
    act(() => field(tree, 'Prompt category').props.onChangeText('  Writing  '));
    act(() => field(tree, 'Prompt tags').props.onChangeText('dev, email, , work'));

    press(tree, 'Save');

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Title',
      content: 'Content',
      category: 'Writing',
      tags: ['dev', 'email', 'work'],
    });
  });

  it('shows a non-blocking warning for an unclosed variable', () => {
    const { tree, onSubmit } = renderForm();
    act(() => field(tree, 'Prompt title').props.onChangeText('Title'));
    act(() => field(tree, 'Prompt content').props.onChangeText('Hello {{name'));

    // Composite + host Text nodes duplicate the string; assert presence.
    expect(textsIn(tree).some((t) => t.includes('unfinished variable'))).toBe(true);
    // The warning must not block saving.
    expect(submitButton(tree).props.disabled).toBe(false);
    press(tree, 'Save');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('pre-fills from an existing prompt (edit mode) and saves immediately', () => {
    const { tree, onSubmit } = renderForm({ initial: makePrompt() });

    expect(field(tree, 'Prompt title').props.value).toBe('Existing');
    expect(field(tree, 'Prompt content').props.value).toBe('Content {{var}}');
    expect(submitButton(tree).props.disabled).toBe(false);

    press(tree, 'Save');
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Existing', content: 'Content {{var}}' })
    );
  });

  it('Paste & Create fills content and derives a title from the first line', async () => {
    mockGetStringAsync.mockResolvedValue('My pasted template\nsecond line');
    const { tree, onSubmit } = renderForm({ enablePasteToCreate: true });

    await act(async () => {
      tree.root.findByProps({ accessibilityLabel: 'Paste and create' }).props.onPress();
    });

    expect(field(tree, 'Prompt content').props.value).toBe('My pasted template\nsecond line');
    expect(field(tree, 'Prompt title').props.value).toBe('My pasted template');
    expect(submitButton(tree).props.disabled).toBe(false);
  });

  it('Paste & Create ignores empty clipboard content', async () => {
    mockGetStringAsync.mockResolvedValue('   ');
    const { tree } = renderForm({ enablePasteToCreate: true });

    await act(async () => {
      tree.root.findByProps({ accessibilityLabel: 'Paste and create' }).props.onPress();
    });

    expect(field(tree, 'Prompt content').props.value).toBe('');
  });

  it('offers existing categories and tags as tap-to-select chips', async () => {
    mockListCategories.mockResolvedValue(['Dev', 'Writing']);
    mockListTags.mockResolvedValue(['email', 'sales']);
    const { tree } = renderForm();
    await flushSuggestions();

    const catChip = tree.root.findByProps({ accessibilityLabel: 'Suggested category Writing' });
    act(() => catChip.props.onPress());
    expect(field(tree, 'Prompt category').props.value).toBe('Writing');

    const tagChip = tree.root.findByProps({ accessibilityLabel: 'Suggested tag email' });
    act(() => tagChip.props.onPress());
    expect(field(tree, 'Prompt tags').props.value).toBe('email');
  });

  it('suggestion chips filter out the typed category and already-present tags', async () => {
    mockListCategories.mockResolvedValue(['Dev', 'Writing']);
    mockListTags.mockResolvedValue(['email', 'sales']);
    const { tree } = renderForm();
    await flushSuggestions();

    act(() => field(tree, 'Prompt category').props.onChangeText('Writ'));
    // "Writing" still matches the typed prefix; "Dev" no longer does.
    expect(() =>
      tree.root.findByProps({ accessibilityLabel: 'Suggested category Writing' })
    ).not.toThrow();
    expect(() =>
      tree.root.findByProps({ accessibilityLabel: 'Suggested category Dev' })
    ).toThrow();

    act(() => field(tree, 'Prompt tags').props.onChangeText('email'));
    // "email" is already in the tags input → hidden; "sales" stays.
    expect(() => tree.root.findByProps({ accessibilityLabel: 'Suggested tag email' })).toThrow();
    expect(() =>
      tree.root.findByProps({ accessibilityLabel: 'Suggested tag sales' })
    ).not.toThrow();
  });

  it('a suggestion failure never blocks the editor', async () => {
    mockListCategories.mockRejectedValue(new Error('db boom'));
    mockListTags.mockRejectedValue(new Error('db boom'));
    const { tree, onSubmit } = renderForm();
    await flushSuggestions();

    act(() => field(tree, 'Prompt title').props.onChangeText('Title'));
    act(() => field(tree, 'Prompt content').props.onChangeText('Content'));
    expect(submitButton(tree).props.disabled).toBe(false);
    press(tree, 'Save');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
