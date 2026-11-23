import { describe, expect, it } from 'vitest';

import { fixturePoemData } from './fixtures/poem.fixture';
import { lineText, parsePoem, poemCharCount, safeParsePoem } from './poem';

/** Deep copy so each test can break one thing. */
const fresh = () => structuredClone(fixturePoemData) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- test mutates arbitrary shapes

describe('poem schema', () => {
  it('accepts the valid fixture', () => {
    const poem = parsePoem(fixturePoemData);
    expect(poem.id).toBe('fixture-jingyesi');
    expect(poem.lines).toHaveLength(4);
    expect(poemCharCount(poem)).toBe(20);
  });

  it('keeps both Tâi-lô layers on every character', () => {
    const poem = parsePoem(fixturePoemData);
    const c = poem.lines[0]!.chars[0]!;
    expect(c.readings.tailo).toEqual({ lit: 'fx-lit', col: 'fx-col' });
  });

  it('renders line text in either script', () => {
    const poem = parsePoem(fixturePoemData);
    expect(lineText(poem.lines[2]!, 'trad')).toBe('舉頭望明月');
    expect(lineText(poem.lines[2]!, 'simp')).toBe('举头望明月');
    expect(lineText(poem.lines[2]!, 'trad', { punct: true })).toBe('舉頭望明月，');
  });

  it('rejects a missing reading system', () => {
    const d = fresh();
    delete d.lines[0].chars[0].readings.jyutping;
    expect(safeParsePoem(d).success).toBe(false);
  });

  it('rejects a Tâi-lô entry missing a layer', () => {
    const d = fresh();
    delete d.lines[0].chars[0].readings.tailo.col;
    expect(safeParsePoem(d).success).toBe(false);
  });

  it('rejects an empty reading string', () => {
    const d = fresh();
    d.lines[0].chars[0].readings.pinyin = '';
    expect(safeParsePoem(d).success).toBe(false);
  });

  it('rejects a char field that is not exactly one character', () => {
    const d = fresh();
    d.lines[0].chars[0].trad = '床前';
    expect(safeParsePoem(d).success).toBe(false);
  });

  it('rejects a form that does not match line shape (五絕 needs 4 lines of 5)', () => {
    const d = fresh();
    d.lines[3].chars.pop();
    expect(safeParsePoem(d).success).toBe(false);
  });

  it('rejects a line with fewer than two wrong-feeling options', () => {
    const d = fresh();
    d.lines[0].meaning.wrongFeelings = ['only one'];
    expect(safeParsePoem(d).success).toBe(false);
  });

  it('rejects an id that is not a lowercase slug', () => {
    const d = fresh();
    d.id = 'Bad Id';
    expect(safeParsePoem(d).success).toBe(false);
  });

  it('rejects an unsupported schemaVersion', () => {
    const d = fresh();
    d.schemaVersion = 2;
    expect(safeParsePoem(d).success).toBe(false);
  });

  it('rejects unknown keys (typos fail loudly)', () => {
    const d = fresh();
    d.lines[0].chars[0].readings.pinyinn = 'x';
    expect(safeParsePoem(d).success).toBe(false);
  });

  describe('units', () => {
    it('rejects duplicate unit ids', () => {
      const d = fresh();
      d.units.push({ ...d.units[0] });
      expect(safeParsePoem(d).success).toBe(false);
    });

    it('rejects an occurrence whose text does not match the unit', () => {
      const d = fresh();
      const moon = d.units.find((u: { id: string }) => u.id === '明月');
      moon.occurrences = [{ line: 0, start: 0 }];
      expect(safeParsePoem(d).success).toBe(false);
    });

    it('rejects an occurrence outside the line', () => {
      const d = fresh();
      const moon = d.units.find((u: { id: string }) => u.id === '明月');
      moon.occurrences = [{ line: 0, start: 4 }];
      expect(safeParsePoem(d).success).toBe(false);
    });

    it('rejects a unit whose simplified text does not match the line', () => {
      const d = fresh();
      const head = d.units.find((u: { id: string }) => u.id === '舉頭');
      head.simp = '舉頭';
      expect(safeParsePoem(d).success).toBe(false);
    });

    it('rejects a char-kind unit longer than one character', () => {
      const d = fresh();
      const moon = d.units.find((u: { id: string }) => u.id === '明月');
      moon.kind = 'char';
      expect(safeParsePoem(d).success).toBe(false);
    });

    it('requires a char unit for every distinct character in the poem', () => {
      const d = fresh();
      d.units = d.units.filter((u: { id: string }) => u.id !== '霜');
      expect(safeParsePoem(d).success).toBe(false);
    });

    it('requires a char unit to list every place the char occurs', () => {
      const d = fresh();
      const moon = d.units.find((u: { id: string }) => u.id === '月');
      moon.occurrences = [{ line: 0, start: 3 }];
      expect(safeParsePoem(d).success).toBe(false);
    });
  });

  describe('distractor seeds', () => {
    it('rejects a seed equal to its own key', () => {
      const d = fresh();
      d.distractorSeeds['望'].look = ['望'];
      expect(safeParsePoem(d).success).toBe(false);
    });

    it('rejects a seed that is not a single character', () => {
      const d = fresh();
      d.distractorSeeds['望'].meaning = ['看看'];
      expect(safeParsePoem(d).success).toBe(false);
    });
  });
});
