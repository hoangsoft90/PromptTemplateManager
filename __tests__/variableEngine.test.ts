import { extractVariables, findUnclosedVariable, renderPrompt } from '../lib/variableEngine';

describe('extractVariables', () => {
  it('deduplicates case-insensitively and keeps first-seen casing as label', () => {
    const vars = extractVariables('Hi {{Name}}, nice to meet you {{name}}');
    expect(vars).toHaveLength(1);
    expect(vars[0].name).toBe('name');
    expect(vars[0].label).toBe('Name');
  });

  it('preserves order of appearance', () => {
    const vars = extractVariables('{{recipient}} ... {{topic}} ... {{tone}}');
    expect(vars.map((v) => v.name)).toEqual(['recipient', 'topic', 'tone']);
  });

  it('does not match JSON braces or quoted names', () => {
    const vars = extractVariables('{"key": "value"} and {{"name": "John"}}');
    expect(vars).toHaveLength(0);
  });

  it('detects textarea variables via hint words', () => {
    const vars = extractVariables('{{content}} and {{tone}}');
    expect(vars[0].inputType).toBe('textarea');
    expect(vars[1].inputType).toBe('text');
  });

  it('ignores escaped variables', () => {
    const vars = extractVariables('Use syntax like \\{{variable}} in your template');
    expect(vars).toHaveLength(0);
  });

  it('returns empty array for empty content', () => {
    expect(extractVariables('')).toEqual([]);
  });

  it('assigns placeholders for known keys', () => {
    const vars = extractVariables('{{tone}} {{language}}');
    expect(vars[0].placeholder).toContain('Formal');
    expect(vars[1].placeholder).toContain('TypeScript');
  });
});

describe('renderPrompt', () => {
  it('replaces every occurrence with the same value', () => {
    const out = renderPrompt('{{tone}} email... end with a {{tone}} closing', { tone: 'Formal' });
    expect(out).toBe('Formal email... end with a Formal closing');
  });

  it('matches case-insensitively against values keyed by lowercase', () => {
    const out = renderPrompt('Hi {{Name}}', { name: 'Alice' });
    expect(out).toBe('Hi Alice');
  });

  it('un-escapes escaped variables to literal braces', () => {
    const out = renderPrompt('Use \\{{variable}} literally', { variable: 'x' });
    expect(out).toBe('Use {{variable}} literally');
  });

  it('restores adjacent escaped variables independently', () => {
    const out = renderPrompt('\\{{a}} and \\{{b}} are literals, {{c}} is a var', { c: 'C' });
    expect(out).toBe('{{a}} and {{b}} are literals, C is a var');
  });

  it('leaves unfilled variables visible', () => {
    const out = renderPrompt('Hello {{name}}!', {});
    expect(out).toBe('Hello {{name}}!');
  });
});

describe('findUnclosedVariable', () => {
  it('detects an unclosed variable', () => {
    expect(findUnclosedVariable('Write a {{name')).toBe('name');
  });

  it('returns null for fully closed variables', () => {
    expect(findUnclosedVariable('Hi {{name}} and {{tone}}')).toBeNull();
  });

  it('detects unclosed before next opening brace', () => {
    expect(findUnclosedVariable('{{tone}} then {{broken then {{other}}')).toBe('broken');
  });

  it('ignores escaped unclosed-looking sequences', () => {
    expect(findUnclosedVariable('Use \\{{name}}')).toBeNull();
  });
});
