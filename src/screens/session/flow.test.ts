import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, parsePoem, type ExerciseResult, type Lexicon } from '../../core';
import { computeRank, initialProgress, isReviewKey, parseExerciseId } from '../../engine';
import { markKnown } from '../../lexicon';
import jingyesi from '../../../content/poems/jingyesi.json';
import { completeExercise, dismissSeal, isFinished, startFlow, summarize } from './flow';

const poem = parsePoem(jingyesi);
const T0 = '2026-03-01T08:00:00.000Z';

function begin(lexicon: Lexicon = {}) {
  return startFlow({
    poem,
    lexicon,
    progress: initialProgress(poem, T0),
    settings: DEFAULT_SETTINGS,
    now: T0,
    seed: 7,
    history: [],
  });
}

/** What a learner who always answers correctly reports for the exercise on screen. */
function perfect(flow: ReturnType<typeof begin>): ExerciseResult {
  const ex = flow.current!;
  const { line } = parseExerciseId(ex.id);
  return {
    exerciseId: ex.id,
    poemId: ex.poemId,
    kind: ex.kind,
    line: ex.kind === 'flashcard' ? null : line,
    correct: true,
    attempts: 1,
    durationMs: 900,
    hintsUsed: 0,
    accuracy: ex.kind === 'recite' ? 1 : null,
    unitsMissed: [],
  };
}

/** Plays the flow to the end with a perfect learner, dismissing seal moments; collects them. */
function playToEnd(flow: ReturnType<typeof begin>, max = 800) {
  const seals: string[] = [];
  let steps = 0;
  while (!isFinished(flow) && steps++ < max) {
    if (flow.sealQueue.length > 0) {
      seals.push(flow.sealQueue[0]!);
      flow = dismissSeal(flow);
      continue;
    }
    flow = completeExercise(flow, perfect(flow), T0);
  }
  return { flow, seals, steps };
}

describe('session flow', () => {
  it('starts on the first exercise the engine chooses', () => {
    const flow = begin();
    expect(flow.current).not.toBeNull();
    expect(flow.sealQueue).toEqual([]);
    expect(isFinished(flow)).toBe(false);
  });

  it('applies a result to the state its exercise was issued from and appends history', () => {
    const flow = begin();
    const next = completeExercise(flow, perfect(flow), T0);
    expect(next.engine.history).toHaveLength(1);
    expect(next.engine.history[0]!.exerciseId).toBe(flow.current!.id);
    expect(next.current!.id).not.toBe(flow.current!.id);
  });

  it('ignores a result for an exercise that is not the current one', () => {
    const flow = begin();
    const stale = { ...perfect(flow), exerciseId: 'jingyesi:99:flashcard:-:月' };
    expect(completeExercise(flow, stale, T0)).toBe(flow);
  });

  it('a perfect fake learner reaches 狀元, queueing each seal exactly once, then finishes', () => {
    const { flow, seals } = playToEnd(begin());
    expect(isFinished(flow)).toBe(true);
    expect(computeRank(poem, flow.engine.lexicon, flow.engine.progress)).toBe('zhuangyuan');
    expect(seals).toEqual(['xiucai', 'juren', 'jinshi', 'tanhua', 'zhuangyuan']);
    const s = summarize(flow);
    expect(s.rankBefore).toBe('tongsheng');
    expect(s.rankAfter).toBe('zhuangyuan');
    expect(s.newSeals).toEqual(seals);
    expect(s.accuracy).toBe(1);
    expect(s.exercises).toBe(flow.engine.history.length);
  });

  it('queues no seal for a wrong answer and lets the learner continue', () => {
    let flow = begin();
    const bad = { ...perfect(flow), correct: false, attempts: 2, unitsMissed: ['月'] };
    flow = completeExercise(flow, bad, T0);
    expect(flow.sealQueue).toEqual([]);
    expect(summarize(flow).accuracy).toBe(0);
    expect(flow.current).not.toBeNull();
  });

  it('known characters are skipped: a fully known poem never starts with flashcards', () => {
    const lex = markKnown(
      {},
      poem.units.map((u) => u.id),
      new Date(T0),
    );
    expect(begin(lex).current!.kind).not.toBe('flashcard');
  });

  it('summary counts only poem units, never the poem review card', () => {
    const { flow } = playToEnd(begin());
    expect(Object.keys(flow.engine.lexicon).some(isReviewKey)).toBe(true);
    const s = summarize(flow);
    expect(s.units.known + s.units.learning + s.units.new).toBe(poem.units.length);
  });
});
