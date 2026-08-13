// __tests__/onboarding.test.tsx — integration tests for the in-app guidance
// system:
//   - OnboardingProvider: tooltips show once, tours run once + resume,
//     Skip/Done terminate the tour
//   - DisabledStateHelper: tapping a disabled control opens the "why is this
//     disabled?" help overlay; nothing when enabled
//   - Tooltip: registers its wrapped element and requests a one-time tooltip
//
// Strategy: mock db/promptRepository with an in-memory app_meta map (same
// pattern as adGate.test.ts) so the real seen/completed rules run against
// controlled state. measureInWindow on the RN jest View mock is a no-op that
// never calls back, so measureRef resolves via its 250ms safety timeout —
// tests use fake timers to advance it deterministically. Without a real rect
// the overlay falls back to a default popup position, which is exactly what
// the components should do.

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Pressable, Text, View } from 'react-native';
import { getAppMeta, setAppMeta } from '../db/promptRepository';
import {
  OnboardingProvider,
  useOnboardingTarget,
  useOnboarding,
} from '../lib/onboarding/OnboardingContext';
import { DisabledStateHelper } from '../components/DisabledStateHelper';
import { Tooltip } from '../components/Tooltip';
import { press, textsIn } from '../jest/testUtils';

jest.mock('../db/promptRepository', () => ({
  getAppMeta: jest.fn(),
  setAppMeta: jest.fn(),
}));

const mockGetAppMeta = getAppMeta as jest.Mock;
const mockSetAppMeta = setAppMeta as jest.Mock;

// In-memory stand-in for the app_meta table.
const meta = new Map<string, string>();

beforeEach(() => {
  meta.clear();
  mockGetAppMeta.mockImplementation((key: string) => Promise.resolve(meta.get(key) ?? null));
  mockSetAppMeta.mockImplementation((key: string, value: string) => {
    meta.set(key, value);
    return Promise.resolve();
  });
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

/**
 * Drains the async chain: storage lookups (microtasks) → measureRef schedules
 * its 250ms safety timer → advance it → setView runs → React flushes.
 * Microtask hops are interleaved with timer advancement so this works no
 * matter how many storage lookups a tour/tooltip performs before measuring.
 */
async function flushGuided() {
  await act(async () => {
    for (let i = 0; i < 20; i++) {
      await Promise.resolve();
      jest.advanceTimersByTime(50);
    }
  });
}

/** Renders children inside the provider with a stable result. */
function renderGuided(children: React.ReactNode) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<OnboardingProvider>{children}</OnboardingProvider>);
  });
  return tree;
}

/** A registered target whose ref behaves like a real RN host element. */
function Target({ id, label }: { id: string; label: string }) {
  const ref = useOnboardingTarget(id);
  return (
    <View ref={ref} collapsable={false} accessibilityLabel={label}>
      <Text>{label}</Text>
    </View>
  );
}

describe('tooltip seen-once rule', () => {
  it('shows a tooltip pointing at a target, then never again', async () => {
    function Demo() {
      const { showTooltip } = useOnboarding();
      return (
        <>
          <Target id="btn" label="target" />
          <Pressable
            accessibilityLabel="trigger"
            onPress={() => void showTooltip({ id: 'tip1', message: 'Hello guidance', targetId: 'btn' })}
          >
            <Text>go</Text>
          </Pressable>
        </>
      );
    }
    const tree = renderGuided(<Demo />);

    // First trigger → overlay appears with the message + Got it.
    await flushGuided();
    act(() => {
      press(tree, 'trigger');
    });
    await flushGuided();
    expect(textsIn(tree).some((t) => t.includes('Hello guidance'))).toBe(true);

    // Dismiss.
    await act(async () => {
      press(tree, 'Got it');
    });
    expect(textsIn(tree).some((t) => t.includes('Hello guidance'))).toBe(false);

    // Second trigger → seen-once rule blocks re-show.
    act(() => {
      press(tree, 'trigger');
    });
    await flushGuided();
    expect(textsIn(tree).some((t) => t.includes('Hello guidance'))).toBe(false);
  });
});

