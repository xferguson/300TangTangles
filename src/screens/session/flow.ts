/**
 * The session flow as a pure state machine over the engine (T34): which exercise is on screen,
 * which rank-up seals are waiting to be stamped, and the numbers for the session summary.
 * No React, no storage; the screen just renders this and persists `engine` after each step.
 */
import type { EngineState, Exercise, ExerciseResult, Rank } from '../../core';
import { applyResult, computeRank, isReviewKey, nextExercise, unitScore } from '../../engine';

export interface Flow {
  /** The engine state the current exercise was issued from; results are applied to it. */
  engine: EngineState;
  /** Exercise on screen, or `null` when nothing is due. */
  current: Exercise | null;
  /** Seals earned by the last result(s), waiting for their stamp moment, oldest first. */
  sealQueue: Rank[];
  /** Every seal earned during this session, in order. */
  earned: Rank[];
  rankBefore: Rank;
  /** The learner chose to stop. */
  ended: boolean;
}

export function startFlow(engine: EngineState): Flow {
  return {
    engine,
    current: nextExercise(engine),
    sealQueue: [],
    earned: [],
    rankBefore: computeRank(engine.poem, engine.lexicon, engine.progress),
    ended: false,
  };
}

/**
 * Fold in the result of the current exercise and pick the next one. A result for any other
 * exercise (a stale or duplicate completion) is ignored.
 */
export function completeExercise(flow: Flow, result: ExerciseResult, now: string): Flow {
  if (!flow.current || result.exerciseId !== flow.current.id) return flow;
  const issued: EngineState = { ...flow.engine, now };
  const engine = applyResult(issued, result);
  const held = new Set(flow.engine.progress.seals);
  const fresh = engine.progress.seals.filter((s) => !held.has(s));
  return {
    ...flow,
    engine,
    current: nextExercise(engine),
    sealQueue: [...flow.sealQueue, ...fresh],
    earned: [...flow.earned, ...fresh],
  };
}

/** The learner has seen the oldest queued seal. */
export function dismissSeal(flow: Flow): Flow {
  return flow.sealQueue.length === 0 ? flow : { ...flow, sealQueue: flow.sealQueue.slice(1) };
}

export function endFlow(flow: Flow): Flow {
  return { ...flow, ended: true, sealQueue: [] };
}

/** Nothing left to show: no exercise, no pending seal moment (or the learner stopped). */
export function isFinished(flow: Flow): boolean {
  return flow.ended || (flow.current === null && flow.sealQueue.length === 0);
}

export interface Summary {
  exercises: number;
  correct: number;
  /** Share of exercises answered correctly, 0-1 (1 for an empty session). */
  accuracy: number;
  durationMs: number;
  rankBefore: Rank;
  rankAfter: Rank;
  newSeals: Rank[];
  /** The poem's units by lexicon state (known includes ignored). The review card is not a unit. */
  units: { known: number; learning: number; new: number };
}

export function summarize(flow: Flow): Summary {
  const { poem, lexicon, progress, history } = flow.engine;
  const correct = history.filter((r) => r.correct).length;
  const units = { known: 0, learning: 0, new: 0 };
  for (const u of poem.units) {
    if (isReviewKey(u.id)) continue;
    const s = unitScore(lexicon, u.id);
    if (s >= 1) units.known++;
    else if (s > 0) units.learning++;
    else units.new++;
  }
  return {
    exercises: history.length,
    correct,
    accuracy: history.length === 0 ? 1 : correct / history.length,
    durationMs: history.reduce((sum, r) => sum + r.durationMs, 0),
    rankBefore: flow.rankBefore,
    rankAfter: computeRank(poem, lexicon, progress),
    newSeals: flow.earned,
    units,
  };
}
