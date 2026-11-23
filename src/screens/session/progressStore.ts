/**
 * Per-poem progress persistence (IndexedDB via idb-keyval), kept in its own key space so it never
 * collides with the lexicon store (`lexicon`). Invalid or mismatched data falls back to fresh progress.
 */
import { get, set } from 'idb-keyval';

import { poemProgressSchema, type Poem, type PoemProgress } from '../../core';
import { initialProgress } from '../../engine';

const key = (poemId: string) => `progress:${poemId}`;

export async function loadProgress(poem: Poem, now: string): Promise<PoemProgress> {
  try {
    const stored = await get<unknown>(key(poem.id));
    const parsed = poemProgressSchema.safeParse(stored);
    if (parsed.success && parsed.data.lines.length === poem.lines.length) return parsed.data;
  } catch {
    // Storage unavailable (private mode etc.): start fresh.
  }
  return initialProgress(poem, now);
}

export async function saveProgress(progress: PoemProgress): Promise<void> {
  await set(key(progress.poemId), progress);
}
