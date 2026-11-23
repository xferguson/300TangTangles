/**
 * Recitation grader (pure domain code: no React, no DOM).
 *
 * Aligns a speech-recognition transcript to the target characters with Levenshtein distance and
 * returns a per-character diff plus an accuracy. Characters are compared by script (Traditional or
 * Simplified) and, when a lookup is supplied, by *reading* so homophone transcriptions still pass.
 */
import type { PoemChar, ReadingSystem } from '../../core';

export type CharStatus = 'correct' | 'wrong' | 'missing';

export interface CharDiff {
  /** Index into the target. */
  index: number;
  /** The target character (Traditional). */
  expected: string;
  status: CharStatus;
  /** What was heard in this slot; set when `status` is `wrong`. */
  heard?: string;
}

export interface ExtraChar {
  /** The extra transcript character. */
  char: string;
  /** It was said just before this target index (`target.length` = after the end). */
  beforeIndex: number;
}

export interface GradeResult {
  /** One entry per target character, in order. */
  diff: CharDiff[];
  /** Transcript characters that matched nothing in the target. */
  extras: ExtraChar[];
  /** Correct target chars / target length, 0-1. Extras do not reduce it. */
  accuracy: number;
  /** Indexes of target chars that were not correct (wrong or missing). */
  missedIndexes: number[];
}

export interface GradeInput {
  target: readonly PoemChar[];
  transcript: string;
  system: ReadingSystem;
  /** Which Tâi-lô layer to compare when `system` is `tailo`. Defaults to literary. */
  hokkienLayer?: 'lit' | 'col';
  /**
   * Readings (in `system`) of an arbitrary transcript character, for homophone tolerance. Characters
   * of the target itself are always known from the poem. Return `[]` when unknown.
   */
  readingsOf?: (char: string) => readonly string[];
}

/** Drops punctuation, symbols and whitespace; what remains is what the learner said. */
export function normalizeTranscript(text: string): string[] {
  return [...text.normalize('NFC')].filter((c) => !/[\p{P}\p{S}\p{Z}\p{C}]/u.test(c));
}

type Op = 'match' | 'sub' | 'del' | 'ins';

export function gradeRecitation(input: GradeInput): GradeResult {
  const { target } = input;
  const heard = normalizeTranscript(input.transcript);
  const n = target.length;
  const m = heard.length;

  const matches = (t: PoemChar, h: string): boolean => h === t.trad || h === t.simp;

  // dp[i][j] = edit distance between target[0..i) and heard[0..j)
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i]![0] = i;
  for (let j = 0; j <= m; j++) dp[0]![j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = dp[i - 1]![j - 1]! + (matches(target[i - 1]!, heard[j - 1]!) ? 0 : 1);
      dp[i]![j] = Math.min(sub, dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1);
    }
  }

  // Trace back, preferring match/substitution over gaps.
  const ops: { op: Op; i: number; j: number }[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const isMatch = matches(target[i - 1]!, heard[j - 1]!);
      if (dp[i]![j] === dp[i - 1]![j - 1]! + (isMatch ? 0 : 1)) {
        ops.push({ op: isMatch ? 'match' : 'sub', i: i - 1, j: j - 1 });
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && dp[i]![j] === dp[i - 1]![j]! + 1) {
      ops.push({ op: 'del', i: i - 1, j });
      i--;
    } else {
      ops.push({ op: 'ins', i, j: j - 1 });
      j--;
    }
  }
  ops.reverse();

  const diff: CharDiff[] = [];
  const extras: ExtraChar[] = [];
  for (const { op, i: ti, j: hj } of ops) {
    const expected = target[ti === n ? n - 1 : ti]!.trad;
    if (op === 'match') diff.push({ index: ti, expected, status: 'correct' });
    else if (op === 'sub') diff.push({ index: ti, expected, status: 'wrong', heard: heard[hj]! });
    else if (op === 'del') diff.push({ index: ti, expected, status: 'missing' });
    else extras.push({ char: heard[hj]!, beforeIndex: ti });
  }

  const correct = diff.filter((d) => d.status === 'correct').length;
  return {
    diff,
    extras,
    accuracy: n === 0 ? 0 : correct / n,
    missedIndexes: diff.filter((d) => d.status !== 'correct').map((d) => d.index),
  };
}
