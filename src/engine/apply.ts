/**
 * `applyResult`: fold an exercise result into the engine state (pure reducer).
 * Updates lexicon (unit levels, demotion of missed units, poem review card), per-line mastery,
 * recognition, rank seals and history. Never mutates its input.
 */
import {
  emptyLineMastery,
  type EngineState,
  type ExerciseResult,
  type Lexicon,
  type LineMastery,
  type ScaffoldStep,
  type UnitId,
} from '../core/types';
import type { Poem } from '../core/poem';
import { reviewUnit, type ReviewRating } from '../lexicon/lexicon';
import { parseExerciseId } from './ids';
import { computeRank, lineUnits, refreshRecognition, sealsFor } from './mastery';
import { ratingFor, recordReview } from './review';

/** Accuracy needed on the blank scroll to earn 狀元. */
export const FINAL_ACCURACY = 0.9;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Meaning moves in sixths (±1/3 per answer), so three net-correct checks, one per prompt type, give exactly 1. */
const stepMeaning = (meaning: number, correct: boolean) =>
  clamp01(Math.round((meaning + (correct ? 1 : -1) / 3) * 6) / 6);

/** Passed cleanly: correct on the first try. A retry counts as a mistake (it costs a scaffold step). */
const clean = (r: ExerciseResult) => r.correct && r.attempts <= 1;

function finalRatingFor(r: ExerciseResult, passed: boolean): ReviewRating {
  if (!passed) return 'again';
  const a = r.accuracy ?? 1;
  return a >= 0.98 ? 'easy' : a >= 0.95 ? 'good' : 'hard';
}

function linesWithUnits(poem: Poem, units: readonly UnitId[]): number[] {
  const set = new Set(units);
  return poem.lines.flatMap((_, i) => (lineUnits(poem, i).some((u) => set.has(u.id)) ? [i] : []));
}

function applyToMastery(m: LineMastery, r: ExerciseResult, passed: boolean): LineMastery {
  switch (r.kind) {
    case 'cloze':
    case 'line-builder': {
      const step = m.scaffoldStep;
      if (clean(r)) {
        return {
          ...m,
          production: Math.max(m.production, step / 5),
          scaffoldStep: Math.min(5, step + 1) as ScaffoldStep,
        };
      }
      const down = Math.max(1, step - 1) as ScaffoldStep;
      return { ...m, scaffoldStep: down, production: Math.min(m.production, (down - 1) / 5) };
    }
    case 'meaning-check':
      return { ...m, meaning: stepMeaning(m.meaning, clean(r)) };
    case 'recite':
      return passed
        ? { ...m, recitation: 1 }
        : { ...m, recitation: Math.min(0.9, Math.min(m.recitation, clamp01(r.accuracy ?? 0))) };
    case 'tangle-row':
      return r.correct
        ? { ...m, tangleCleared: true }
        : {
            ...m,
            tangleCleared: false,
            scaffoldStep: 3,
            production: Math.min(m.production, 0.4),
          };
    case 'flashcard':
      return m;
  }
}

export function applyResult(state: EngineState, result: ExerciseResult): EngineState {
  const { poem } = state;
  const now = new Date(state.now);
  const parsed = parseExerciseId(result.exerciseId);
  const line = result.line ?? parsed.line;
  const isPoemRecite = result.kind === 'recite' && line === null;
  const passed =
    result.kind === 'recite'
      ? isPoemRecite
        ? result.correct && (result.accuracy ?? 1) >= FINAL_ACCURACY
        : result.correct
      : result.correct;

  // ── lexicon: flashcards raise/lower the unit, missed units are demoted, recitations reinforce
  let lexicon: Lexicon = state.lexicon;
  const missed = new Set(result.unitsMissed);
  if (result.kind === 'flashcard' && parsed.unit && !missed.has(parsed.unit)) {
    lexicon = reviewUnit(lexicon, parsed.unit, ratingFor(result), now);
  }
  for (const u of missed) lexicon = reviewUnit(lexicon, u, 'again', now);
  if (result.kind === 'recite' && passed) {
    const reinforced =
      line === null ? poem.units.map((u) => u.id) : lineUnits(poem, line).map((u) => u.id);
    for (const u of reinforced) if (!missed.has(u)) lexicon = reviewUnit(lexicon, u, 'good', now);
  }
  if (isPoemRecite && (passed || state.progress.seals.includes('zhuangyuan'))) {
    lexicon = recordReview(lexicon, poem.id, finalRatingFor(result, passed), now);
  }

  // ── per-line mastery
  const base = poem.lines.map((_, i) => state.progress.lines[i] ?? emptyLineMastery());
  let lines = base;
  if (line !== null && line >= 0 && line < base.length) {
    lines = base.map((m, i) => (i === line ? applyToMastery(m, result, passed) : m));
  } else if (isPoemRecite && !passed) {
    // A failed blank-scroll recitation sends the lines holding missed units back to line recitation.
    const back = new Set(linesWithUnits(poem, result.unitsMissed));
    lines = base.map((m, i) =>
      back.has(i) ? { ...m, recitation: Math.min(m.recitation, 0.5) } : m,
    );
  }

  // ── recognition, rank, seals
  let seals = state.progress.seals;
  if (isPoemRecite && passed && !seals.includes('zhuangyuan')) {
    seals = [...seals, 'zhuangyuan'];
  }
  let progress = refreshRecognition(poem, lexicon, {
    ...state.progress,
    lines,
    seals,
    updatedAt: state.now,
  });
  // 狀元 needs every line mastered and cleared, so a seal alone never lifts the rank above the lines.
  progress = {
    ...progress,
    seals: sealsFor(computeRank(poem, lexicon, progress), progress.seals),
  };

  return { ...state, lexicon, progress, history: [...state.history, result] };
}
