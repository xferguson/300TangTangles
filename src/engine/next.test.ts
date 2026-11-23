import { describe, expect, it } from 'vitest';

import { lineText } from '../core/poem';
import {
  emptyLineMastery,
  type Exercise,
  type ExerciseResult,
  type LineMastery,
} from '../core/types';
import { setStatus } from '../lexicon/lexicon';
import { MAX_ATTEMPTS } from '../tangle/board';
import { parseExerciseId } from './ids';
import { nextExercise } from './next';
import { NOW, allKnown, mastered, poem, progressOf, stateOf } from './testkit';

const lines = (f: (i: number) => Partial<LineMastery>) =>
  progressOf(poem.lines.map((_, i) => ({ ...emptyLineMastery(), ...f(i) })));
const next = (over: Parameters<typeof stateOf>[0]) => nextExercise(stateOf(over))!;
const lineChars = (i: number) => poem.lines[i]!.chars.map((c) => c.trad);

function fakeResult(ex: Exercise, over: Partial<ExerciseResult> = {}): ExerciseResult {
  const { line } = parseExerciseId(ex.id);
  return {
    exerciseId: ex.id,
    poemId: ex.poemId,
    kind: ex.kind,
    line: ex.kind === 'flashcard' ? null : line,
    correct: true,
    attempts: 1,
    durationMs: 1000,
    hintsUsed: 0,
    accuracy: null,
    unitsMissed: [],
    ...over,
  };
}

describe('exercise ids', () => {
  it('round-trips kind, line and unit', () => {
    const ex = next({});
    const p = parseExerciseId(ex.id);
    expect(p.kind).toBe(ex.kind);
    expect(p.line).toBe(0);
    expect(p.unit).toBe('床');
  });
});

describe('new-char cards', () => {
  it('starts with a flashcard for the first unit of line 0, with the right answer in choices', () => {
    const ex = next({});
    expect(ex.kind).toBe('flashcard');
    if (ex.kind !== 'flashcard') return;
    expect(ex.unit).toBe('床');
    expect(ex.direction).toBe('char-to-meaning');
    expect(ex.choices[ex.answerIndex]).toBe('bed');
    expect(new Set(ex.choices).size).toBe(ex.choices.length);
    expect(ex.choices.length).toBeGreaterThanOrEqual(3);
  });

  it('picks the least-known unit first', () => {
    const lex = setStatus({}, '床', { status: 'learning', level: 1 }, new Date(NOW));
    const ex = next({ lexicon: lex });
    if (ex.kind !== 'flashcard') throw new Error('expected flashcard');
    expect(ex.unit).toBe('前');
    const lex2 = setStatus(lex, '前', { status: 'learning', level: 2 }, new Date(NOW));
    const ex2 = next({ lexicon: lex2 });
    if (ex2.kind !== 'flashcard') throw new Error('expected flashcard');
    expect(ex2.unit).toBe('明');
  });

  it('asks audio-to-char for a level-1 unit and answers with a char', () => {
    let lex = allKnown();
    lex = setStatus(lex, '床', { status: 'learning', level: 1 }, new Date(NOW));
    const ex = next({ lexicon: lex });
    if (ex.kind !== 'flashcard') throw new Error('expected flashcard');
    expect(ex.direction).toBe('audio-to-char');
    expect(ex.choices[ex.answerIndex]).toBe('床');
  });

  it('skips known and ignored units entirely', () => {
    const ex = next({ lexicon: allKnown() });
    expect(ex.kind).not.toBe('flashcard');
  });

  it('does not ask about units the learner already knows, only the rest of the line', () => {
    let lex = allKnown();
    lex = setStatus(lex, '光', { status: 'new' }, new Date(NOW));
    const ex = next({ lexicon: lex });
    if (ex.kind !== 'flashcard') throw new Error('expected flashcard');
    expect(ex.unit).toBe('光');
  });
});

