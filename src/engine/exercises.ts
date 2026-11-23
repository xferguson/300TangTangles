/** Builders that turn "what to practise" into a concrete `Exercise`. Pure and seeded. */
import { lineText, type Poem, type PoemUnit } from '../core/poem';
import type {
  ClozeExercise,
  Exercise,
  FlashcardExercise,
  LineBuilderExercise,
  Lexicon,
  MeaningCheckExercise,
  MeaningPrompt,
  ReciteExercise,
  ScaffoldStep,
  Settings,
  TangleRowExercise,
  UnitId,
} from '../core/types';
import { MAX_ATTEMPTS } from '../tangle/board';
import { generateDistractors } from './distractors/distractors';
import { makeExerciseId } from './ids';
import { mixSeed, rng, shuffle } from './rng';

export interface BuildCtx {
  poem: Poem;
  settings: Settings;
  lexicon: Lexicon;
  seed: number;
  /** Position in the session; used for the exercise id and to vary shuffles. */
  seq: number;
}

const uniq = <T>(xs: readonly T[]): T[] => [...new Set(xs)];
const lineChars = (poem: Poem, line: number) => poem.lines[line]!.chars.map((c) => c.trad);

/** Puts `answer` among `wrong` at a seeded position; returns the choices and the answer's index. */
function withAnswer(answer: string, wrong: readonly string[], rand: () => number) {
  const choices = shuffle(uniq([answer, ...wrong.filter((w) => w !== answer)]), rand);
  return { choices, answerIndex: choices.indexOf(answer) };
}

export const MEANING_PROMPTS: readonly MeaningPrompt[] = [
  'line-to-translation',
  'translation-to-line',
  'feeling',
];

/** Direction by how well the unit is known: meaning first, then sound, then recall from meaning. */
function flashcardDirection(lex: Lexicon, unit: UnitId): FlashcardExercise['direction'] {
  const e = lex[unit];
  if (!e || e.status === 'new') return 'char-to-meaning';
  return (e.level ?? 1) <= 1 ? 'audio-to-char' : 'meaning-to-char';
}

export function buildFlashcard(ctx: BuildCtx, unit: PoemUnit, line: number): FlashcardExercise {
  const { poem } = ctx;
  const rand = rng(mixSeed(ctx.seed, ctx.seq, line, 1));
  const direction = flashcardDirection(ctx.lexicon, unit.id);
  const others = shuffle(
    poem.units.filter((u) => u.id !== unit.id),
    rand,
  );
  const sameKind = others.filter((u) => u.kind === unit.kind);
  const pool = [...sameKind, ...others.filter((u) => u.kind !== unit.kind)];

  let answer: string;
  let wrong: string[];
  if (direction === 'char-to-meaning') {
    answer = unit.gloss;
    wrong = uniq(pool.map((u) => u.gloss).filter((g) => g !== answer)).slice(0, 3);
  } else {
    answer = unit.id;
    wrong = sameKind.map((u) => u.id).slice(0, 3);
    if (unit.kind === 'char' && wrong.length < 3) {
      const extra = generateDistractors({
        poem,
        line,
        count: 3 - wrong.length,
        difficulty: 'easy',
        seed: mixSeed(ctx.seed, ctx.seq, 2),
      });
      wrong = uniq([...wrong, ...extra.filter((c) => c !== answer)]);
    }
  }
  return {
    id: makeExerciseId(poem.id, ctx.seq, 'flashcard', line, unit.id),
    poemId: poem.id,
    kind: 'flashcard',
    unit: unit.id,
    direction,
    ...withAnswer(answer, wrong, rand),
  };
}

export function buildCloze(ctx: BuildCtx, line: number): ClozeExercise {
  const { poem } = ctx;
  const rand = rng(mixSeed(ctx.seed, ctx.seq, line, 3));
  const chars = lineChars(poem, line);
  const want = Math.min(chars.length, 1 + (rand() < 0.5 ? 1 : 0));
  const indices = shuffle(
    chars.map((_, i) => i),
    rand,
  )
    .slice(0, want)
    .sort((a, b) => a - b);
  const blanks = indices.map((index) => {
    const answer = chars[index]!;
    let wrong = generateDistractors({
      poem,
      line,
      index,
      count: 3,
      difficulty: 'easy',
      seed: mixSeed(ctx.seed, ctx.seq, index, 4),
    });
    if (wrong.length < 3) {
      const fill = shuffle(
        uniq(poem.lines.flatMap((_, l) => lineChars(poem, l))).filter(
          (c) => c !== answer && !wrong.includes(c),
        ),
        rand,
      );
      wrong = [...wrong, ...fill].slice(0, 3);
    }
    const { choices } = withAnswer(answer, wrong, rand);
    return { index, answer, choices };
  });
  return {
    id: makeExerciseId(poem.id, ctx.seq, 'cloze', line),
    poemId: poem.id,
    kind: 'cloze',
    line,
    blanks,
  };
}

