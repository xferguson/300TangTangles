import { describe, expect, it } from 'vitest';

import { getReviewCard, isReviewDue, ratingFor, recordReview, reviewKey } from './review';
import { NOW, resultFor } from './testkit';
import { buildPoemRecite } from './exercises';
import { DEFAULT_SETTINGS } from '../core/types';
import { poem } from './testkit';

const t = (d: number) => new Date(new Date(NOW).getTime() + d * 86_400_000);
const ex = buildPoemRecite({ poem, settings: DEFAULT_SETTINGS, lexicon: {}, seed: 1, seq: 0 });

describe('long-term poem review', () => {
  it('has no card until the poem is first memorized', () => {
    expect(getReviewCard({}, 'p')).toBeNull();
    expect(isReviewDue({}, 'p', NOW)).toBe(false);
  });

  it('stores a card under a reserved key, due in the future after a good review', () => {
    const lex = recordReview({}, 'p', 'good', new Date(NOW));
    expect(Object.keys(lex)).toEqual([reviewKey('p')]);
    expect(getReviewCard(lex, 'p')?.reps).toBe(1);
    expect(isReviewDue(lex, 'p', NOW)).toBe(false);
    expect(isReviewDue(lex, 'p', t(400).toISOString())).toBe(true);
  });

  it('grows the interval on successive on-time reviews, and a lapse brings it back', () => {
    let lex = recordReview({}, 'p', 'good', new Date(NOW));
    const first = new Date(getReviewCard(lex, 'p')!.due);
    lex = recordReview(lex, 'p', 'good', first);
    const second = new Date(getReviewCard(lex, 'p')!.due);
    expect(second.getTime() - first.getTime()).toBeGreaterThan(first.getTime() - new Date(NOW).getTime());
    lex = recordReview(lex, 'p', 'again', second);
    expect(getReviewCard(lex, 'p')?.lapses).toBe(1);
    const lapsed = new Date(getReviewCard(lex, 'p')!.due);
    expect(lapsed.getTime() - second.getTime()).toBeLessThan(second.getTime() - first.getTime());
  });

  it('grades from correctness, attempts and time', () => {
    const base = resultFor(ex, { accuracy: null });
    expect(ratingFor({ ...base, correct: false })).toBe('again');
    expect(ratingFor({ ...base, attempts: 2 })).toBe('hard');
    expect(ratingFor({ ...base, hintsUsed: 1 })).toBe('hard');
    expect(ratingFor({ ...base, durationMs: 20_000 })).toBe('good');
    expect(ratingFor({ ...base, durationMs: 1_000 })).toBe('easy');
  });
});
