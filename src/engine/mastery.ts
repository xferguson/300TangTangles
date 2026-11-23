/**
 * Per-line mastery model, unit readiness, rank, seals and scroll fade. Pure functions of
 * (poem, lexicon, progress); no clock, no RNG, no React.
 *
 * Model per line (all 0-1, see `LineMastery`):
 * - recognition: how ready the line's units are in the lexicon (derived, refreshed after each result);
 * - production: scaffold steps passed / 5 (1 = passed even at the first-character step);
 * - meaning: +0.5 per correct meaning check, -0.5 per wrong one (1 = two net correct);
 * - recitation: 1 once the line was recited correctly.
 * A line is *mastered* only when all four are full: it can be produced and its meaning stated.
 */
import type { Poem, PoemUnit } from '../core/poem';
import {
  RANKS,
  emptyLineMastery,
  type Lexicon,
  type LineMastery,
  type PoemProgress,
  type Rank,
  type UnitId,
} from '../core/types';

/** A learning unit counts as ready (gate for the line builder) from this level up. */
export const READY_LEVEL = 2;
/** Minimum value of production / meaning / recitation for a pass. */
export const PASS = 1;

const LEVEL_SCORE = { 1: 0.25, 2: 0.5, 3: 0.75, 4: 0.9 } as const;

/** 0 new, 0.25-0.9 learning levels 1-4, 1 known or ignored. */
export function unitScore(lex: Lexicon, unit: UnitId): number {
  const e = lex[unit];
  if (!e || e.status === 'new') return 0;
  if (e.status === 'known' || e.status === 'ignored') return 1;
  return LEVEL_SCORE[e.level ?? 1];
}

export function isUnitReady(lex: Lexicon, unit: UnitId): boolean {
  const e = lex[unit];
  if (!e) return false;
  if (e.status === 'known' || e.status === 'ignored') return true;
  return e.status === 'learning' && (e.level ?? 1) >= READY_LEVEL;
}

/** Units (chars and compounds) occurring in a line, chars first, then compounds, each in reading order. */
export function lineUnits(poem: Poem, line: number): PoemUnit[] {
  const firstStart = (u: PoemUnit) =>
    Math.min(...u.occurrences.filter((o) => o.line === line).map((o) => o.start));
  return poem.units
    .filter((u) => u.occurrences.some((o) => o.line === line))
    .map((u, i) => ({ u, i, s: firstStart(u) }))
    .sort(
      (a, b) =>
        Number(a.u.kind === 'compound') - Number(b.u.kind === 'compound') || a.s - b.s || a.i - b.i,
    )
    .map((x) => x.u);
}

export function lineRecognition(poem: Poem, lex: Lexicon, line: number): number {
  const units = lineUnits(poem, line);
  if (units.length === 0) return 1;
  return units.reduce((sum, u) => sum + unitScore(lex, u.id), 0) / units.length;
}

export function isLineReady(poem: Poem, lex: Lexicon, line: number): boolean {
  return lineUnits(poem, line).every((u) => isUnitReady(lex, u.id));
}

export function isLineMastered(poem: Poem, lex: Lexicon, m: LineMastery, line: number): boolean {
  return (
    isLineReady(poem, lex, line) &&
    m.production >= PASS &&
    m.meaning >= PASS &&
    m.recitation >= PASS
  );
}

export function initialProgress(poem: Poem, now: string): PoemProgress {
  return {
    poemId: poem.id,
    lines: poem.lines.map(() => emptyLineMastery()),
    seals: [],
    startedAt: now,
    updatedAt: now,
  };
}

/** Pads `lines` to one entry per poem line and refreshes each line's `recognition` from the lexicon. */
export function refreshRecognition(poem: Poem, lex: Lexicon, progress: PoemProgress): PoemProgress {
  const lines = poem.lines.map((_, i) => ({
    ...(progress.lines[i] ?? emptyLineMastery()),
    recognition: lineRecognition(poem, lex, i),
  }));
  return { ...progress, lines };
}

/** Current rank, from live mastery (so it drops when a unit or line is forgotten). */
export function computeRank(poem: Poem, lex: Lexicon, progress: PoemProgress): Rank {
  const idx = poem.lines.map((_, i) => i);
  const m = (i: number) => progress.lines[i] ?? emptyLineMastery();
  const all = (f: (i: number) => boolean) => idx.every(f);

  if (!all((i) => isLineReady(poem, lex, i))) return 'tongsheng';
  if (!all((i) => m(i).production >= PASS)) return 'xiucai';
  if (!all((i) => isLineMastered(poem, lex, m(i), i))) return 'juren';
  if (!all((i) => m(i).tangleCleared)) return 'jinshi';
  if (!progress.seals.includes('zhuangyuan')) return 'tanhua';
  return 'zhuangyuan';
}

/** Seals held after reaching `rank`: every rank up to it (童生 has none), plus seals already held. */
export function sealsFor(rank: Rank, held: readonly Rank[]): Rank[] {
  const reached = RANKS.indexOf(rank);
  return RANKS.filter((r, i) => (i > 0 && i <= reached) || held.includes(r));
}

/** How faded a line is on the scroll, 0 (fully written) to 1 (blank paper). */
export function lineFade(m: LineMastery): number {
  return 0.4 * m.production + 0.2 * m.meaning + 0.2 * m.recitation + (m.tangleCleared ? 0.2 : 0);
}

/**
 * Fade level per character, `[line][char]`, 0-1. A character fades with its line's mastery, but only as
 * far as the learner recognises that character: an unrecognised char stays visible.
 */
export function fadeLevels(poem: Poem, lex: Lexicon, progress: PoemProgress): number[][] {
  return poem.lines.map((line, li) => {
    const base = lineFade(progress.lines[li] ?? emptyLineMastery());
    return line.chars.map((c) => {
      const recall = Math.min(1, unitScore(lex, c.trad) / (LEVEL_SCORE[READY_LEVEL] as number));
      return base * recall;
    });
  });
}
