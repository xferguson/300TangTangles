/**
 * Pure lexicon operations: unit statuses, FSRS review scheduling and manual overrides.
 * All functions return a new lexicon and never mutate their input. No React / DOM here.
 */
import { createEmptyCard, fsrs, Rating, type Card, type Grade, type State } from 'ts-fsrs';

import type { FsrsCard, LearningLevel, Lexicon, LexiconEntry, UnitId, UnitStatus } from '../core';

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

const GRADES: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

/** How far a review rating moves a learning unit up (+) or down (-) the four levels. */
const LEVEL_DELTA: Record<ReviewRating, number> = { again: -1, hard: 0, good: 1, easy: 2 };

const scheduler = fsrs();

const MS_PER_DAY = 86_400_000;

export function emptyLexicon(): Lexicon {
  return {};
}

/** The entry for a unit, or a fresh `new` entry when it has none. */
export function entryOf(lex: Lexicon, unit: UnitId, now: Date): LexiconEntry {
  return (
    lex[unit] ?? { unit, status: 'new', level: null, fsrs: null, updatedAt: now.toISOString() }
  );
}

export function statusOf(lex: Lexicon, unit: UnitId): UnitStatus {
  return lex[unit]?.status ?? 'new';
}

export function unitsWithStatus(lex: Lexicon, status: UnitStatus): UnitId[] {
  return Object.values(lex)
    .filter((e) => e.status === status)
    .map((e) => e.unit);
}

function toCard(f: FsrsCard): Card {
  const due = new Date(f.due);
  const last = f.lastReview ? new Date(f.lastReview) : undefined;
  return {
    due,
    stability: f.stability,
    difficulty: f.difficulty,
    scheduled_days: last ? Math.max(0, Math.round((due.getTime() - last.getTime()) / MS_PER_DAY)) : 0,
    learning_steps: 0,
    reps: f.reps,
    lapses: f.lapses,
    state: f.state as State,
    last_review: last,
  };
}

function fromCard(c: Card): FsrsCard {
  return {
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as FsrsCard['state'],
    lastReview: c.last_review ? c.last_review.toISOString() : null,
  };
}

const clampLevel = (n: number): LearningLevel => Math.min(4, Math.max(1, n)) as LearningLevel;

/**
 * Apply a review result to a unit: schedules its FSRS card and maps the rating to a status/level.
 * new → learning 1 (whatever the rating); learning moves by the rating and graduates to known past
 * level 4; known stays known unless rated `again`, which drops it to learning 3. Ignored units are
 * left untouched.
 */
export function reviewUnit(lex: Lexicon, unit: UnitId, rating: ReviewRating, now: Date): Lexicon {
  const prev = entryOf(lex, unit, now);
  if (prev.status === 'ignored') return lex;

  const card = prev.fsrs ? toCard(prev.fsrs) : createEmptyCard(now);
  const next = fromCard(scheduler.next(card, now, GRADES[rating]).card);

  let status: UnitStatus;
  let level: LearningLevel | null;
  if (prev.status === 'new') {
    status = 'learning';
    level = 1;
  } else if (prev.status === 'known') {
    if (rating === 'again') {
      status = 'learning';
      level = 3;
    } else {
      status = 'known';
      level = null;
    }
  } else {
    const raw = (prev.level ?? 1) + LEVEL_DELTA[rating];
    if (raw > 4) {
      status = 'known';
      level = null;
    } else {
      status = 'learning';
      level = clampLevel(raw);
    }
  }

  return {
    ...lex,
    [unit]: { unit, status, level, fsrs: next, updatedAt: now.toISOString() },
  };
}

export interface StatusOverride {
  status: UnitStatus;
  /** Only used with `learning`; defaults to 1. */
  level?: LearningLevel;
}

/**
 * Manual override (tap in the UI). Keeps any existing FSRS card, except when resetting to `new`,
 * which forgets the schedule too.
 */
export function setStatus(
  lex: Lexicon,
  unit: UnitId,
  { status, level }: StatusOverride,
  now: Date,
): Lexicon {
  const prev = lex[unit];
  const entry: LexiconEntry = {
    unit,
    status,
    level: status === 'learning' ? (level ?? 1) : null,
    fsrs: status === 'new' ? null : (prev?.fsrs ?? null),
    updatedAt: now.toISOString(),
  };
  return { ...lex, [unit]: entry };
}

/** "Mark rest known": bulk-set units to known, leaving `ignored` units alone. */
export function markKnown(lex: Lexicon, units: readonly UnitId[], now: Date): Lexicon {
  let out = lex;
  for (const unit of units) {
    if (statusOf(out, unit) === 'ignored') continue;
    out = setStatus(out, unit, { status: 'known' }, now);
  }
  return out;
}
