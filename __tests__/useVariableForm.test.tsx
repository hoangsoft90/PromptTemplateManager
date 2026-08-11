// __tests__/useVariableForm.test.tsx — locks the Fill & Copy form state
// (spec C4): variables derived from content, setValue clears errors,
// validate() marks empty required fields and blocks, preview renders values,
// and switching prompt content resets the form.
//
// NOTE: the harness re-renders on every state change and reassigns the
// module-level `result`, so tests always read `result` AFTER each `act` (a
// captured reference would be stale).

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { useVariableForm } from '../hooks/useVariableForm';

type HookResult = ReturnType<typeof useVariableForm>;

let result!: HookResult;
let tree!: renderer.ReactTestRenderer;

function Harness({ content }: { content: string }) {
  result = useVariableForm(content);
  return null;
}

function renderForm(content: string): void {
  act(() => {
    tree = renderer.create(<Harness content={content} />);
  });
}

describe('useVariableForm', () => {
  it('derives variables in order of appearance with case-insensitive dedup', () => {
    renderForm('Hi {{Name}}, nice to meet {{name}} about {{topic}}');

    expect(result.variables.map((v) => v.name)).toEqual(['name', 'topic']);
    expect(result.variables[0].label).toBe('Name'); // first-seen casing
  });

  it('setValue fills the value and clears that field error', () => {
    renderForm('{{tone}} email');

    let valid!: boolean;
    act(() => {
      valid = result.validate();
    });
    expect(valid).toBe(false);
    expect(result.errors.tone).toBe(true);

    act(() => result.setValue('tone', 'Formal'));

    expect(result.values.tone).toBe('Formal');
    expect(result.errors.tone).toBe(false);
  });

  it('validate marks every empty required field and reports the first one', () => {
    renderForm('{{recipient}} then {{topic}}');

    let valid!: boolean;
    act(() => {
      valid = result.validate();
    });

    expect(valid).toBe(false);
    expect(result.errors).toEqual({ recipient: true, topic: true });
    expect(result.firstInvalidName).toBe('recipient');
  });

  it('validate passes when all variables are filled', () => {
    renderForm('{{recipient}} then {{topic}}');
    act(() => {
      result.setValue('recipient', 'Boss');
      result.setValue('topic', 'Q3 report');
    });

    let valid!: boolean;
    act(() => {
      valid = result.validate();
    });

    expect(valid).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.firstInvalidName).toBeNull();
  });

  it('renders the preview with substituted values', () => {
    renderForm('Hello {{name}}!');
    act(() => result.setValue('name', 'Anna'));

    expect(result.rendered).toBe('Hello Anna!');
  });

  it('resets values and errors when the content (prompt) changes', () => {
    renderForm('{{name}}');
    act(() => result.setValue('name', 'Anna'));
    expect(result.values.name).toBe('Anna');

    act(() => {
      tree.update(<Harness content="totally different {{topic}}" />);
    });

    expect(result.values).toEqual({});
    expect(result.errors).toEqual({});
    expect(result.variables.map((v) => v.name)).toEqual(['topic']);
  });
});
