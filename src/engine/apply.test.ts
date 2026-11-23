import { describe, expect, it } from 'vitest';

import { emptyLineMastery, type EngineState, type Exercise, type LineMastery } from '../core/types';
import { setStatus } from '../lexicon/lexicon';
import { applyResult } from './apply';
import { nextExercise } from './next';
import { getReviewCard, isReviewDue } from './review';
import { NOW, allKnown, mastered, poem, progressOf, resultFor, stateOf } from './testkit';
import { buildCloze, buildLineBuilder, buildLineRecite, buildMeaningCheck, buildPoemRecite, buildTangleRow } from './exercises';

const ctx = (lexicon = {}) => ({ poem, settings: stateOf().settings, lexicon, seed: 1, seq: 0 });
const lines = (f: (i: number) => Partial<LineMastery>) =>
  progressOf(poem.lines.map((_, i) => ({ ...emptyLineMastery(), ...f(i) })));
const state0 = (over: Partial<EngineState> = {}) =>
  stateOf({ lexicon: allKnown(), ...over });
const m0 = (s: EngineState) => s.progress.lines[0]!;

describe('flashcards update the lexicon', () => {
  it('a correct card moves a new unit to learning and later cards raise its level', () => {
    let s = stateOf();
    const ex1 = nextExercise(s)!;
    s = applyResult(s, resultFor(ex1));
    expect(s.lexicon['床']?.status).toBe('learning');
    expect(s.lexicon['床']?.level).toBe(1);
    const ex2 = nextExercise({ ...s })!; // another unit now
    expect(ex2.kind).toBe('flashcard');
    const before = s.lexicon['床']!.level!;
    // find 床 again after cycling the line's other units
    s = { ...s, lexicon: setStatus(s.lexicon, '床', { status: 'learning', level: before }, new Date(NOW)) };
    const again = applyResult(s, resultFor({ ...ex1, id: ex1.id } as Exercise, { durationMs: 9000 }));
    expect(again.lexicon['床']!.level!).toBeGreaterThan(before - 1);
    expect(again.history).toHaveLength(1);
  });

  it('a wrong card demotes the unit', () => {
    const lex = setStatus({}, '床', { status: 'learning', level: 3 }, new Date(NOW));
    const s = stateOf({ lexicon: lex });
    const ex = nextExercise(s)!;
    expect(ex.kind).toBe('flashcard');
    const out = applyResult(s, resultFor(ex, { correct: false, attempts: 2, unitsMissed: ['床'] }));
    expect(out.lexicon['床']?.level).toBeLessThan(3);
  });

  it('unitsMissed on any exercise demote those units (known drops to learning)', () => {
    const s = state0({ progress: lines((i) => (i === 0 ? { scaffoldStep: 2, production: 0.2 } : {})) });
    const ex = buildLineBuilder(ctx(s.lexicon), 0, 2);
    const out = applyResult(s, resultFor(ex, { correct: false, attempts: 2, unitsMissed: ['月'] }));
    expect(out.lexicon['月']?.status).toBe('learning');
  });
});

describe('line builder scaffolding', () => {
  it('passing a step advances one step and records production', () => {
    const s = state0();
    const out = applyResult(s, resultFor(buildCloze(ctx(s.lexicon), 0)));
    expect(m0(out).scaffoldStep).toBe(2);
    expect(m0(out).production).toBeCloseTo(0.2);
    const s3 = state0({ progress: lines((i) => (i === 0 ? { scaffoldStep: 3, production: 0.4 } : {})) });
    const out3 = applyResult(s3, resultFor(buildLineBuilder(ctx(s3.lexicon), 0, 3)));
    expect(m0(out3).scaffoldStep).toBe(4);
    expect(m0(out3).production).toBeCloseTo(0.6);
  });

  it('passing the first-character step completes production', () => {
    const s = state0({ progress: lines((i) => (i === 0 ? { scaffoldStep: 5, production: 0.8 } : {})) });
    const out = applyResult(s, resultFor(buildLineBuilder(ctx(s.lexicon), 0, 5)));
    expect(m0(out).production).toBe(1);
    expect(m0(out).scaffoldStep).toBe(5);
  });

  it('a mistake (wrong, or right only on a retry) drops one step', () => {
    const s = state0({ progress: lines((i) => (i === 0 ? { scaffoldStep: 4, production: 0.6 } : {})) });
    const ex = buildLineBuilder(ctx(s.lexicon), 0, 4);
    for (const over of [{ correct: false, attempts: 3 }, { correct: true, attempts: 2 }]) {
      const out = applyResult(s, resultFor(ex, over));
      expect(m0(out).scaffoldStep).toBe(3);
      expect(m0(out).production).toBeCloseTo(0.4);
    }
  });

  it('never drops below step 1', () => {
    const s = state0();
    const out = applyResult(s, resultFor(buildCloze(ctx(s.lexicon), 0), { correct: false }));
    expect(m0(out).scaffoldStep).toBe(1);
    expect(m0(out).production).toBe(0);
  });
});

