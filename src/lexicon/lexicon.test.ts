import { describe, expect, it } from 'vitest';

import { lexiconEntrySchema } from '../core';
import {
  emptyLexicon,
  entryOf,
  markKnown,
  reviewUnit,
  setStatus,
  statusOf,
  unitsWithStatus,
} from './lexicon';

const T0 = new Date('2026-01-01T00:00:00.000Z');
const day = (n: number) => new Date(T0.getTime() + n * 86_400_000);

describe('lexicon status', () => {
  it('treats a unit with no entry as new', () => {
    const lex = emptyLexicon();
    expect(statusOf(lex, '月')).toBe('new');
    expect(entryOf(lex, '月', T0)).toMatchObject({
      unit: '月',
      status: 'new',
      level: null,
      fsrs: null,
    });
  });

  it('first review moves new to learning and creates an FSRS card', () => {
    const lex = reviewUnit(emptyLexicon(), '月', 'good', T0);
    const e = lex['月']!;
    expect(e.status).toBe('learning');
    expect(e.level).toBe(1);
    expect(e.fsrs).not.toBeNull();
    expect(e.fsrs!.reps).toBe(1);
    expect(e.updatedAt).toBe(T0.toISOString());
    expect(lexiconEntrySchema.safeParse(e).success).toBe(true);
  });

  it('first review rated again still lands on learning level 1', () => {
    const e = reviewUnit(emptyLexicon(), '月', 'again', T0)['月']!;
    expect(e).toMatchObject({ status: 'learning', level: 1 });
  });

  it('good raises the level by one, easy by two, hard keeps, again lowers (min 1)', () => {
    let lex = reviewUnit(emptyLexicon(), '月', 'good', T0);
    lex = reviewUnit(lex, '月', 'good', day(1));
    expect(lex['月']!.level).toBe(2);
    lex = reviewUnit(lex, '月', 'hard', day(2));
    expect(lex['月']!.level).toBe(2);
    lex = reviewUnit(lex, '月', 'easy', day(3));
    expect(lex['月']!.level).toBe(4);
    lex = reviewUnit(lex, '月', 'again', day(4));
    expect(lex['月']!.level).toBe(3);
    lex = reviewUnit(lex, '月', 'again', day(5));
    lex = reviewUnit(lex, '月', 'again', day(6));
    lex = reviewUnit(lex, '月', 'again', day(7));
    expect(lex['月']!.level).toBe(1);
  });

  it('good at level 4 graduates to known', () => {
    let lex = reviewUnit(emptyLexicon(), '月', 'easy', T0); // new -> learning 1 (first review)
    lex = reviewUnit(lex, '月', 'easy', day(1)); // 3
    lex = reviewUnit(lex, '月', 'good', day(2)); // 4
    lex = reviewUnit(lex, '月', 'good', day(3));
    expect(lex['月']).toMatchObject({ status: 'known', level: null });
    expect(lex['月']!.fsrs).not.toBeNull();
  });

  it('a lapse on a known unit drops it back to learning level 3', () => {
    let lex = markKnown(emptyLexicon(), ['月'], T0);
    lex = reviewUnit(lex, '月', 'again', day(1));
    expect(lex['月']).toMatchObject({ status: 'learning', level: 3 });
  });

  it('reviewing a known unit with good keeps it known', () => {
    let lex = markKnown(emptyLexicon(), ['月'], T0);
    lex = reviewUnit(lex, '月', 'good', day(1));
    expect(lex['月']!.status).toBe('known');
  });

  it('review schedules the next due date in the future', () => {
    const lex = reviewUnit(emptyLexicon(), '月', 'good', T0);
    expect(new Date(lex['月']!.fsrs!.due).getTime()).toBeGreaterThan(T0.getTime());
  });

  it('does not mutate the input lexicon', () => {
    const lex = emptyLexicon();
    reviewUnit(lex, '月', 'good', T0);
    expect(lex).toEqual({});
  });

  it('ignored units are not changed by reviews', () => {
    let lex = setStatus(emptyLexicon(), '之', { status: 'ignored' }, T0);
    lex = reviewUnit(lex, '之', 'good', day(1));
    expect(lex['之']!.status).toBe('ignored');
  });
});

describe('manual override', () => {
  it('sets any status, with a level only for learning', () => {
    let lex = setStatus(emptyLexicon(), '月', { status: 'learning', level: 3 }, T0);
    expect(lex['月']).toMatchObject({ status: 'learning', level: 3 });
    lex = setStatus(lex, '月', { status: 'known' }, day(1));
    expect(lex['月']).toMatchObject({ status: 'known', level: null });
    lex = setStatus(lex, '月', { status: 'new' }, day(2));
    expect(lex['月']).toMatchObject({ status: 'new', level: null, fsrs: null });
    lex = setStatus(lex, '月', { status: 'learning' }, day(3));
    expect(lex['月']).toMatchObject({ status: 'learning', level: 1 });
  });

  it('keeps the FSRS card when overriding to known', () => {
    let lex = reviewUnit(emptyLexicon(), '月', 'good', T0);
    lex = setStatus(lex, '月', { status: 'known' }, day(1));
    expect(lex['月']!.fsrs).not.toBeNull();
  });

  it('markKnown marks many units, leaving ignored ones alone', () => {
    let lex = setStatus(emptyLexicon(), '之', { status: 'ignored' }, T0);
    lex = markKnown(lex, ['月', '光', '之'], day(1));
    expect(unitsWithStatus(lex, 'known').sort()).toEqual(['光', '月']);
    expect(lex['之']!.status).toBe('ignored');
  });
});

describe('cross-poem sharing', () => {
  it('one entry per unit is shared by every poem that uses it', () => {
    // The lexicon is keyed by unit, not by poem: learning 月 via poem A is visible to poem B.
    const lex = reviewUnit(emptyLexicon(), '月', 'good', T0);
    const statuses = (units: string[]) => units.map((u) => statusOf(lex, u));
    expect(statuses(['床', '前', '明', '月', '光'])[3]).toBe('learning');
    expect(statuses(['月', '落', '烏', '啼'])).toEqual(['learning', 'new', 'new', 'new']);
  });
});