describe('line builder scaffolding', () => {
  const at = (step: 1 | 2 | 3 | 4 | 5, production = (step - 1) / 5) =>
    next({
      lexicon: allKnown(),
      progress: lines((i) => (i === 0 ? { scaffoldStep: step, production } : {})),
    });

  it('step 1 is a cloze with 1-2 blanks whose answers belong to the line', () => {
    const ex = at(1);
    if (ex.kind !== 'cloze') throw new Error('expected cloze');
    expect(ex.line).toBe(0);
    expect(ex.blanks.length).toBeGreaterThanOrEqual(1);
    expect(ex.blanks.length).toBeLessThanOrEqual(2);
    for (const b of ex.blanks) {
      expect(lineChars(0)[b.index]).toBe(b.answer);
      expect(b.choices).toContain(b.answer);
      expect(b.choices).toHaveLength(4);
      expect(new Set(b.choices).size).toBe(4);
    }
  });

  it('step 2 is the ordered bank: exactly the line chars, with audio and translation', () => {
    const ex = at(2);
    if (ex.kind !== 'line-builder') throw new Error('expected line-builder');
    expect(ex.step).toBe(2);
    expect([...ex.bank].sort()).toEqual([...lineChars(0)].sort());
    expect(ex.answer).toEqual(lineChars(0));
    expect(ex.showAudio && ex.showTranslation).toBe(true);
    expect(ex.firstChar).toBeNull();
  });

  it('step 3 adds distractors that are not valid in the line', () => {
    const ex = at(3);
    if (ex.kind !== 'line-builder') throw new Error('expected line-builder');
    expect(ex.bank.length).toBeGreaterThan(5);
    const extras = [...ex.bank];
    for (const c of lineChars(0)) extras.splice(extras.indexOf(c), 1);
    expect(extras.length).toBeGreaterThan(0);
    for (const x of extras) expect(lineChars(0)).not.toContain(x);
  });

  it('step 4 is translation only, step 5 shows the first character', () => {
    const s4 = at(4);
    if (s4.kind !== 'line-builder') throw new Error('expected line-builder');
    expect(s4.showAudio).toBe(false);
    expect(s4.showTranslation).toBe(true);
    expect(s4.firstChar).toBeNull();
    const s5 = at(5);
    if (s5.kind !== 'line-builder') throw new Error('expected line-builder');
    expect(s5.step).toBe(5);
    expect(s5.showAudio).toBe(false);
    expect(s5.firstChar).toBe('床');
  });
});

describe('line unlocking and interleaving', () => {
  it('keeps line 1 locked until line 0 is produced', () => {
    const ex = next({ lexicon: allKnown() });
    expect(parseExerciseId(ex.id).line).toBe(0);
  });

  it('interleaves: after working on line 0 it moves to another line that has work', () => {
    const progress = lines((i) => (i === 0 ? { production: 1, scaffoldStep: 5 } : {}));
    const first = next({ lexicon: allKnown(), progress });
    expect(first.kind).toBe('meaning-check'); // line 0 still needs meaning
    expect(parseExerciseId(first.id).line).toBe(0);
    const second = next({
      lexicon: allKnown(),
      progress,
      history: [fakeResult(first)],
    });
    expect(parseExerciseId(second.id).line).toBe(1);
    expect(second.kind).toBe('cloze');
    const third = next({
      lexicon: allKnown(),
      progress,
      history: [fakeResult(first), fakeResult(second)],
    });
    expect(parseExerciseId(third.id).line).toBe(0);
  });

  it('alternates a line between builder and meaning check', () => {
    const progress = lines((i) => (i === 0 ? { production: 0.2, scaffoldStep: 2 } : {}));
    const b = next({ lexicon: allKnown(), progress });
    expect(b.kind).toBe('line-builder');
    const m = next({ lexicon: allKnown(), progress, history: [fakeResult(b)] });
    expect(m.kind).toBe('meaning-check');
  });
});

describe('meaning checks', () => {
  // Only line 0 still has work, so the meaning prompts can be followed one after another.
  const progress = progressOf(
    poem.lines.map((_, i) => (i === 0 ? mastered({ meaning: 0, recitation: 0 }) : mastered())),
  );

  it('cycles line-to-translation, translation-to-line, feeling with the right answer', () => {
    const kinds: string[] = [];
    let history: ExerciseResult[] = [];
    for (let k = 0; k < 3; k++) {
      const ex = next({ lexicon: allKnown(), progress, history });
      if (ex.kind !== 'meaning-check') throw new Error('expected meaning-check');
      kinds.push(ex.prompt);
      expect(ex.line).toBe(0);
      const answer = ex.choices[ex.answerIndex];
      const l = poem.lines[0]!;
      if (ex.prompt === 'line-to-translation') {
        expect(ex.stem).toBe(lineText(l, 'trad'));
        expect(answer).toBe(l.gloss);
      } else if (ex.prompt === 'translation-to-line') {
        expect(ex.stem).toBe(l.gloss);
        expect(answer).toBe(lineText(l, 'trad'));
      } else {
        expect(answer).toBe(l.meaning.feeling);
        expect(ex.choices.filter((c) => l.meaning.wrongFeelings.includes(c))).toHaveLength(
          ex.choices.length - 1,
        );
      }
      expect(new Set(ex.choices).size).toBe(ex.choices.length);
      history = [...history, fakeResult(ex, { correct: false })];
    }
    expect(kinds).toEqual(['line-to-translation', 'translation-to-line', 'feeling']);
  });
});

