// __tests__/SectionHeader.test.tsx — locks the section title header:
//   - renders the title and the count badge when a count is given
//   - omits the badge when no count is passed

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { SectionHeader } from '../components/SectionHeader';
import { textsIn } from '../jest/testUtils';

function renderHeader(title: string, count?: number): renderer.ReactTestRenderer {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<SectionHeader title={title} count={count} />);
  });
  return tree;
}

describe('SectionHeader', () => {
  it('renders the title and the count badge', () => {
    const tree = renderHeader('⭐ Favorites', 3);

    expect(textsIn(tree)).toContain('⭐ Favorites');
    expect(textsIn(tree)).toContain('3');
  });

  it('renders only the title when no count is given', () => {
    const tree = renderHeader('All prompts');
    const texts = textsIn(tree);

    expect(texts).toContain('All prompts');
    expect(texts).not.toContain('3'); // no count badge at all
  });
});
