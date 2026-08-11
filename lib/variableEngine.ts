// lib/variableEngine.ts — the {{variable}} template engine (spec PART B4).
//
// Rules (all mandatory):
// 1. Case-insensitive dedup: {{Tone}}, {{tone}}, {{TONE}} → one variable, label = first-seen casing.
// 2. Order of appearance in the form == order of first appearance in content.
// 3. Same variable reused → same value substituted in both places.
// 4. Required validation: empty value blocks copy (handled by the fill screen).
// 5. variables[] is never persisted — always derived from content at render time.
// 6. \{{name}} escape → literal {{name}} in preview and final copied text.

export interface Variable {
  name: string; // canonical lowercase key
  label: string; // display casing from first occurrence
  inputType: 'text' | 'textarea';
  placeholder?: string;
}

const VAR_REGEX = /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g;
// Matches escaped variables: \{{name}}
const ESCAPED_REGEX = /\\\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g;
// Placeholder tokens must never match VAR_REGEX (start with a letter) — we use \u0000.
// Tokens are exactly "\u0000ESC<index>\u0000" (single nulls) so adjacent escaped
// variables restore independently without greedy "+" merging them.
const ESC_PLACEHOLDER = '\u0000ESC';
const ESC_TOKEN = /\u0000ESC(\d+)\u0000/g;

const TEXTAREA_HINTS = [
  'code',
  'content',
  'body',
  'text',
  'description',
  'context',
  'prompt',
  'message',
  'notes',
  'input',
];

const PLACEHOLDER_MAP: Record<string, string> = {
  language: 'TypeScript, Python, Go…',
  format: 'Bullet points, JSON, Markdown…',
  tone: 'Formal, Casual, Friendly…',
  length: 'Short, Medium, Long…',
  style: 'Professional, Creative…',
};

/**
 * Masks `\{{name}}` occurrences with placeholder tokens and returns the
 * original literal `{{name}}` strings so they can be restored on render.
 */
function maskEscaped(content: string): { masked: string; literals: string[] } {
  const literals: string[] = [];
  let index = 0;
  const masked = content.replace(ESCAPED_REGEX, (_match, name: string) => {
    literals.push(`{{${name}}}`);
    return `${ESC_PLACEHOLDER}${index++}\u0000`;
  });
  return { masked, literals };
}

function restoreEscaped(text: string, literals: string[]): string {
  return text.replace(ESC_TOKEN, (_m, idx: string) => literals[Number(idx)] ?? '');
}

export function extractVariables(content: string): Variable[] {
  if (!content) return [];
  const { masked } = maskEscaped(content);
  const seen = new Map<string, Variable>();
  const regex = new RegExp(VAR_REGEX.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(masked)) !== null) {
    const raw = match[1];
    const key = raw.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, {
        name: key,
        label: raw,
        inputType: TEXTAREA_HINTS.some((h) => key.includes(h)) ? 'textarea' : 'text',
        placeholder: PLACEHOLDER_MAP[key],
      });
    }
  }
  return Array.from(seen.values());
}

export function renderPrompt(content: string, values: Record<string, string>): string {
  if (!content) return '';
  const { masked, literals } = maskEscaped(content);
  const rendered = masked.replace(VAR_REGEX, (match, raw: string) => {
    const value = values[raw.toLowerCase()];
    // Unfilled variables stay visible as {{name}} so the preview shows what's missing.
    return value !== undefined && value !== '' ? value : match;
  });
  return restoreEscaped(rendered, literals);
}

/**
 * Soft-warning check for the editor: detects `{{name` with no closing `}}`
 * before the next `{{` or EOF. Returns the partial name or null.
 */
export function findUnclosedVariable(content: string): string | null {
  if (!content) return null;
  const { masked } = maskEscaped(content);
  const opening = /\{\{([a-zA-Z][a-zA-Z0-9_]*)/g;
  let match: RegExpExecArray | null;
  while ((match = opening.exec(masked)) !== null) {
    const name = match[1];
    const rest = masked.slice(match.index + match[0].length);
    const nextOpen = rest.indexOf('{{');
    const segment = nextOpen === -1 ? rest : rest.slice(0, nextOpen);
    if (!segment.includes('}}')) return name;
  }
  return null;
}

