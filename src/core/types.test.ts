import { describe, expect, expectTypeOf, it } from 'vitest';

import { parsePoem } from './poem';
import { fixturePoemData } from './fixtures/poem.fixture';
import {
  DEFAULT_SETTINGS,
  RANKS,
  RANK_LABELS,
  emptyLineMastery,
  lexiconEntrySchema,
  lineMasterySchema,
  readingFor,
  readingSystemFor,
  settingsSchema,
} from './types';

import type {
  EngineState,
  Exercise,
  ExerciseResult,
  LexiconEntry,
  NextExercise,
  UnitId,
} from './types';

const readings = parsePoem(fixturePoemData).lines[0]!.chars[0]!.readings;

describe('ranks', () => {
  it('lists the imperial-exam ranks in order, lowest first', () => {
    expect(RANKS).toEqual(['tongsheng', 'xiucai', 'juren', 'jinshi', 'tanhua', 'zhuangyuan']);
  });

  it('has a Chinese label for every rank', () => {
    expect(RANKS.map((r) => RANK_LABELS[r])).toEqual([
      '童生',
      '秀才',
      '舉人',
      '進士',
      '探花',
      '狀元',
    ]);
  });
});

describe('settings', () => {
  it('defaults: Traditional, bopomofo, Mandarin, literary Hokkien', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      script: 'trad',
      mandarinRomanization: 'zhuyin',
      showReadings: true,
      audioLanguage: 'cmn',
      hokkienLayer: 'lit',
      theme: 'system',
    });
    expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
  });

  it('rejects unknown values', () => {
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, script: 'klingon' }).success).toBe(
      false,
    );
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, audioLanguage: 'fr' }).success).toBe(
      false,
    );
  });

  it('fills missing fields with defaults so older backups still load', () => {
    expect(settingsSchema.parse({})).toEqual(DEFAULT_SETTINGS);
  });
});

describe('reading selection', () => {
  it('follows the audio language', () => {
    expect(readingSystemFor({ ...DEFAULT_SETTINGS, audioLanguage: 'cmn' })).toBe('zhuyin');
    expect(
      readingSystemFor({
        ...DEFAULT_SETTINGS,
        audioLanguage: 'cmn',
        mandarinRomanization: 'pinyin',
      }),
    ).toBe('pinyin');
    expect(readingSystemFor({ ...DEFAULT_SETTINGS, audioLanguage: 'yue' })).toBe('jyutping');
    expect(readingSystemFor({ ...DEFAULT_SETTINGS, audioLanguage: 'nan' })).toBe('tailo');
  });

  it('returns the matching reading string', () => {
    expect(readingFor(readings, DEFAULT_SETTINGS)).toBe('ㄔㄨㄤˊ');
    expect(readingFor(readings, { ...DEFAULT_SETTINGS, mandarinRomanization: 'pinyin' })).toBe(
      'chuáng',
    );
    expect(readingFor(readings, { ...DEFAULT_SETTINGS, audioLanguage: 'yue' })).toBe('cung4');
  });

  it('picks the Tâi-lô layer from settings', () => {
    const nan = { ...DEFAULT_SETTINGS, audioLanguage: 'nan' as const };
    expect(readingFor(readings, { ...nan, hokkienLayer: 'lit' })).toBe('fx-lit');
    expect(readingFor(readings, { ...nan, hokkienLayer: 'col' })).toBe('fx-col');
  });

  it('returns undefined when readings are hidden', () => {
    expect(readingFor(readings, { ...DEFAULT_SETTINGS, showReadings: false })).toBeUndefined();
  });
});

describe('lexicon entry', () => {
  const base = { unit: '月', updatedAt: '2026-11-23T00:00:00.000Z' };

  it('accepts a new, known or ignored unit with no level', () => {
    for (const status of ['new', 'known', 'ignored'] as const) {
      expect(
        lexiconEntrySchema.safeParse({ ...base, status, level: null, fsrs: null }).success,
      ).toBe(true);
    }
  });

  it('accepts a learning unit with level 1-4', () => {
    for (const level of [1, 2, 3, 4]) {
      expect(
        lexiconEntrySchema.safeParse({ ...base, status: 'learning', level, fsrs: null }).success,
      ).toBe(true);
    }
  });

  it('rejects a learning unit without a level, or a level outside 1-4', () => {
    expect(
      lexiconEntrySchema.safeParse({ ...base, status: 'learning', level: null, fsrs: null })
        .success,
    ).toBe(false);
    expect(
      lexiconEntrySchema.safeParse({ ...base, status: 'learning', level: 5, fsrs: null }).success,
    ).toBe(false);
  });

  it('rejects a level on a non-learning unit', () => {
    expect(
      lexiconEntrySchema.safeParse({ ...base, status: 'known', level: 2, fsrs: null }).success,
    ).toBe(false);
  });
});

describe('line mastery', () => {
  it('starts empty: nothing learned, scaffold step 1, Tangle not cleared', () => {
    expect(emptyLineMastery()).toEqual({
      recognition: 0,
      production: 0,
      meaning: 0,
      recitation: 0,
      scaffoldStep: 1,
      tangleCleared: false,
    });
  });

  it('keeps every score within 0-1 and the scaffold step within 1-5', () => {
    expect(lineMasterySchema.safeParse(emptyLineMastery()).success).toBe(true);
    expect(lineMasterySchema.safeParse({ ...emptyLineMastery(), meaning: 1.2 }).success).toBe(
      false,
    );
    expect(lineMasterySchema.safeParse({ ...emptyLineMastery(), scaffoldStep: 6 }).success).toBe(
      false,
    );
  });
});

describe('exercise contract (compile-time)', () => {
  it('covers every exercise kind the session flow can ask for', () => {
    expectTypeOf<Exercise['kind']>().toEqualTypeOf<
      'flashcard' | 'cloze' | 'meaning-check' | 'line-builder' | 'tangle-row' | 'recite'
    >();
  });

  it('is exhaustively switchable', () => {
    const label = (e: Exercise): string => {
      switch (e.kind) {
        case 'flashcard':
        case 'cloze':
        case 'meaning-check':
        case 'line-builder':
        case 'tangle-row':
        case 'recite':
          return e.kind;
        default: {
          const never: never = e;
          return never;
        }
      }
    };
    expect(typeof label).toBe('function');
  });

  it('ties results to exercises and lets the engine return "nothing to do"', () => {
    expectTypeOf<ExerciseResult['exerciseId']>().toEqualTypeOf<string>();
    expectTypeOf<NextExercise>().parameters.toEqualTypeOf<[EngineState]>();
    expectTypeOf<NextExercise>().returns.toEqualTypeOf<Exercise | null>();
    expectTypeOf<UnitId>().toEqualTypeOf<string>();
    expectTypeOf<LexiconEntry['status']>().toEqualTypeOf<
      'new' | 'learning' | 'known' | 'ignored'
    >();
  });
});
