import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';
import { clear } from 'idb-keyval';

import { parsePoem } from '../../core';
import { initialProgress } from '../../engine';
import jingyesi from '../../../content/poems/jingyesi.json';
import { loadProgress, saveProgress } from './progressStore';

const poem = parsePoem(jingyesi);
const T0 = '2026-03-01T08:00:00.000Z';

afterEach(async () => {
  await clear();
});

describe('progress store', () => {
  it('starts a fresh poem with initial progress', async () => {
    expect(await loadProgress(poem, T0)).toEqual(initialProgress(poem, T0));
  });

  it('round-trips saved progress', async () => {
    const p = initialProgress(poem, T0);
    const saved = { ...p, seals: ['xiucai' as const], updatedAt: '2026-03-02T00:00:00.000Z' };
    await saveProgress(saved);
    expect(await loadProgress(poem, T0)).toEqual(saved);
  });

  it('falls back to fresh progress when the stored value has the wrong shape', async () => {
    await saveProgress({ ...initialProgress(poem, T0), lines: [] });
    expect(await loadProgress(poem, T0)).toEqual(initialProgress(poem, T0));
  });
});
