/**
 * Small pure FSRS-style scheduler for the engine's own long-term review (poem level, after 狀元).
 * Follows the FSRS-4.5 memory model (stability / difficulty / retrievability) with its published
 * default weights. Pure: no clock, no RNG, no dependencies. Cards use the `FsrsCard` contract so they
 * serialize in the lexicon.
 */
import type { FsrsCard } from '../core/types';
import type { ReviewRating } from '../lexicon/lexicon';

const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072,
  0.0793, 0.3246, 1.587, 0.2272, 2.8755,
] as const;
const DECAY = -0.5;
const FACTOR = 19 / 81;
const REQUEST_RETENTION = 0.9;
const MS_PER_DAY = 86_400_000;

const GRADE: Record<ReviewRating, 1 | 2 | 3 | 4> = { again: 1, hard: 2, good: 3, easy: 4 };

const clampD = (d: number) => Math.min(10, Math.max(1, d));
const w = (i: number) => W[i] as number;

const initialStability = (g: number) => Math.max(0.1, w(g - 1));
const initialDifficulty = (g: number) => clampD(w(4) - Math.exp(w(5) * (g - 1)) + 1);

/** A card that has never been reviewed; due immediately. */
export function newCard(now: Date): FsrsCard {
  return {
    due: now.toISOString(),
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    lastReview: null,
  };
}

export function isDue(card: FsrsCard, now: Date): boolean {
  return new Date(card.due).getTime() <= now.getTime();
}

/** Probability of recalling the card at `now`: 1 just after a review, decaying with time; 0 for a new card. */
export function retrievability(card: FsrsCard, now: Date): number {
  if (!card.lastReview || card.stability <= 0) return 0;
  const elapsed = Math.max(0, (now.getTime() - new Date(card.lastReview).getTime()) / MS_PER_DAY);
  return Math.pow(1 + (FACTOR * elapsed) / card.stability, DECAY);
}

const intervalDays = (stability: number) =>
  Math.max(1, Math.round((stability / FACTOR) * (Math.pow(REQUEST_RETENTION, 1 / DECAY) - 1)));

/** Apply a review. Returns a new card; the input is never mutated. */
export function scheduleCard(card: FsrsCard, rating: ReviewRating, now: Date): FsrsCard {
  const g = GRADE[rating];
  let stability: number;
  let difficulty: number;
  let state: FsrsCard['state'];
  let lapses = card.lapses;

  if (card.state === 0 || !card.lastReview) {
    stability = initialStability(g);
    difficulty = initialDifficulty(g);
    state = g === 1 ? 1 : 2;
  } else {
    const r = retrievability(card, now);
    const d = card.difficulty;
    const s = card.stability;
    const nextD = clampD(w(7) * initialDifficulty(3) + (1 - w(7)) * (d - w(6) * (g - 3)));
    difficulty = nextD;
    if (g === 1) {
      stability = Math.min(
        s,
        w(11) * Math.pow(d, -w(12)) * (Math.pow(s + 1, w(13)) - 1) * Math.exp((1 - r) * w(14)),
      );
      stability = Math.max(0.1, stability);
      lapses += 1;
      state = 3;
    } else {
      const hard = g === 2 ? w(15) : 1;
      const easy = g === 4 ? w(16) : 1;
      stability =
        s *
        (1 +
          Math.exp(w(8)) *
            (11 - d) *
            Math.pow(s, -w(9)) *
            (Math.exp((1 - r) * w(10)) - 1) *
            hard *
            easy);
      state = 2;
    }
  }

  const days = g === 1 ? 1 : intervalDays(stability);
  return {
    due: new Date(now.getTime() + days * MS_PER_DAY).toISOString(),
    stability,
    difficulty,
    reps: card.reps + 1,
    lapses,
    state,
    lastReview: now.toISOString(),
  };
}
