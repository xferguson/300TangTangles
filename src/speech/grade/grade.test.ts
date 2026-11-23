import { describe, expect, it } from 'vitest';

import { fixturePoemData } from '../../core/fixtures/poem.fixture';
import { parsePoem } from '../../core/poem';
import { gradeRecitation } from './grade';

const poem = parsePoem(fixturePoemData);
const line0 = poem.lines[0]!.chars; // 床前明月光
const wholePoem = poem.lines.flatMap((l) => l.chars);

const base = { system: 'pinyin' as const };

describe('gradeRecitation: alignment', () => {
  it('scores an exact match as 1 with every char correct', () => {
    const r = gradeRecitation({ ...base, target: line0, transcript: '床前明月光' });
    expect(r.accuracy).toBe(1);
    expect(r.diff.map((d) => d.status)).toEqual([
      'correct',
      'correct',
      'correct',
      'correct',
      'correct',
    ]);
    expect(r.extras).toEqual([]);
    expect(r.missedIndexes).toEqual([]);
  });

  it('ignores punctuation and whitespace in the transcript', () => {
    const r = gradeRecitation({ ...base, target: line0, transcript: ' 床前，明月 光。' });
    expect(r.accuracy).toBe(1);
  });

  it('accepts Simplified transcripts of Traditional targets', () => {
    const r = gradeRecitation({
      ...base,
      target: poem.lines[2]!.chars,
      transcript: '举头望明月',
    });
    expect(r.accuracy).toBe(1);
  });

  it('marks a missing char and reports accuracy over the target length', () => {
    const r = gradeRecitation({ ...base, target: line0, transcript: '床前月光' });
    expect(r.diff.map((d) => d.status)).toEqual([
      'correct',
      'correct',
      'missing',
      'correct',
      'correct',
    ]);
    expect(r.accuracy).toBeCloseTo(4 / 5);
    expect(r.missedIndexes).toEqual([2]);
  });

  it('records extra transcript chars without penalising the target chars', () => {
    const r = gradeRecitation({ ...base, target: line0, transcript: '床前明明月光' });
    expect(r.accuracy).toBe(1);
    expect(r.extras).toHaveLength(1);
    expect(r.extras[0]!.char).toBe('明');
  });

  it('marks a wrong char as wrong and records what was heard', () => {
    const r = gradeRecitation({ ...base, target: line0, transcript: '床前明日光' });
    expect(r.diff[3]).toMatchObject({ status: 'wrong', heard: '日' });
    expect(r.accuracy).toBeCloseTo(4 / 5);
  });

  it('handles an empty transcript and works on the whole poem', () => {
    expect(gradeRecitation({ ...base, target: line0, transcript: '' }).accuracy).toBe(0);
    const full = wholePoem.map((c) => c.trad).join('');
    expect(gradeRecitation({ ...base, target: wholePoem, transcript: full }).accuracy).toBe(1);
    const skipped = full.slice(0, 5) + full.slice(10);
    const r = gradeRecitation({ ...base, target: wholePoem, transcript: skipped });
    expect(r.accuracy).toBeCloseTo(15 / 20);
  });
});
