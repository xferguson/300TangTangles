import { describe, expect, it } from 'vitest';

import { fixturePoemData } from '../core/fixtures/poem.fixture';
import { parsePoem } from '../core/poem';
import { scoreRow, type TileState } from './feedback';

const poem = parsePoem(fixturePoemData);
const CODES: Record<TileState, string> = {
  correct: 'c',
  'in-line': 'i',
  'other-line': 'o',
  absent: 'a',
};
const code = (line: number, guess: string) =>
  scoreRow(poem, line, [...guess])
    .map((t) => CODES[t.state])
    .join('');

describe('scoreRow', () => {
  it('marks an exact guess all correct', () => {
    expect(code(0, '床前明月光')).toBe('ccccc');
  });

  it('marks chars in the line but misplaced as in-line', () => {
    expect(code(0, '前床月明光')).toBe('iiiic');
  });

  it('marks chars from another line as other-line', () => {
    // 疑是地上霜 all belong to line 1
    expect(code(0, '疑是地上霜')).toBe('ooooo');
  });

  it('marks chars not in the poem as absent', () => {
    expect(code(0, '天天天天天')).toBe('aaaaa');
  });

  it('is count-aware for 明月 x2: line 0 has one 明, extra copies fall to other-line', () => {
    expect(code(0, '明明明明明')).toBe('oocoo');
    expect(code(0, '床明明月光')).toBe('coccc');
  });

  it('gives correct matches priority over in-line for duplicates (頭 x2)', () => {
    // line 2 has one 頭; the spare 頭 exists only in line 3, so the misplaced copy is other-line
    expect(code(2, '頭頭望明月')).toBe('occcc');
  });

  it('marks a misplaced single copy as in-line', () => {
    expect(code(2, '頭舉望明月')).toBe('iiccc');
  });

  it('marks a distractor among real chars as absent', () => {
    expect(code(1, '疑是天上霜')).toBe('ccacc');
  });

  it('returns the guessed char on each tile', () => {
    expect(scoreRow(poem, 0, [...'床前明月光']).map((t) => t.char)).toEqual([...'床前明月光']);
  });

  it('rejects a guess of the wrong length', () => {
    expect(() => scoreRow(poem, 0, [...'床前'])).toThrow();
  });
});
