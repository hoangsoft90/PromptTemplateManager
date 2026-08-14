// __tests__/CategoryFilter.test.tsx — locks the Home tab category filter
// chips (All + every existing category): select on tap, tap-again-to-clear,
// and renders nothing when the library has no categories yet.

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { CategoryFilter } from '../components/CategoryFilter';
import { press, textsIn } from '../jest/testUtils';

function renderFilter(
  categories: string[],
  selected: string,
  onSelect: jest.Mock
): renderer.ReactTestRenderer {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <CategoryFilter categories={categories} selected={selected} onSelect={onSelect} />
    );
  });
  return tree;
}

describe('CategoryFilter', () => {
  it('renders All plus every category', () => {
    const tree = renderFilter(['Dev', 'Writing'], '', jest.fn());
    expect(textsIn(tree)).toEqual(expect.arrayContaining(['All', 'Dev', 'Writing']));
  });

  it('selects a category on tap', () => {
    const onSelect = jest.fn();
    const tree = renderFilter(['Dev', 'Writing'], '', onSelect);
    press(tree, 'Filter by Dev');
    expect(onSelect).toHaveBeenCalledWith('Dev');
  });

  it('tapping the active category clears the filter', () => {
    const onSelect = jest.fn();
    const tree = renderFilter(['Dev', 'Writing'], 'Dev', onSelect);
    press(tree, 'Filter by Dev');
    expect(onSelect).toHaveBeenCalledWith('');
  });

  it('renders nothing when there are no categories', () => {
    const tree = renderFilter([], '', jest.fn());
    expect(tree.toJSON()).toBeNull();
  });
});