describe('meaning, recitation, Tangle', () => {
  it('meaning rises 0.5 per correct answer and falls 0.5 per wrong one, within 0-1', () => {
    let s = state0();
    const ex = buildMeaningCheck(ctx(s.lexicon), 0, 0);
    s = applyResult(s, resultFor(ex));
    expect(m0(s).meaning).toBe(0.5);
    s = applyResult(s, resultFor(ex));
    expect(m0(s).meaning).toBe(1);
    s = applyResult(s, resultFor(ex));
    expect(m0(s).meaning).toBe(1);
    s = applyResult(s, resultFor(ex, { correct: false }));
    expect(m0(s).meaning).toBe(0.5);
    s = applyResult(applyResult(s, resultFor(ex, { correct: false })), resultFor(ex, { correct: false }));
    expect(m0(s).meaning).toBe(0);
  });

  it('a recited line scores recitation 1; a failed one keeps it below 1', () => {
    const s = state0();
    const ex = buildLineRecite(ctx(s.lexicon), 0);
    expect(m0(applyResult(s, resultFor(ex, { accuracy: 0.95 }))).recitation).toBe(1);
    const bad = m0(applyResult(s, resultFor(ex, { correct: false, accuracy: 0.4 })));
    expect(bad.recitation).toBeLessThan(1);
  });

  it('clearing a Tangle row marks the line cleared', () => {
    const s = state0({ progress: progressOf(poem.lines.map(() => mastered())) });
    const out = applyResult(s, resultFor(buildTangleRow(ctx(s.lexicon), 1, [0])));
    expect(out.progress.lines[1]!.tangleCleared).toBe(true);
    expect(out.progress.lines[0]!.tangleCleared).toBe(false);
  });

  it('a failed Tangle row sends the line back to practice', () => {
    const progress = progressOf(poem.lines.map(() => mastered({ tangleCleared: true })));
    const s = state0({ progress });
    const out = applyResult(s, resultFor(buildTangleRow(ctx(s.lexicon), 2, []), { correct: false, attempts: 6 }));
    const l = out.progress.lines[2]!;
    expect(l.tangleCleared).toBe(false);
    expect(l.production).toBeLessThan(1);
    expect(l.scaffoldStep).toBeLessThan(5);
    expect(out.progress.lines[1]!.tangleCleared).toBe(true);
    const next = nextExercise(out)!;
    expect(next.kind === 'cloze' || next.kind === 'line-builder').toBe(true);
    expect(next.kind === 'tangle-row').toBe(false);
  });
});

describe('final recitation, ranks, seals and review', () => {
  const cleared = () => state0({ progress: progressOf(poem.lines.map(() => mastered({ tangleCleared: true }))) });

  it('≥90% on the blank scroll awards 狀元, its seal and a review card', () => {
    const s = cleared();
    const out = applyResult(s, resultFor(buildPoemRecite(ctx(s.lexicon)), { accuracy: 0.95 }));
    expect(out.progress.seals).toContain('zhuangyuan');
    expect(out.progress.seals).toEqual(['xiucai', 'juren', 'jinshi', 'tanhua', 'zhuangyuan']);
    const card = getReviewCard(out.lexicon, poem.id);
    expect(card).not.toBeNull();
    expect(isReviewDue(out.lexicon, poem.id, NOW)).toBe(false);
    expect(nextExercise(out)).toBeNull();
  });

  it('below 90% does not award it and the recitation is asked again', () => {
    const s = cleared();
    const out = applyResult(s, resultFor(buildPoemRecite(ctx(s.lexicon)), { accuracy: 0.85, correct: true }));
    expect(out.progress.seals).not.toContain('zhuangyuan');
    expect(nextExercise(out)?.kind).toBe('recite');
  });

  it('missed units on a failed recitation send their lines back to line recitation', () => {
    const s = cleared();
    const out = applyResult(
      s,
      resultFor(buildPoemRecite(ctx(s.lexicon)), { correct: false, accuracy: 0.6, unitsMissed: ['霜'] }),
    );
    expect(out.progress.lines[1]!.recitation).toBeLessThan(1);
    expect(out.progress.lines[0]!.recitation).toBe(1);
    const next = nextExercise(out)!;
    expect(next.kind).toBe('recite');
    if (next.kind === 'recite') expect(next.line).toBe(1);
  });

  it('after the card falls due the poem returns for review; a lapse costs rank but keeps the seal', () => {
    const s = cleared();
    const done = applyResult(s, resultFor(buildPoemRecite(ctx(s.lexicon)), { accuracy: 1 }));
    const later = { ...done, now: new Date(new Date(NOW).getTime() + 400 * 86_400_000).toISOString() };
    const ex = nextExercise(later)!;
    expect(ex.kind).toBe('recite');
    if (ex.kind === 'recite') expect(ex.scope).toBe('poem');
    const lapsed = applyResult(later, resultFor(ex, { correct: false, accuracy: 0.5, unitsMissed: ['故'] }));
    expect(getReviewCard(lapsed.lexicon, poem.id)?.lapses).toBe(1);
    expect(lapsed.progress.seals).toContain('zhuangyuan');
    const ok = applyResult(later, resultFor(ex, { accuracy: 1 }));
    expect(isReviewDue(ok.lexicon, poem.id, later.now)).toBe(false);
    expect(nextExercise(ok)).toBeNull();
  });

  it('seals are never removed when the rank drops', () => {
    const s = cleared();
    const done = applyResult(s, resultFor(buildPoemRecite(ctx(s.lexicon)), { accuracy: 1 }));
    const ex = buildMeaningCheck(ctx(done.lexicon), 0, 0);
    const out = applyResult(done, resultFor(ex, { correct: false }));
    expect(out.progress.seals).toEqual(done.progress.seals);
  });
});

describe('bookkeeping', () => {
  it('appends to history, stamps updatedAt, refreshes recognition and does not mutate its input', () => {
    const s = stateOf({ now: '2026-04-01T00:00:00.000Z' });
    const frozen = structuredClone(s);
    const ex = nextExercise(s)!;
    const out = applyResult(s, resultFor(ex));
    expect(s).toEqual(frozen);
    expect(out.history).toHaveLength(1);
    expect(out.progress.updatedAt).toBe('2026-04-01T00:00:00.000Z');
    expect(out.progress.lines[0]!.recognition).toBeGreaterThan(0);
    expect(out.progress.lines).toHaveLength(poem.lines.length);
  });
});
