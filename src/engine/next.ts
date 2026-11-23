/**
 * `nextExercise`: the one decision of the game. Given the mastery state, choose what comes next.
 *
 * Flow per line (lines overlap and are interleaved): new-char cards for units that are not ready →
 * line builder (cloze → ordered → distractors → translation only → first char) alternating with meaning
 * checks → line recitation. When every line is mastered: one Tangle row per uncleared line, then the
 * whole-poem recitation. After 狀元 the poem returns only when a long-term review is due.
 * A line unlocks when the previous line has passed the builder.
 */
import type { PoemUnit } from '../core/poem';
import {
  emptyLineMastery,
  type EngineState,
  type Exercise,
  type NextExercise,
} from '../core/types';
import {
  buildCloze,
  buildFlashcard,
  buildLineBuilder,
  buildLineRecite,
  buildMeaningCheck,
  buildPoemRecite,
  buildTangleRow,
  type BuildCtx,
} from './exercises';
import { parseExerciseId } from './ids';
import {
  PASS,
  isLineMastered,
  isUnitReady,
  lineUnits,
  refreshRecognition,
  unitScore,
} from './mastery';
import { isReviewDue } from './review';

type LineTask =
  | { kind: 'flashcard'; unit: PoemUnit }
  | { kind: 'builder' }
  | { kind: 'meaning' }
  | { kind: 'recite' };

const BUILDER_KINDS = new Set(['cloze', 'line-builder']);

export const nextExercise: NextExercise = (state) => {
  const { poem, lexicon: lex } = state;
  const progress = refreshRecognition(poem, lex, state.progress);
  const n = poem.lines.length;
  const seq = state.history.length;
  const ctx: BuildCtx = { poem, settings: state.settings, lexicon: lex, seed: state.seed, seq };
  const m = (i: number) => progress.lines[i] ?? emptyLineMastery();

  const last = state.history.at(-1);
  const lastParsed = last ? parseExerciseId(last.exerciseId) : null;

  const lastKindFor = (line: number) => {
    for (let i = state.history.length - 1; i >= 0; i--) {
      const r = state.history[i]!;
      if (parseExerciseId(r.exerciseId).line === line) return r.kind;
    }
    return null;
  };

  const taskFor = (line: number): LineTask | null => {
    const mastery = m(line);
    const notReady = lineUnits(poem, line).filter((u) => !isUnitReady(lex, u.id));
    if (notReady.length > 0) {
      const lastUnit = lastParsed?.kind === 'flashcard' ? lastParsed.unit : null;
      const sorted = notReady
        .map((u, i) => ({ u, i }))
        .sort((a, b) => unitScore(lex, a.u.id) - unitScore(lex, b.u.id) || a.i - b.i)
        .map((x) => x.u);
      const pick = sorted.find((u) => u.id !== lastUnit) ?? sorted[0]!;
      return { kind: 'flashcard', unit: pick };
    }
    const needsBuilder = mastery.production < PASS;
    const needsMeaning = mastery.meaning < PASS;
    if (needsBuilder && needsMeaning) {
      const lk = lastKindFor(line);
      return lk !== null && BUILDER_KINDS.has(lk) && mastery.production > 0
        ? { kind: 'meaning' }
        : { kind: 'builder' };
    }
    if (needsBuilder) return { kind: 'builder' };
    if (needsMeaning) return { kind: 'meaning' };
    if (mastery.recitation < PASS) return { kind: 'recite' };
    return null;
  };

  // Lines unlock in order: line i opens once line i-1 has passed the builder.
  const candidates: { line: number; task: LineTask }[] = [];
  for (let i = 0; i < n; i++) {
    if (i > 0 && m(i - 1).production < PASS) break;
    const task = taskFor(i);
    if (task) candidates.push({ line: i, task });
  }

  if (candidates.length > 0) {
    // Interleave: work on the line touched least recently (never touched first), so no line starves.
    const touched = (line: number) =>
      state.history.findLastIndex((r) => parseExerciseId(r.exerciseId).line === line);
    const chosen = candidates.reduce((best, c) =>
      touched(c.line) < touched(best.line) ? c : best,
    );
    return buildLineTask(ctx, chosen.line, chosen.task, m(chosen.line).scaffoldStep, state);
  }

  const allMastered = poem.lines.every((_, i) => isLineMastered(poem, lex, m(i), i));
  if (!allMastered) return null; // only reachable if a line is locked behind an unmastered one

  const cleared = poem.lines.flatMap((_, i) => (m(i).tangleCleared ? [i] : []));
  const nextRow = poem.lines.findIndex((_, i) => !m(i).tangleCleared);
  if (nextRow >= 0) return buildTangleRow(ctx, nextRow, cleared);

  if (!progress.seals.includes('zhuangyuan')) return buildPoemRecite(ctx);
  // 狀元 reached: the poem comes back only when its long-term review is due.
  return isReviewDue(lex, poem.id, state.now) ? buildPoemRecite(ctx) : null;
};

function buildLineTask(
  ctx: BuildCtx,
  line: number,
  task: LineTask,
  step: 1 | 2 | 3 | 4 | 5,
  state: EngineState,
): Exercise {
  switch (task.kind) {
    case 'flashcard':
      return buildFlashcard(ctx, task.unit, line);
    case 'builder':
      return step === 1 ? buildCloze(ctx, line) : buildLineBuilder(ctx, line, step);
    case 'meaning': {
      const done = state.history.filter(
        (r) => r.kind === 'meaning-check' && parseExerciseId(r.exerciseId).line === line,
      ).length;
      return buildMeaningCheck(ctx, line, done);
    }
    case 'recite':
      return buildLineRecite(ctx, line);
  }
}
