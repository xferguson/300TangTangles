/** Tangle board helpers: bank tile colors, per-line attempt budget, share grid. Pure domain logic. */
import type { TileFeedback, TileState } from './feedback';

export type { TileFeedback, TileState } from './feedback';

/** Guesses allowed per line before it goes back to practice. */
export const MAX_ATTEMPTS = 6;

const STRENGTH: Record<TileState, number> = {
  absent: 0,
  'other-line': 1,
  'in-line': 2,
  correct: 3,
};

/** Bank tile colors, like Wordle's keyboard: each char shows the strongest state revealed so far. */
export function aggregateBank(
  guesses: readonly (readonly TileFeedback[])[],
): Map<string, TileState> {
  const bank = new Map<string, TileState>();
  for (const row of guesses) {
    for (const { char, state } of row) {
      const prev = bank.get(char);
      if (prev === undefined || STRENGTH[state] > STRENGTH[prev]) bank.set(char, state);
    }
  }
  return bank;
}

export interface LineOutcome {
  /** `review`: the budget ran out unsolved, so the line returns to practice. */
  status: 'in-progress' | 'solved' | 'review';
  attemptsLeft: number;
}

/** Where a line stands after the guesses made so far (oldest first). */
export function lineOutcome(
  guesses: readonly (readonly TileFeedback[])[],
  maxAttempts: number = MAX_ATTEMPTS,
): LineOutcome {
  const attemptsLeft = Math.max(0, maxAttempts - guesses.length);
  const solved = guesses.some((row) => row.every((t) => t.state === 'correct'));
  if (solved) return { status: 'solved', attemptsLeft };
  return { status: attemptsLeft === 0 ? 'review' : 'in-progress', attemptsLeft };
}

const EMOJI: Record<TileState, string> = {
  correct: '🟩',
  'in-line': '🟨',
  'other-line': '🟪',
  absent: '⬛',
};

/** Shareable emoji grid, one row per guess. */
export function shareGrid(guesses: readonly (readonly TileFeedback[])[]): string {
  return guesses.map((row) => row.map((t) => EMOJI[t.state]).join('')).join('\n');
}