describe('line recitation', () => {
  it('recites a line once it is produced and its meaning is known', () => {
    const progress = lines((i) => (i === 0 ? { production: 1, meaning: 1, scaffoldStep: 5 } : {}));
    const ex = next({ lexicon: allKnown(), progress, history: [] });
    expect(ex.kind).toBe('recite');
    if (ex.kind !== 'recite') return;
    expect(ex.scope).toBe('line');
    expect(ex.line).toBe(0);
    expect(ex.prompt).toBe('translation');
    expect(ex.language).toBe('cmn');
  });

  it('uses the previous line as the prompt for later lines', () => {
    const progress = lines((i) =>
      i < 2 ? { production: 1, meaning: 1, recitation: i === 0 ? 1 : 0, scaffoldStep: 5 } : {},
    );
    const ex = next({ lexicon: allKnown(), progress });
    if (ex.kind !== 'recite') throw new Error('expected recite');
    expect(ex.line).toBe(1);
    expect(ex.prompt).toBe('previous-line');
  });
});

describe('Tangle and final recitation', () => {
  const done = (cleared: (i: number) => boolean) =>
    progressOf(poem.lines.map((_, i) => mastered({ tangleCleared: cleared(i) })));

  it('opens the Tangle once every line is mastered, one row at a time', () => {
    const ex = next({ lexicon: allKnown(), progress: done(() => false) });
    if (ex.kind !== 'tangle-row') throw new Error('expected tangle-row');
    expect(ex.line).toBe(0);
    expect(ex.maxAttempts).toBe(MAX_ATTEMPTS);
    expect(ex.answer).toEqual(lineChars(0));
    expect(ex.solvedLines).toEqual([]);
    const all = poem.lines.flatMap((_, i) => lineChars(i));
    for (const c of all) {
      expect(ex.bank.filter((x) => x === c).length).toBeGreaterThanOrEqual(
        all.filter((x) => x === c).length,
      );
    }
    expect(ex.bank.length).toBeGreaterThanOrEqual(all.length);
  });

  it('continues with the next uncleared line and lists solved lines', () => {
    const ex = next({ lexicon: allKnown(), progress: done((i) => i < 2) });
    if (ex.kind !== 'tangle-row') throw new Error('expected tangle-row');
    expect(ex.line).toBe(2);
    expect(ex.solvedLines).toEqual([0, 1]);
  });

  it('does not open the Tangle while a line still needs practice', () => {
    const progress = progressOf(
      poem.lines.map((_, i) => mastered({ tangleCleared: i < 2, meaning: i === 3 ? 0 : 1 })),
    );
    const ex = next({ lexicon: allKnown(), progress });
    expect(ex.kind).toBe('meaning-check');
    expect(parseExerciseId(ex.id).line).toBe(3);
  });

  it('asks for the whole poem from a blank scroll once the Tangle is cleared', () => {
    const ex = next({ lexicon: allKnown(), progress: done(() => true) });
    if (ex.kind !== 'recite') throw new Error('expected recite');
    expect(ex.scope).toBe('poem');
    expect(ex.line).toBeNull();
    expect(ex.prompt).toBe('blank');
  });

  it('returns null when the poem is mastered and no review is due', () => {
    const progress = { ...done(() => true), seals: ['zhuangyuan' as const] };
    expect(nextExercise(stateOf({ lexicon: allKnown(), progress }))).toBeNull();
  });
});

describe('determinism', () => {
  it('is a pure function of the state, and the seed changes the shuffle', () => {
    const progress = lines((i) => (i === 0 ? { scaffoldStep: 3, production: 0.4 } : {}));
    const a = next({ lexicon: allKnown(), progress, seed: 5 });
    expect(next({ lexicon: allKnown(), progress, seed: 5 })).toEqual(a);
    const banks = new Set(
      [1, 2, 3, 4, 5, 6].map((seed) =>
        JSON.stringify((next({ lexicon: allKnown(), progress, seed }) as { bank: string[] }).bank),
      ),
    );
    expect(banks.size).toBeGreaterThan(1);
  });
});
