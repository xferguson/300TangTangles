import { describe, expect, it } from 'vitest';

import { fixturePoemData } from '../../core/fixtures/poem.fixture';
import { parsePoem } from '../../core/poem';
import { generateDistractors } from './distractors';

const poem = parsePoem(fixturePoemData);
const OTHER_CHARS = ['春', '眠', '不', '覺', '曉'];
const other = parsePoem({
  ...structuredClone(fixturePoemData),
  id: 'other-poem',
  lines: poem.lines.map((l, i) =>
    i === 0
      ? {
          ...l,
          chars: OTHER_CHARS.map((t) => ({ ...l.chars[0]!, trad: t, simp: t })),
        }
      : l,
  ),
  units: [
    {
      id: '春',
      simp: '春',
      kind: 'char',
      gloss: 'spring',
      occurrences: [{ line: 0, start: 0 }],
    },
  ],
  distractorSeeds: {},
});

const lineChars = (n: number) => poem.lines[n]!.chars.map((c) => c.trad);

describe('generateDistractors', () => {
  it('is deterministic for the same seed and differs across seeds', () => {
    const opts = { poem, line: 1, count: 4, difficulty: 'medium', otherPoems: [other] } as const;
    expect(generateDistractors({ ...opts, seed: 7 })).toEqual(
      generateDistractors({ ...opts, seed: 7 }),
    );
    const seen = new Set(
      [1, 2, 3, 4, 5, 6].map((seed) => generateDistractors({ ...opts, seed }).join('')),
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it('never returns a character of the line, and returns unique chars', () => {
    for (let line = 0; line < poem.lines.length; line++) {
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        const out = generateDistractors({
          poem,
          line,
          count: 6,
          difficulty,
          seed: 3,
          otherPoems: [other],
        });
        expect(out.length).toBe(6);
        expect(new Set(out).size).toBe(out.length);
        for (const c of out) expect(lineChars(line)).not.toContain(c);
      }
    }
  });

  it('with an index (cloze), only excludes the character valid at that position', () => {
    // line 2 is 舉頭望明月; 明 is valid at index 3 but not at index 2
    const out = generateDistractors({
      poem,
      line: 2,
      index: 2,
      count: 40,
      difficulty: 'hard',
      seed: 1,
      otherPoems: [other],
    });
    expect(out).not.toContain('望');
    expect(out).toContain('明');
  });

  it('hard and medium use seeds first; easy prefers unrelated characters', () => {
    for (const difficulty of ['hard', 'medium'] as const) {
      const out = generateDistractors({
        poem,
        line: 2,
        count: 3,
        difficulty,
        seed: 5,
        otherPoems: [other],
      });
      expect(out).toEqual(expect.arrayContaining(['朢', '忘', '看']));
    }
    const easy = generateDistractors({
      poem,
      line: 2,
      count: 2,
      difficulty: 'easy',
      seed: 5,
      otherPoems: [other],
    });
    expect(easy.every((c) => OTHER_CHARS.includes(c))).toBe(true);
  });

  it('falls back to the rest of the poem; returns fewer if exhausted', () => {
    const out = generateDistractors({ poem, line: 0, count: 100, difficulty: 'hard', seed: 2 });
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThan(100);
    for (const c of out) expect(lineChars(0)).not.toContain(c);
  });

  it('count 0 returns nothing; bad line throws', () => {
    expect(generateDistractors({ poem, line: 0, count: 0, difficulty: 'easy', seed: 1 })).toEqual(
      [],
    );
    expect(() =>
      generateDistractors({ poem, line: 9, count: 1, difficulty: 'easy', seed: 1 }),
    ).toThrow();
  });
});
