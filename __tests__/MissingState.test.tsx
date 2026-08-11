// __tests__/MissingState.test.tsx — locks the missing-resource fallback used
// by deep-linked screens: it always shows a message and a "Go back" escape
// that routes through safeBack, so there is never a dead end.

import React from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { MissingState } from '../components/MissingState';

jest.mock('../lib/navigation', () => ({
  safeBack: jest.fn(),
}));

import { safeBack } from '../lib/navigation';

const mockSafeBack = safeBack as jest.Mock;

function renderedTexts(tree: renderer.ReactTestRenderer): string[] {
  return tree.root.findAllByType(Text).map((node) => String(node.props.children));
}

function renderState(props: { message?: string } = {}) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<MissingState {...props} />);
  });
  return tree;
}

describe('MissingState', () => {
  beforeEach(() => {
    mockSafeBack.mockClear();
  });

  it('renders the given message and the Go back action', () => {
    const tree = renderState({ message: 'No import in progress.' });

    const texts = renderedTexts(tree);
    expect(texts).toContain('No import in progress.');
    expect(texts).toContain('Go back');
  });

  it('falls back to the default message when none is provided', () => {
    const tree = renderState();

    expect(renderedTexts(tree)).toContain('This item no longer exists.');
  });

  it('navigates via safeBack when Go back is pressed', () => {
    const tree = renderState();
    // Composite matching by type is unreliable under jest-expo, so find the
    // pressable instance by its props (label + onPress handler).
    const goBackButton = tree.root.findAll(
      (node) =>
        node.props.accessibilityLabel === 'Go back' &&
        typeof node.props.onPress === 'function'
    )[0];
    expect(goBackButton).toBeTruthy();

    act(() => goBackButton!.props.onPress());

    expect(mockSafeBack).toHaveBeenCalledTimes(1);
  });
});
