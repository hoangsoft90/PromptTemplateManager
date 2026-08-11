// __tests__/ImportPreviewList.test.tsx — locks the import breakdown (spec B6):
//   - counts: created (+ created_new_id) / skipped (duplicate) / invalid
//   - invalid rows hidden behind a show/hide toggle, indexed #N with reason
//   - no expand control when there are no invalid records

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { ImportPreviewList } from '../components/ImportPreviewList';
import type { ExportFilePrompt, ImportOutcome } from '../types/prompt';
import { pressByText, textsIn } from '../jest/testUtils';

const prompt: ExportFilePrompt = {
  id: 'p1',
  title: 'T',
  content: 'C',
  category: '',
  tags: [],
  isFavorite: false,
};

function renderList(outcomes: ImportOutcome[]): renderer.ReactTestRenderer {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<ImportPreviewList outcomes={outcomes} />);
  });
  return tree;
}

describe('ImportPreviewList summary counts', () => {
  it('breaks outcomes down into new / skipped (duplicate) / invalid', () => {
    const tree = renderList([
      { action: 'created', prompt },
      { action: 'created_new_id', originalId: 'a', newId: 'b' },
      { action: 'skipped_duplicate', id: 'a' },
      { action: 'invalid', index: 3, reason: 'Missing title' },
    ]);
    const texts = textsIn(tree);

    expect(texts).toContain('2 new'); // created + created_new_id
    expect(texts).toContain('1 skipped (duplicate)');
    expect(texts).toContain('1 invalid');
  });

  it('counts duplicate detection as skipped, never as new', () => {
    const tree = renderList([
      { action: 'skipped_duplicate', id: 'a' },
      { action: 'skipped_duplicate', id: 'b' },
    ]);
    const texts = textsIn(tree);

    expect(texts).toContain('0 new');
    expect(texts).toContain('2 skipped (duplicate)');
    expect(texts).toContain('0 invalid');
  });

  it('renders zero chips for an empty outcome list', () => {
    const tree = renderList([]);
    const texts = textsIn(tree);

    expect(texts).toContain('0 new');
    expect(texts).toContain('0 skipped (duplicate)');
    expect(texts).toContain('0 invalid');
  });
});

describe('ImportPreviewList invalid records', () => {
  const invalidOutcomes: ImportOutcome[] = [
    { action: 'created', prompt },
    { action: 'invalid', index: 4, reason: 'Missing title' },
    { action: 'invalid', index: 7, reason: 'Bad content' },
  ];

  it('hides invalid rows by default behind a show toggle', () => {
    const tree = renderList(invalidOutcomes);
    const texts = textsIn(tree);

    expect(texts).toContain('Show invalid records (2)');
    expect(texts).not.toContain('#5');
    expect(texts).not.toContain('Missing title');
  });

  it('expands to indexed rows with reasons, then collapses again', () => {
    const tree = renderList(invalidOutcomes);

    pressByText(tree, 'Show invalid records (2)');

    expect(textsIn(tree)).toContain('#5'); // index 4 → row #5
    expect(textsIn(tree)).toContain('#8'); // index 7 → row #8
    expect(textsIn(tree)).toContain('Missing title');
    expect(textsIn(tree)).toContain('Bad content');

    pressByText(tree, 'Hide invalid records (2)');

    expect(textsIn(tree)).not.toContain('#5');
  });

  it('shows no expand control when there are no invalid records', () => {
    const tree = renderList([{ action: 'created', prompt }]);

    expect(textsIn(tree).some((t) => t.includes('invalid records'))).toBe(false);
  });
});
