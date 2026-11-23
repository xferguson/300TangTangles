/**
 * Shared contracts for the whole app. Domain logic (lexicon, engine, tangle, grader) and the UI
 * both build against these types and nothing else, which is what lets them be written in parallel.
 *
 * Rules (see CLAUDE.md): pure types + validation, no React / DOM / Node APIs. Change this file only
 * in a dedicated small PR that says which tasks it affects.
 *
 * Conventions:
 * - Characters and units are always **Traditional** strings in data. The UI converts to Simplified
 *   for display via `PoemChar.simp` / `Settings.script`; nothing is converted at runtime.
 * - Line numbers and character positions are 0-based.
 * - Timestamps are ISO-8601 strings so state is JSON-serializable (IndexedDB, backup files).
 */
import { z } from 'zod';

import type { Poem, Readings } from './poem';

// ───────────────────────────── Units & lexicon ─────────────────────────────

/** Key of a learnable unit in the global lexicon: its Traditional text, e.g. `月` or `明月`. */
export type UnitId = string;

export const UNIT_STATUSES = ['new', 'learning', 'known', 'ignored'] as const;
export const unitStatusSchema = z.enum(UNIT_STATUSES);
/** `new` = never seen (azurite), `learning` = in progress (gamboge, fades with level), `known`/`ignored` = no highlight. */
export type UnitStatus = z.infer<typeof unitStatusSchema>;

export const learningLevelSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);
/** 1 = just started … 4 = nearly known. Only meaningful while status is `learning`. */
export type LearningLevel = z.infer<typeof learningLevelSchema>;

const isoTime = z.iso.datetime();

/**
 * Spaced-repetition card state for one unit. Plain data so it serializes; T30 maps it to and from
 * `ts-fsrs` cards. T30 may add fields through a contract PR.
 */
export const fsrsCardSchema = z.strictObject({
  due: isoTime,
  stability: z.number().min(0),
  difficulty: z.number().min(0),
  reps: z.number().int().min(0),
  lapses: z.number().int().min(0),
  /** 0 New, 1 Learning, 2 Review, 3 Relearning (ts-fsrs `State`). */
  state: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  lastReview: isoTime.nullable(),
});
export type FsrsCard = z.infer<typeof fsrsCardSchema>;

export const lexiconEntrySchema = z
  .strictObject({
    unit: z.string().min(1),
    status: unitStatusSchema,
    /** Set when, and only when, `status` is `learning`. */
    level: learningLevelSchema.nullable(),
    fsrs: fsrsCardSchema.nullable(),
    updatedAt: isoTime,
  })
  .superRefine((e, ctx) => {
    if (e.status === 'learning' && e.level === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['level'],
        message: 'a learning unit needs a level 1-4',
      });
    }
    if (e.status !== 'learning' && e.level !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['level'],
        message: 'only a learning unit has a level',
      });
    }
  });
export type LexiconEntry = z.infer<typeof lexiconEntrySchema>;

/** The whole lexicon, keyed by unit. A unit with no entry is `new`. */
export type Lexicon = Record<UnitId, LexiconEntry>;

// ───────────────────────────── Settings & readings ─────────────────────────────

export const AUDIO_LANGUAGES = ['cmn', 'yue', 'nan'] as const;
/** Mandarin, Cantonese, Taiwanese Hokkien, in build-priority order. */
export type AudioLanguage = (typeof AUDIO_LANGUAGES)[number];

/** Hokkien reading layer: `lit` 文讀 (literary, used to recite poems) or `col` 白讀 (everyday). */
export type HokkienLayer = 'lit' | 'col';

/** Which romanization system a reading string is written in. */
export type ReadingSystem = 'zhuyin' | 'pinyin' | 'jyutping' | 'tailo';

export const DEFAULT_SETTINGS = {
  script: 'trad',
  mandarinRomanization: 'zhuyin',
  showReadings: true,
  audioLanguage: 'cmn',
  hokkienLayer: 'lit',
  theme: 'system',
} as const satisfies Settings;

export const settingsSchema = z.strictObject({
  script: z.enum(['trad', 'simp']).default('trad'),
  /** Mandarin reading shown above/beside characters. */
  mandarinRomanization: z.enum(['zhuyin', 'pinyin']).default('zhuyin'),
  showReadings: z.boolean().default(true),
  audioLanguage: z.enum(AUDIO_LANGUAGES).default('cmn'),
  hokkienLayer: z.enum(['lit', 'col']).default('lit'),
  theme: z.enum(['system', 'light', 'dark']).default('system'),
});
export type Settings = z.infer<typeof settingsSchema>;

/** The reading system to show for the current audio language. */
export function readingSystemFor(settings: Settings): ReadingSystem {
  switch (settings.audioLanguage) {
    case 'cmn':
      return settings.mandarinRomanization;
    case 'yue':
      return 'jyutping';
    case 'nan':
      return 'tailo';
  }
}

/** The reading string to display for a character, or `undefined` when readings are hidden. */
export function readingFor(readings: Readings, settings: Settings): string | undefined {
  if (!settings.showReadings) return undefined;
  const system = readingSystemFor(settings);
  return system === 'tailo' ? readings.tailo[settings.hokkienLayer] : readings[system];
}

// ───────────────────────────── Ranks & mastery ─────────────────────────────

/** Imperial-exam ranks along the one path from first read to full recitation, lowest first. */
export const RANKS = ['tongsheng', 'xiucai', 'juren', 'jinshi', 'tanhua', 'zhuangyuan'] as const;
export type Rank = (typeof RANKS)[number];

export const RANK_LABELS: Record<Rank, string> = {
  tongsheng: '童生',
  xiucai: '秀才',
  juren: '舉人',
  jinshi: '進士',
  tanhua: '探花',
  zhuangyuan: '狀元',
};