/** Scaffold steps 2-5. Distractors grow harder with the step. */
export function buildLineBuilder(
  ctx: BuildCtx,
  line: number,
  step: Exclude<ScaffoldStep, 1>,
): LineBuilderExercise {
  const { poem } = ctx;
  const rand = rng(mixSeed(ctx.seed, ctx.seq, line, 5));
  const answer = lineChars(poem, line);
  const extras =
    step === 2
      ? []
      : generateDistractors({
          poem,
          line,
          count: step === 3 ? 2 : 3,
          difficulty: step === 3 ? 'medium' : 'hard',
          seed: mixSeed(ctx.seed, ctx.seq, line, 6),
        });
  return {
    id: makeExerciseId(poem.id, ctx.seq, 'line-builder', line),
    poemId: poem.id,
    kind: 'line-builder',
    line,
    step,
    bank: shuffle([...answer, ...extras], rand),
    answer,
    showAudio: step <= 3,
    showTranslation: true,
    firstChar: step === 5 ? answer[0]! : null,
  };
}

/** `variant` picks the prompt (cycles through `MEANING_PROMPTS`). */
export function buildMeaningCheck(
  ctx: BuildCtx,
  line: number,
  variant: number,
): MeaningCheckExercise {
  const { poem, settings } = ctx;
  const rand = rng(mixSeed(ctx.seed, ctx.seq, line, 7));
  const prompt = MEANING_PROMPTS[variant % MEANING_PROMPTS.length]!;
  const target = poem.lines[line]!;
  const otherLines = shuffle(
    poem.lines.filter((_, i) => i !== line),
    rand,
  );
  const text = (l: (typeof poem.lines)[number]) => lineText(l, settings.script);

  let stem: string;
  let answer: string;
  let wrong: string[];
  if (prompt === 'line-to-translation') {
    stem = text(target);
    answer = target.gloss;
    wrong = otherLines.map((l) => l.gloss);
  } else if (prompt === 'translation-to-line') {
    stem = target.gloss;
    answer = text(target);
    wrong = otherLines.map(text);
  } else {
    stem = `${text(target)} — what is the poet feeling here?`;
    answer = target.meaning.feeling;
    wrong = shuffle(target.meaning.wrongFeelings, rand);
  }
  return {
    id: makeExerciseId(poem.id, ctx.seq, 'meaning-check', line),
    poemId: poem.id,
    kind: 'meaning-check',
    line,
    prompt,
    stem,
    ...withAnswer(answer, wrong.slice(0, 3), rand),
  };
}

export function buildTangleRow(
  ctx: BuildCtx,
  line: number,
  solvedLines: readonly number[],
): TangleRowExercise {
  const { poem } = ctx;
  const rand = rng(mixSeed(ctx.seed, ctx.seq, line, 8));
  const poemChars = poem.lines.flatMap((_, i) => lineChars(poem, i));
  const inPoem = new Set(poemChars);
  const extras = uniq(
    poem.lines.flatMap((_, i) =>
      generateDistractors({
        poem,
        line: i,
        count: 2,
        difficulty: 'medium',
        seed: mixSeed(ctx.seed, 9, i),
      }),
    ),
  )
    .filter((c) => !inPoem.has(c))
    .slice(0, 4);
  return {
    id: makeExerciseId(poem.id, ctx.seq, 'tangle-row', line),
    poemId: poem.id,
    kind: 'tangle-row',
    line,
    bank: shuffle([...poemChars, ...extras], rand),
    answer: lineChars(poem, line),
    maxAttempts: MAX_ATTEMPTS,
    solvedLines: [...solvedLines],
  };
}

export function buildLineRecite(ctx: BuildCtx, line: number): ReciteExercise {
  return {
    id: makeExerciseId(ctx.poem.id, ctx.seq, 'recite', line),
    poemId: ctx.poem.id,
    kind: 'recite',
    scope: 'line',
    line,
    prompt: line > 0 ? 'previous-line' : 'translation',
    language: ctx.settings.audioLanguage,
  };
}

export function buildPoemRecite(ctx: BuildCtx): ReciteExercise {
  return {
    id: makeExerciseId(ctx.poem.id, ctx.seq, 'recite', null),
    poemId: ctx.poem.id,
    kind: 'recite',
    scope: 'poem',
    line: null,
    prompt: 'blank',
    language: ctx.settings.audioLanguage,
  };
}

export type { Exercise };
