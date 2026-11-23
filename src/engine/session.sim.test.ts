/** Simulated learners driving the whole engine (nextExercise + applyResult) end to end. */
import { describe, expect, it } from 'vitest';

import type { EngineState, Exercise, ExerciseResult } from '../core/types';
import { markKnown } from '../lexicon/lexicon';
import { applyResult } from './apply';
import { parseExerciseId } from './ids';
import { computeRank, fadeLevels } from './mastery';
import { nextExercise } from './next';
import { rng } from './rng';
import { NOW, allKnown, poem, resultFor, stateOf } from './testkit';

type Learner = (ex: Exercise, state: EngineState) => Partial<ExerciseResult>;

const PERFECT: Learner = () => ({});
const WRONG = { correct: false, attempts: 2, accuracy: 0.3 } as const;

interface Run {
  state: EngineState;
  exercises: Exercise[];
  ended: boolean;
}

function simulate(start: EngineState, learner: Learner, maxSteps = 600): Run {
  let state = start;
  const exercises: Exercise[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const ex = nextExercise(state);
    if (!ex) return { state, exercises, ended: true };
    exercises.push(ex);
    state = applyResult(state, resultFor(ex, learner(ex, state)));
  }
  return { state, exercises, ended: false };
}

const rank = (s: EngineState) => computeRank(s.poem, s.lexicon, s.progress);
const kinds = (r: Run) => new Set(r.exercises.map((e) => e.kind));

describe('(a) a perfect learner reaches 狀元', () => {
  const run = simulate(stateOf(), PERFECT);

  it('ends the session at 狀元 with every seal, a blank scroll and nothing left due', () => {
    expect(run.ended).toBe(true);
    expect(rank(run.state)).toBe('zhuangyuan');
    expect(run.state.progress.seals).toEqual(['xiucai', 'juren', 'jinshi', 'tanhua', 'zhuangyuan']);
    expect(
      fadeLevels(poem, run.state.lexicon, run.state.progress)
        .flat()
        .every((f) => f > 0.9),
    ).toBe(true);
    expect(run.state.progress.lines.every((l) => l.tangleCleared)).toBe(true);
  });

  it('uses every exercise type and all five scaffold steps in one journey', () => {
    expect(kinds(run)).toEqual(
      new Set(['flashcard', 'cloze', 'line-builder', 'meaning-check', 'recite', 'tangle-row']),
    );
    const steps = new Set(
      run.exercises.flatMap((e) => (e.kind === 'line-builder' ? [e.step] : [])),
    );
    expect(steps).toEqual(new Set([2, 3, 4, 5]));
    const prompts = new Set(
      run.exercises.flatMap((e) => (e.kind === 'meaning-check' ? [e.prompt] : [])),
    );
    expect(prompts).toEqual(new Set(['line-to-translation', 'translation-to-line', 'feeling']));
  });

  it('orders the phases: new chars before building, Tangle after every line, final recital last', () => {
    const firstOf = (pred: (e: Exercise) => boolean) => run.exercises.findIndex(pred);
    const firstFlash = firstOf((e) => e.kind === 'flashcard');
    const firstCloze = firstOf((e) => e.kind === 'cloze');
    const firstTangle = firstOf((e) => e.kind === 'tangle-row');
    expect(firstFlash).toBe(0);
    expect(firstCloze).toBeGreaterThan(firstFlash);
    const lastLineWork = run.exercises.findLastIndex(
      (e) =>
        ['cloze', 'line-builder', 'meaning-check'].includes(e.kind) ||
        (e.kind === 'recite' && e.scope === 'line'),
    );
    expect(firstTangle).toBeGreaterThan(lastLineWork);
    const last = run.exercises.at(-1)!;
    expect(last.kind).toBe('recite');
    expect(last.kind === 'recite' && last.scope).toBe('poem');
  });

  it('interleaves lines instead of finishing one completely before the next', () => {
    const lineSeq = run.exercises
      .filter((e) => e.kind !== 'tangle-row')
      .map((e) => parseExerciseId(e.id).line);
    expect(lineSeq.indexOf(1)).toBeLessThan(lineSeq.lastIndexOf(0));
    // ... including line 2's new characters right after work on line 1.
    expect(lineSeq.indexOf(2)).toBeLessThan(lineSeq.lastIndexOf(1));
  });

  it('is deterministic for a seed', () => {
    const again = simulate(stateOf(), PERFECT);
    expect(again.exercises).toEqual(run.exercises);
  });

  it('comes back for review when the long-term card falls due, and goes quiet after a good one', () => {
    const later = {
      ...run.state,
      now: new Date(new Date(NOW).getTime() + 365 * 86_400_000).toISOString(),
    };
    const ex = nextExercise(later);
    expect(ex?.kind).toBe('recite');
    const done = simulate(later, PERFECT);
    expect(done.ended).toBe(true);
    expect(done.exercises).toHaveLength(1);
    expect(rank(done.state)).toBe('zhuangyuan');
  });
});

describe('(b) wrong meaning answers block mastery', () => {
  const blocked: Learner = (ex) => (ex.kind === 'meaning-check' ? WRONG : {});
  const run = simulate(stateOf(), blocked, 400);

  it('never recites a line, opens the Tangle, or passes 舉人', () => {
    expect(run.ended).toBe(false);
    expect(kinds(run).has('tangle-row')).toBe(false);
    expect(run.exercises.some((e) => e.kind === 'recite')).toBe(false);
    expect(rank(run.state)).toBe('juren');
    expect(run.state.progress.lines.every((l) => l.meaning < 1 && l.production === 1)).toBe(true);
  });

  it('recovers as soon as the learner answers correctly', () => {
    const fixed = simulate(run.state, PERFECT);
    expect(fixed.ended).toBe(true);
    expect(rank(fixed.state)).toBe('zhuangyuan');
  });

  it('one wrong answer undoes a correct one', () => {
    const alternate: Learner = (ex, s) =>
      ex.kind === 'meaning-check' &&
      s.history.filter((r) => r.kind === 'meaning-check').length % 2 === 1
        ? WRONG
        : {};
    const r = simulate(stateOf(), alternate, 400);
    expect(r.ended).toBe(false);
    expect(rank(r.state)).not.toBe('zhuangyuan');
  });
});