/** Line-builder scaffolding, most support first: 1 cloze, 2 ordered bank, 3 + distractors, 4 translation only, 5 first character only. */
export const scaffoldStepSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export type ScaffoldStep = z.infer<typeof scaffoldStepSchema>;

const score = z.number().min(0).max(1);

/**
 * How well one line is known, per skill, 0-1. A line counts as mastered only when it can be
 * produced **and** its meaning can be stated.
 */
export const lineMasterySchema = z.strictObject({
  recognition: score,
  production: score,
  meaning: score,
  recitation: score,
  scaffoldStep: scaffoldStepSchema,
  tangleCleared: z.boolean(),
});
export type LineMastery = z.infer<typeof lineMasterySchema>;

export function emptyLineMastery(): LineMastery {
  return {
    recognition: 0,
    production: 0,
    meaning: 0,
    recitation: 0,
    scaffoldStep: 1,
    tangleCleared: false,
  };
}

/** Persisted progress through one poem. `lines` has one entry per poem line. */
export const poemProgressSchema = z.strictObject({
  poemId: z.string().min(1),
  lines: z.array(lineMasterySchema),
  /** Ranks whose seal has been earned (stamped once, never removed; they dim when review is overdue). */
  seals: z.array(z.enum(RANKS)),
  startedAt: isoTime,
  updatedAt: isoTime,
});
export type PoemProgress = z.infer<typeof poemProgressSchema>;

// ───────────────────────────── Exercises ─────────────────────────────

interface ExerciseBase {
  /** Unique within a session; echoed back in the result. */
  id: string;
  poemId: string;
}

export type FlashcardDirection = 'char-to-meaning' | 'audio-to-char' | 'meaning-to-char';

/** One unit, multiple choice. `choices` are glosses or characters depending on `direction`. */
export interface FlashcardExercise extends ExerciseBase {
  kind: 'flashcard';
  unit: UnitId;
  direction: FlashcardDirection;
  choices: string[];
  answerIndex: number;
}

/** A line with one or two characters blanked out (scaffold step 1). */
export interface ClozeExercise extends ExerciseBase {
  kind: 'cloze';
  line: number;
  blanks: { index: number; answer: string; choices: string[] }[];
}

export type MeaningPrompt = 'line-to-translation' | 'translation-to-line' | 'feeling';

/** Meaning check: pick the translation for a line, the line for a translation, or the poet's feeling. */
export interface MeaningCheckExercise extends ExerciseBase {
  kind: 'meaning-check';
  line: number;
  prompt: MeaningPrompt;
  /** Text shown above the choices (a line, a translation, or the feeling question). */
  stem: string;
  choices: string[];
  answerIndex: number;
}

/** Scaffold steps 2-5: build the line by tapping characters from a bank. */
export interface LineBuilderExercise extends ExerciseBase {
  kind: 'line-builder';
  line: number;
  step: Exclude<ScaffoldStep, 1>;
  /** Shuffled tiles to pick from (the line's characters, plus distractors from step 3 on). */
  bank: string[];
  /** The correct characters in order. */
  answer: string[];
  showAudio: boolean;
  showTranslation: boolean;
  /** Step 5 shows only the first character. */
  firstChar: string | null;
}

/** One line of the Wordle-style Tangle board; the bank holds the whole poem's characters. */
export interface TangleRowExercise extends ExerciseBase {
  kind: 'tangle-row';
  line: number;
  bank: string[];
  answer: string[];
  /** Guesses allowed for this line (6). Running out sends the line back to practice. */
  maxAttempts: number;
  /** Lines already solved, shown filled in. */
  solvedLines: number[];
}

export type RecitePrompt = 'translation' | 'previous-line' | 'blank';

/** Speak a line, or the whole poem from a blank scroll. */
export interface ReciteExercise extends ExerciseBase {
  kind: 'recite';
  scope: 'line' | 'poem';
  /** Which line when `scope` is `line`; `null` for the whole poem. */
  line: number | null;
  prompt: RecitePrompt;
  language: AudioLanguage;
}

export type Exercise =
  | FlashcardExercise
  | ClozeExercise
  | MeaningCheckExercise
  | LineBuilderExercise
  | TangleRowExercise
  | ReciteExercise;

export type ExerciseKind = Exercise['kind'];

/** What an exercise component reports back when the learner finishes it. */
export interface ExerciseResult {
  exerciseId: string;
  poemId: string;
  kind: ExerciseKind;
  /** Line the exercise was about, or `null` (e.g. a flashcard, or whole-poem recitation). */
  line: number | null;
  correct: boolean;
  /** Tries taken, at least 1. */
  attempts: number;
  durationMs: number;
  hintsUsed: number;
  /** 0-1 character accuracy for recitation; `null` for other kinds. */
  accuracy: number | null;
  /** Units the learner got wrong, so the engine can demote them. */
  unitsMissed: UnitId[];
}

// ───────────────────────────── Engine ─────────────────────────────

/** Everything the session engine needs to choose the next exercise. Pure data in, pure data out. */
export interface EngineState {
  poem: Poem;
  lexicon: Lexicon;
  progress: PoemProgress;
  settings: Settings;
  /** Current time (ISO). Passed in so the engine stays deterministic and testable. */
  now: string;
  /** Seed for shuffling and distractor choice, so a session is reproducible. */
  seed: number;
  /** Results from the current session, oldest first. */
  history: ExerciseResult[];
}

/**
 * The one decision the whole game makes: given what the learner knows, what comes next?
 * `null` means nothing is due right now (poem mastered, no reviews pending).
 * Implemented by the session engine (T34); screens only call it through the session flow (T55).
 */
export type NextExercise = (state: EngineState) => Exercise | null;
