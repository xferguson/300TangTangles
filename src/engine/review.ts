/**
 * Long-term review after 狀元. The poem as a whole has one FSRS card, kept in the lexicon under a
 * reserved key (`poem:<id>`; no contract change needed) and scheduled by the engine's own scheduler.
 * When it falls due, the poem returns for a whole-poem recitation; the seal dims while it is overdue.
 */
import type { ExerciseResult, FsrsCard, Lexicon } from '../core/types';
import type { ReviewRating } from '../lexicon/lexicon';
import { isDue, newCard, scheduleCard } from './fsrs';

const PREFIX = 'poem:';

/** Lexicon key that holds a poem's review card. Not a learnable unit: UI code listing units should skip keys with this prefix. */
export const reviewKey = (poemId: string) => `${PREFIX}${poemId}`;
export const isReviewKey = (key: string) => key.startsWith(PREFIX);

export function getReviewCard(lex: Lexicon, poemId: string): FsrsCard | null {
  return lex[reviewKey(poemId)]?.fsrs ?? null;
}

/** True when the poem has been memorized (it has a card) and the card's due time has passed. */
export function isReviewDue(lex: Lexicon, poemId: string, now: string): boolean {
  const card = getReviewCard(lex, poemId);
  return card !== null && isDue(card, new Date(now));
}

/** Schedule a review of the whole poem; creates the card on the first (memorizing) recitation. */
export function recordReview(
  lex: Lexicon,
  poemId: string,
  rating: ReviewRating,
  now: Date,
): Lexicon {
  const key = reviewKey(poemId);
  const card = scheduleCard(getReviewCard(lex, poemId) ?? newCard(now), rating, now);
  return {
    ...lex,
    [key]: { unit: key, status: 'known', level: null, fsrs: card, updatedAt: now.toISOString() },
  };
}

const FAST_MS = 3000;

/** SRS grade for a result: wrong = again; retries or hints = hard; quick and clean = easy; else good. */
export function ratingFor(r: ExerciseResult): ReviewRating {
  if (!r.correct) return 'again';
  if (r.attempts > 1 || r.hintsUsed > 0) return 'hard';
  return r.durationMs <= FAST_MS ? 'easy' : 'good';
}
