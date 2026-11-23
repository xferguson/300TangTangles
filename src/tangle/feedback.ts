/**
 * Tangle row feedback: count-aware, Wordle-style scoring of one guessed row against a poem line.
 * Pure domain logic, no React or DOM.
 */
import type { Poem } from '../core/poem';

/** Strongest first: correct spot, in this line, in another line, not in the poem. */
export type TileState = 'correct' | 'in-line' | 'other-line' | 'absent';

export interface TileFeedback {
  char: string;
  state: TileState;
}

/**
 * Score a guessed row (one char per tile) against `line` of `poem`.
 *
 * Wordle rules: exact matches claim their copy first; a remaining guess char is `in-line` only
 * while an unclaimed copy exists in the line. Otherwise it is `other-line` if it occurs in any
 * other line of the poem, else `absent`.
 */
export function scoreRow(poem: Poem, line: number, guess: readonly string[]): TileFeedback[] {
  const target = poem.lines[line];
  if (!target) throw new Error(`no line ${line} in poem`);
  const answer = target.chars.map((c) => c.trad);
  if (guess.length !== answer.length) {
    throw new Error(`guess has ${guess.length} chars, line ${line} has ${answer.length}`);
  }

  const elsewhere = new Set<string>();
  poem.lines.forEach((l, i) => {
    if (i !== line) for (const c of l.chars) elsewhere.add(c.trad);
  });

  const result: TileFeedback[] = guess.map((char) => ({ char, state: 'absent' }));
  const spare = new Map<string, number>();
  answer.forEach((a, i) => {
    if (guess[i] === a) result[i]!.state = 'correct';
    else spare.set(a, (spare.get(a) ?? 0) + 1);
  });
  guess.forEach((char, i) => {
    const tile = result[i]!;
    if (tile.state === 'correct') return;
    const left = spare.get(char) ?? 0;
    if (left > 0) {
      spare.set(char, left - 1);
      tile.state = 'in-line';
    } else if (elsewhere.has(char)) {
      tile.state = 'other-line';
    }
  });
  return result;
}
