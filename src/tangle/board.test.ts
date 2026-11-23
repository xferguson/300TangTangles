import { describe, expect, it } from 'vitest';

import { fixturePoemData } from '../core/fixtures/poem.fixture';
import { parsePoem } from '../core/poem';
import { scoreRow } from './feedback';
import { MAX_ATTEMPTS, aggregateBank, lineOutcome, shareGrid, type TileFeedback } from './board';

const poem = parsePoem(fixturePoemData);
const row = (line: number, guess: string): TileFeedback[] => scoreRow(poem, line, [...guess]);

describe('aggregateBank', () => {
  it('keeps the strongest state seen for each char', () => {
    const bank = aggregateBank([row(0, '前床月明光'), row(0, '床前明月光')]);
    expect(bank.get('前')).toBe('correct');
    expect(bank.get('明')).toBe('correct');
  });

  it('never downgrades a revealed state', () => {
    const bank = aggregateBank([row(0, '床前明月光'), row(0, '明明明明明')]);
    expect(bank.get('明')).toBe('correct');
  });

  it('colors distractors absent and other-line chars as such', () => {
    const bank = aggregateBank([row(0, '疑天明月光')]);
    expect(bank.get('疑')).toBe('other-line');
    expect(bank.get('天')).toBe('absent');
  });

  it('leaves unguessed chars out', () => {
    expect(aggregateBank([]).size).toBe(0);
  });
});

describe('lineOutcome', () => {
  it('is in-progress with attempts left', () => {
    expect(lineOutcome([row(0, '前床月明光')])).toEqual({ status: 'in-progress', attemptsLeft: 5 });
  });

  it('is solved when a row is all correct, even on the last attempt', () => {
    const wrong = Array.from({ length: MAX_ATTEMPTS - 1 }, () => row(0, '前床月明光'));
    expect(lineOutcome([...wrong, row(0, '床前明月光')])).toEqual({
      status: 'solved',
      attemptsLeft: 0,
    });
  });

  it('returns the line to review when the budget is exhausted', () => {
    const wrong = Array.from({ length: MAX_ATTEMPTS }, () => row(0, '前床月明光'));
    expect(lineOutcome(wrong)).toEqual({ status: 'review', attemptsLeft: 0 });
  });

  it('honors a custom budget', () => {
    expect(lineOutcome([row(0, '前床月明光')], 1).status).toBe('review');
  });

  it('has 6 attempts by default', () => {
    expect(MAX_ATTEMPTS).toBe(6);
  });
});

describe('shareGrid', () => {
  it('renders one emoji row per guess, in Tang-color order', () => {
    const grid = shareGrid([row(0, '前床天疑光'), row(0, '床前明月光')]);
    expect(grid).toBe('🟨🟨⬛🟪🟩\n🟩🟩🟩🟩🟩');
  });

  it('is empty with no guesses', () => {
    expect(shareGrid([])).toBe('');
  });
});