describe('sequential tour (Next / Skip / Done)', () => {
  it('walks step 1 → step 2 → Done and marks the tour completed', async () => {
    function Demo() {
      const { startTour } = useOnboarding();
      const steps = [
        { id: 's1', targetId: 'a', title: 'Step A', message: 'First thing' },
        { id: 's2', targetId: 'b', title: 'Step B', message: 'Second thing' },
      ];
      return (
        <>
          <Target id="a" label="target-a" />
          <Target id="b" label="target-b" />
          <Pressable accessibilityLabel="start" onPress={() => void startTour('t1', steps)}>
            <Text>start</Text>
          </Pressable>
        </>
      );
    }
    const tree = renderGuided(<Demo />);

    act(() => {
      press(tree, 'start');
    });
    await flushGuided();
    expect(textsIn(tree).some((t) => t.includes('First thing'))).toBe(true);

    act(() => {
      press(tree, 'Next step');
    });
    await flushGuided();
    expect(textsIn(tree).some((t) => t.includes('Second thing'))).toBe(true);

    act(() => {
      press(tree, 'Finish tour');
    });
    await flushGuided();
    expect(textsIn(tree).some((t) => t.includes('Second thing'))).toBe(false);

    // Re-trigger → tour already completed, stays hidden.
    act(() => {
      press(tree, 'start');
    });
    await flushGuided();
    expect(textsIn(tree).some((t) => t.includes('First thing'))).toBe(false);
    expect(meta.get('onboarding:tour:t1:completed')).toBe('1');
  });

  it('Skip marks the tour completed and hides the overlay', async () => {
    function Demo() {
      const { startTour } = useOnboarding();
      const steps = [{ id: 's1', targetId: 'a', title: 'Step A', message: 'First thing' }];
      return (
        <>
          <Target id="a" label="target-a" />
          <Pressable accessibilityLabel="start" onPress={() => void startTour('t2', steps)}>
            <Text>start</Text>
          </Pressable>
        </>
      );
    }
    const tree = renderGuided(<Demo />);

    act(() => {
      press(tree, 'start');
    });
    await flushGuided();
    expect(textsIn(tree).some((t) => t.includes('First thing'))).toBe(true);

    act(() => {
      press(tree, 'Skip tour');
    });
    await flushGuided();
    expect(textsIn(tree).some((t) => t.includes('First thing'))).toBe(false);
    expect(meta.get('onboarding:tour:t2:completed')).toBe('1');
  });

  it('resumes at the first unfinished step', async () => {
    // Simulate a previous run where step 1 was completed (saved in meta).
    meta.set('onboarding:tour:t3:step:s1:done', '1');

    function Demo() {
      const { startTour } = useOnboarding();
      const steps = [
        { id: 's1', targetId: 'a', title: 'Step A', message: 'First thing' },
        { id: 's2', targetId: 'b', title: 'Step B', message: 'Second thing' },
      ];
      return (
        <>
          <Target id="a" label="target-a" />
          <Target id="b" label="target-b" />
          <Pressable accessibilityLabel="start" onPress={() => void startTour('t3', steps)}>
            <Text>start</Text>
          </Pressable>
        </>
      );
    }
    const tree = renderGuided(<Demo />);

    act(() => {
      press(tree, 'start');
    });
    await flushGuided();
    // Resumes at step B, not step A.
    expect(textsIn(tree).some((t) => t.includes('Second thing'))).toBe(true);
    expect(textsIn(tree).some((t) => t.includes('First thing'))).toBe(false);
  });
});

describe('DisabledStateHelper', () => {
  it('opens a help overlay when a disabled control is tapped', async () => {
    function Demo() {
      return (
        <DisabledStateHelper
          enabled={false}
          targetId="save"
          reason="Save needs a title and content."
          unlockHint="Fill in the required fields to enable Save."
        >
          <Pressable accessibilityLabel="Save" disabled>
            <Text>Save</Text>
          </Pressable>
        </DisabledStateHelper>
      );
    }
    const tree = renderGuided(<Demo />);

    act(() => {
      press(tree, 'Why is this disabled?');
    });
    await flushGuided();

    expect(textsIn(tree).some((t) => t.includes('Save needs a title and content.'))).toBe(true);
    expect(textsIn(tree).some((t) => t.includes('Fill in the required fields'))).toBe(true);

    // Dismiss closes the help overlay.
    await act(async () => {
      press(tree, 'Got it');
    });
    expect(textsIn(tree).some((t) => t.includes('Save needs a title and content.'))).toBe(false);
  });

  it('renders no overlay when the control is enabled', async () => {
    function Demo() {
      return (
        <DisabledStateHelper
          enabled
          targetId="save"
          reason="Save needs a title and content."
          unlockHint="Fill in the required fields to enable Save."
        >
          <Pressable accessibilityLabel="Save">
            <Text>Save</Text>
          </Pressable>
        </DisabledStateHelper>
      );
    }
    const tree = renderGuided(<Demo />);

    expect(textsIn(tree).some((t) => t.includes('Why is this disabled?'))).toBe(false);
  });
});

describe('Tooltip component', () => {
  it('registers the wrapped element and requests a one-time tooltip', async () => {
    function Demo() {
      return (
        <Tooltip id="welcome" title="Welcome" message="This button is new!">
          <Pressable accessibilityLabel="new-button">
            <Text>btn</Text>
          </Pressable>
        </Tooltip>
      );
    }
    const tree = renderGuided(<Demo />);

    // Tooltip fires on mount (async storage + measure chain).
    await flushGuided();

    expect(textsIn(tree).some((t) => t.includes('This button is new!'))).toBe(true);
    expect(textsIn(tree).some((t) => t.includes('Welcome'))).toBe(true);
  });
});
