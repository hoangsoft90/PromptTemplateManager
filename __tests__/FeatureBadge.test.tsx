// __tests__/FeatureBadge.test.tsx — locks FeatureBadge rendering:
//   - standalone pill with the label
//   - wrapping children + floating corner badge
//   - dot-only mode

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { FeatureBadge } from '../components/FeatureBadge';
import { Text } from 'react-native';
import { labelsIn, textsIn } from '../jest/testUtils';

function renderBadge(props: React.ComponentProps<typeof FeatureBadge>, child?: React.ReactNode) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<FeatureBadge {...props}>{child}</FeatureBadge>);
  });
  return tree;
}

describe('FeatureBadge', () => {
  it('renders a standalone pill with the default label', () => {
    const tree = renderBadge({});
    expect(textsIn(tree)).toContain('New');
  });

  it('renders a custom label', () => {
    const tree = renderBadge({ label: 'Beta' });
    expect(textsIn(tree)).toContain('Beta');
  });

  it('wraps children and renders the badge alongside them', () => {
    const tree = renderBadge({ label: 'New' }, <Text accessibilityLabel="icon">★</Text>);

    expect(labelsIn(tree)).toContain('icon');
    expect(textsIn(tree)).toContain('New');
  });

  it('renders a dot-only badge when dot mode is on (no label text)', () => {
    const tree = renderBadge({ dot: true });
    expect(textsIn(tree)).not.toContain('New');
  });
});
