// __tests__/PromptCard.test.tsx — locks the card action logic (spec C3):
//   - content with {{variables}} → primary [Fill & Copy] + secondary [Copy]
//   - zero variables → single [Copy] (raw, no form), no Fill & Copy button
// plus favorite toggle, card press, category/tags and snippet truncation.

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { PromptCard } from '../components/PromptCard';
import type { Prompt } from '../types/prompt';
import { labelsIn, press, textsIn } from '../jest/testUtils';

function makePrompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: 'p1',
    title: 'Email Writer',
    content: 'Write a {{tone}} email to {{recipient}}.',
    category: 'Writing',
    tags: ['email', 'work', 'extra', 'ignored'],
    isFavorite: false,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

interface CardHarness {
  tree: renderer.ReactTestRenderer;
  onPress: jest.Mock;
  onQuickCopy: jest.Mock;
  onFillCopy: jest.Mock;
  onFavoriteToggle: jest.Mock;
}

function renderCard(prompt: Prompt): CardHarness {
  const callbacks = {
    onPress: jest.fn(),
    onQuickCopy: jest.fn(),
    onFillCopy: jest.fn(),
    onFavoriteToggle: jest.fn(),
  };
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<PromptCard prompt={prompt} {...callbacks} />);
  });
  return { tree, ...callbacks };
}

describe('PromptCard action logic', () => {
  it('shows Fill & Copy + Copy when the content has variables', () => {
    const { tree } = renderCard(makePrompt());
    const labels = labelsIn(tree);

    expect(labels).toContain('Fill and copy Email Writer');
    expect(labels).toContain('Quick copy Email Writer');
  });

  it('shows a single Copy button (no Fill & Copy) for zero-variable content', () => {
    const { tree } = renderCard(makePrompt({ content: 'Just plain text.' }));
    const labels = labelsIn(tree);

    expect(labels).toContain('Copy Email Writer');
    expect(labels.filter((l) => l.startsWith('Fill and copy'))).toHaveLength(0);
    expect(labels.filter((l) => l.startsWith('Quick copy'))).toHaveLength(0);
  });

  it('routes Fill & Copy to onFillCopy and Copy to onQuickCopy', () => {
    const { tree, onFillCopy, onQuickCopy } = renderCard(makePrompt());

    press(tree, 'Fill and copy Email Writer');
    press(tree, 'Quick copy Email Writer');

    expect(onFillCopy).toHaveBeenCalledTimes(1);
    expect(onQuickCopy).toHaveBeenCalledTimes(1);
  });

  it('routes the single Copy on zero-variable cards to onQuickCopy', () => {
    const { tree, onQuickCopy, onFillCopy } = renderCard(
      makePrompt({ content: 'Plain.' })
    );

    press(tree, 'Copy Email Writer');

    expect(onQuickCopy).toHaveBeenCalledTimes(1);
    expect(onFillCopy).not.toHaveBeenCalled();
  });

  it('fires onPress on the card body and onFavoriteToggle on the star', () => {
    const { tree, onPress, onFavoriteToggle } = renderCard(makePrompt());

    press(tree, 'Email Writer'); // card accessibilityLabel = title
    press(tree, 'Add to favorites');

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onFavoriteToggle).toHaveBeenCalledTimes(1);
  });

  it('shows a filled star and "Remove from favorites" when favorited', () => {
    const { tree } = renderCard(makePrompt({ isFavorite: true }));
    const labels = labelsIn(tree);
    const texts = textsIn(tree);

    // Composite + host nodes duplicate the label, so assert presence, not count.
    expect(new Set(labels)).toContain('Remove from favorites');
    expect(new Set(labels)).not.toContain('Add to favorites');
    expect(texts).toContain('★');
    expect(texts).not.toContain('☆');
  });

  it('renders the category and at most 3 tags', () => {
    const { tree } = renderCard(makePrompt());
    const texts = textsIn(tree);

    expect(texts).toContain('Writing');
    expect(texts).toContain('#email');
    expect(texts).toContain('#work');
    expect(texts).toContain('#extra');
    expect(texts).not.toContain('#ignored'); // slice(0, 3)
  });

  it('truncates long snippets with an ellipsis', () => {
    const { tree } = renderCard(
      makePrompt({
        content:
          'This is a very long template content that absolutely exceeds the 110 character limit for the snippet preview and should be cut with an ellipsis at the end.',
      })
    );
    const snippet = tree.root.find((n) => typeof n.props.children === 'string' && n.props.children.includes('…'));
    expect(snippet).toBeTruthy();
  });
});
