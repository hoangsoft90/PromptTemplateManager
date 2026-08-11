// lib/samplePrompts.ts — the 8 seed records from spec PART D (verbatim content).
// Seeded once on first launch via the normal createPrompt path (no special-cased logic).

import {
  createPrompt,
  getAppMeta,
  listAll,
  setAppMeta,
} from '../db/promptRepository';

export interface SamplePrompt {
  title: string;
  content: string;
  category: string;
  tags: string[];
}

const SAMPLES_LOADED_KEY = 'samples_loaded';

/** Seed the 8 samples exactly once; guarded by app_meta['samples_loaded']. */
export async function seedSamplesIfNeeded(): Promise<number> {
  const already = await getAppMeta(SAMPLES_LOADED_KEY);
  if (already === '1') return 0;
  const added = await restoreSamples();
  await setAppMeta(SAMPLES_LOADED_KEY, '1');
  return added;
}

/**
 * Insert any sample whose title is not already present (idempotent).
 * Used by first-launch seeding and the Settings "Restore Samples" action.
 */
export async function restoreSamples(): Promise<number> {
  const existing = await listAll();
  const existingTitles = new Set(existing.map((p) => p.title));
  let added = 0;
  for (const sample of SAMPLE_PROMPTS) {
    if (!existingTitles.has(sample.title)) {
      await createPrompt(sample);
      added += 1;
    }
  }
  return added;
}

export const SAMPLE_PROMPTS: SamplePrompt[] = [
  {
    title: 'Code Reviewer',
    content:
      'Review the following {{language}} code.\n\nFocus on:\n- correctness\n- performance\n- security\n\nCode:\n{{code}}\n\nReturn your answer in {{format}}.',
    category: 'Development',
    tags: ['coding'],
  },
  {
    title: 'Email Writer',
    content: 'Write a {{tone}} email to {{recipient}} about {{topic}}.',
    category: 'Writing',
    tags: ['email'],
  },
  {
    title: 'Summarizer',
    content:
      'Summarize the following content in {{length}}, using a {{style}} style:\n\n{{content}}',
    category: 'Productivity',
    tags: ['summary'],
  },
  {
    title: 'Meeting Notes → Action Items',
    content:
      'Extract clear action items from these meeting notes. For each item, include owner and deadline if mentioned.\n\nNotes:\n{{notes}}',
    category: 'Productivity',
    tags: ['meetings'],
  },
  {
    title: 'Research Assistant',
    content: 'Research {{topic}} at a {{depth}} level of detail. Present the findings as {{format}}.',
    category: 'Research',
    tags: ['research'],
  },
  {
    title: 'Prompt Refiner',
    content:
      "Improve the following prompt. Make it more precise, structured, and effective.\n\nOriginal prompt:\n{{prompt}}\n\nReturn only the improved version.",
    category: 'Meta',
    tags: ['meta'],
  },
  {
    title: 'Image Prompt Generator',
    content: 'Create a detailed image generation prompt for: {{subject}}.\nStyle: {{style}}. Mood: {{mood}}.',
    category: 'Creative',
    tags: ['image'],
  },
  {
    title: 'Translate & Adapt',
    content:
      'Translate the following text into {{target_language}}, adapting the tone to be {{tone}}.\n\nText:\n{{text}}',
    category: 'Language',
    tags: ['translate'],
  },
];