describe('(c) a failed Tangle row sends the line back to practice', () => {
  it('re-practises that line (builder steps), then the Tangle resumes and completes', () => {
    let failed = false;
    const learner: Learner = (ex) => {
      if (ex.kind === 'tangle-row' && ex.line === 2 && !failed) {
        failed = true;
        return { correct: false, attempts: ex.maxAttempts };
      }
      return {};
    };
    const run = simulate(stateOf(), learner);
    expect(failed).toBe(true);
    expect(run.ended).toBe(true);
    expect(rank(run.state)).toBe('zhuangyuan');

    const idx = run.exercises.findIndex((e) => e.kind === 'tangle-row' && e.line === 2);
    const after = run.exercises.slice(idx + 1);
    const practice = after[0]!;
    expect(['cloze', 'line-builder']).toContain(practice.kind);
    expect(parseExerciseId(practice.id).line).toBe(2);
    // The Tangle only resumes after the line is rebuilt, and line 2 is retried.
    const retry = after.findIndex((e) => e.kind === 'tangle-row');
    expect(after.slice(0, retry).some((e) => e.kind === 'line-builder' && e.line === 2)).toBe(true);
    expect(after.some((e) => e.kind === 'tangle-row' && e.line === 2)).toBe(true);
  });

  it('while the row keeps failing, the learner never reaches 探花 or the final recitation', () => {
    const learner: Learner = (ex) =>
      ex.kind === 'tangle-row' && ex.line === 2 ? { correct: false, attempts: 6 } : {};
    const run = simulate(stateOf(), learner, 400);
    expect(run.ended).toBe(false);
    expect(['tanhua', 'zhuangyuan']).not.toContain(rank(run.state));
    expect(run.exercises.some((e) => e.kind === 'recite' && e.scope === 'poem')).toBe(false);
    expect(
      run.exercises.filter((e) => e.kind === 'tangle-row' && e.line === 2).length,
    ).toBeGreaterThan(1);
  });
});

describe('(d) known characters are skipped', () => {
  it('a learner who knows everything sees no new-char cards', () => {
    const run = simulate(stateOf({ lexicon: allKnown() }), PERFECT);
    expect(run.ended).toBe(true);
    expect(kinds(run).has('flashcard')).toBe(false);
    expect(rank(run.state)).toBe('zhuangyuan');
  });

  it('only the unknown units are taught, and each of them is', () => {
    const known = ['床', '前', '月', '光', '明月', '疑', '是', '霜', '望'];
    const lexicon = markKnown({}, known, new Date(NOW));
    const run = simulate(stateOf({ lexicon }), PERFECT);
    const taught = new Set(run.exercises.flatMap((e) => (e.kind === 'flashcard' ? [e.unit] : [])));
    for (const k of known) expect(taught.has(k)).toBe(false);
    const unknown = poem.units.map((u) => u.id).filter((id) => !known.includes(id));
    // 明 and 舉頭… are unknown, so they are taught; the rest of the poem plays out as usual.
    expect(unknown.length).toBeGreaterThan(0);
    for (const u of unknown) expect(taught.has(u)).toBe(true);
    expect(rank(run.state)).toBe('zhuangyuan');
  });

  it('a unit marked ignored is skipped too', () => {
    const lexicon = { ...allKnown(), 光: { ...allKnown()['光']!, status: 'ignored' as const } };
    const run = simulate(stateOf({ lexicon }), PERFECT);
    expect(kinds(run).has('flashcard')).toBe(false);
  });
});

describe('an error-prone learner', () => {
  it('still gets there: mistakes demote, practice repeats, the poem is eventually memorized', () => {
    const rand = rng(42);
    const noisy: Learner = (ex) => {
      if (ex.kind === 'recite') return {};
      if (rand() < 0.25) {
        return {
          correct: false,
          attempts: 2,
          unitsMissed: ex.kind === 'flashcard' ? [ex.unit] : [],
        };
      }
      return {};
    };
    const run = simulate(stateOf(), noisy, 3000);
    expect(run.ended).toBe(true);
    expect(rank(run.state)).toBe('zhuangyuan');
    expect(run.exercises.length).toBeGreaterThan(simulate(stateOf(), PERFECT).exercises.length);
  });

  it('forgetting a unit after 狀元 costs the rank until it is relearned', () => {
    const done = simulate(stateOf(), PERFECT).state;
    const hit = applyResult(done, {
      ...resultFor(buildForgetting(done)),
      correct: false,
      attempts: 2,
      unitsMissed: ['月', '明月'],
    });
    expect(rank(hit)).not.toBe('zhuangyuan');
    expect(hit.progress.seals).toContain('zhuangyuan');
    const fixed = simulate(hit, PERFECT);
    expect(rank(fixed.state)).toBe('zhuangyuan');
  });
});

function buildForgetting(s: EngineState): Exercise {
  // A review slip: a line-recite style exercise for line 0.
  return {
    id: `${s.poem.id}:99:recite:0:`,
    poemId: s.poem.id,
    kind: 'recite',
    scope: 'line',
    line: 0,
    prompt: 'translation',
    language: 'cmn',
  };
}
