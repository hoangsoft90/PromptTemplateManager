// jest/testUtils.ts — shared renderer helpers for component tests.
//
// react-test-renderer exposes BOTH composite and host instances, so a single
// logical element (e.g. a Pressable or Text) appears multiple times in the
// tree. These helpers normalize that: `labelsIn`/`textsIn` walk the whole
// tree (strings inside <Text> with mixed JSX children are joined), and
// `press` targets the composite instance that actually owns onPress.

import renderer, { act } from 'react-test-renderer';

/** Every accessibilityLabel string present in the tree (may repeat per node). */
export function labelsIn(tree: renderer.ReactTestRenderer): string[] {
  return tree.root
    .findAll((node) => typeof node.props.accessibilityLabel === 'string')
    .map((node) => node.props.accessibilityLabel);
}

/** String content of one node: string, number, or joined string/number children. */
function textOf(node: renderer.ReactTestInstance): string {
  if (!node.props) return '';
  const c = node.props.children;
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (Array.isArray(c)) {
    return c
      .filter((x) => typeof x === 'string' || typeof x === 'number')
      .map(String)
      .join('');
  }
  return '';
}

/**
 * Every string rendered inside <Text> nodes. JSX like `#{tag}` or
 * `text {'{{'} {name}}` produces an *array* of children, so join each node's
 * string/number children instead of matching single strings only.
 */
export function textsIn(tree: renderer.ReactTestRenderer): string[] {
  const texts: string[] = [];
  const walk = (node: renderer.ReactTestInstance | string): void => {
    // Raw strings and host text leaves (no props) — skip them.
    if (typeof node === 'string' || !node.props) return;
    const t = textOf(node);
    if (t) texts.push(t);
    node.children.forEach(walk);
  };
  tree.root.children.forEach(walk);
  return texts;
}

/**
 * Presses the first composite instance with the given label that owns an
 * onPress handler (host duplicates don't expose onPress, so this is safe
 * even when a label appears on multiple nodes).
 */
export function press(tree: renderer.ReactTestRenderer, accessibilityLabel: string): void {
  const node = tree.root.findAll(
    (n) =>
      n.props.accessibilityLabel === accessibilityLabel &&
      typeof n.props.onPress === 'function'
  )[0];
  // Block body: never return the handler's result. If the handler returns a
  // promise (e.g. a mocked toggleFavorite), a returned thenable turns act()
  // into an un-awaited async act and corrupts the next test's renderer.
  act(() => {
    node.props.onPress();
  });
}

/**
 * Presses the pressable that owns a leaf text equal to `text` (e.g. a button
 * without an accessibilityLabel, like "Cancel"). Walks up from the text node
 * to the nearest ancestor with an onPress handler.
 */
export function pressByText(tree: renderer.ReactTestRenderer, text: string): void {
  const leaf = tree.root.findAll((n) => !!n.props && textOf(n) === text)[0];
  if (!leaf) throw new Error(`No element with text "${text}"`);
  let node: renderer.ReactTestInstance | null = leaf;
  while (node && typeof node.props.onPress !== 'function') {
    node = node.parent;
  }
  if (!node) throw new Error(`No pressable ancestor for text "${text}"`);
  // Block body: see press() — never return the handler's result to act().
  act(() => {
    node.props.onPress();
  });
}
