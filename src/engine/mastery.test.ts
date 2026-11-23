import { describe, expect, it } from 'vitest';

import { emptyLineMastery } from '../core/types';
import { markKnown, setStatus } from '../lexicon/lexicon';
import {
  computeRank,
  fadeLevels,
  initialProgress,
  isLineMastered,
  isLineReady,
  isUnitReady,
  lineUnits,
  refreshRecognition,
  sealsFor,
  unitScore,
} from './mastery';
import { NOW, allKnown, allUnitIds, freshProgress, mastered, poem, progressOf } from './testkit';

const now = new Date(NOW);
const n = poem.lines.length;

describe('unit readiness', () => {
  it('scores new < learning levels < known, ignored counts as known', () => {
    let lex = setStatus({}, '月', { status: 'learning', level: 1 }, now);
    lex = setStatus(lex, '光', { status: 'learning', level: 3 }, now);
    lex = setStatus(lex, '霜', { status: 'known' }, now);
    lex = setStatus(lex, '床', { status: 'ignored' }, now);
    expect(unitScore(lex, '前')).toBe(0);
    expect(unitScore(lex, '月')).toBeLessThan(unitScore(lex, '光'));
    expect(unitScore(lex, '光')).toBeLessThan(1);
    expect(unitScore(lex, '霜')).toBe(1);
    expect(unitScore(lex, '床')).toBe(1);
  });

  it('is ready from learning level 2 up, and when known or ignored', () => {
    const lex = setStatus({}, '月', { status: 'learning', level: 1 }, now);
    expect(isUnitReady(lex, '月')).toBe(false);
    expect(isUnitReady(lex, '光')).toBe(false);
    expect(isUnitReady(setStatus(lex, '月', { status: 'learning', level: 2 }, now), '月')).toBe(true);
    expect(isUnitReady(setStatus(lex, '月', { status: 'ignored' }, now), '月')).toBe(true);
  });
});

describe('line units and recognition', () => {
  it('lists the chars and compounds occurring in a line, in reading order', () => {
    expect(lineUnits(poem, 0).map((u) => u.id)).toEqual(['床', '前', '明', '月', '光', '明月']);
    expect(lineUnits(poem, 2).map((u) => u.id)).toEqual(['舉', '頭', '望', '明', '月', '舉頭', '明月']);
  });

  it('a line is ready only when every unit is ready', () => {
    const lex = markKnown({}, ['床', '前', '明', '月', '光'], now);
    expect(isLineReady(poem, lex, 0)).toBe(false); // compound 明月 still new
    expect(isLineReady(poem, markKnown(lex, ['明月'], now), 0)).toBe(true);
  });

  it('refreshRecognition derives recognition from the lexicon for every line', () => {
    const p = refreshRecognition(poem, allKnown(), freshProgress());
    expect(p.lines.every((l) => l.recognition === 1)).toBe(true);
    const q = refreshRecognition(poem, {}, progressOf(poem.lines.map(() => mastered())));
    expect(q.lines.every((l) => l.recognition === 0)).toBe(true);
  });

  it('pads progress to one entry per line', () => {
    const p = refreshRecognition(poem, {}, progressOf([emptyLineMastery()]));
    expect(p.lines).toHaveLength(n);
  });
});

describe('line mastery', () => {
  it('needs recognition, production, meaning and recitation', () => {
    const lex = allKnown();
    expect(isLineMastered(poem, lex, mastered(), 0)).toBe(true);
    for (const k of ['production', 'meaning', 'recitation'] as const) {
      expect(isLineMastered(poem, lex, mastered({ [k]: 0.5 }), 0)).toBe(false);
    }
    expect(isLineMastered(poem, {}, mastered(), 0)).toBe(false);
  });
});

describe('rank', () => {
  const lex = allKnown();
  const lines = (m: Partial<ReturnType<typeof mastered>>) => poem.lines.map(() => mastered(m));

  it('starts at 童生', () => {
    expect(computeRank(poem, {}, freshProgress())).toBe('tongsheng');
  });
  it('秀才 once every line is recognised', () => {
    const p = progressOf(poem.lines.map(() => emptyLineMastery()));
    expect(computeRank(poem, lex, p)).toBe('xiucai');
  });
  it('舉人 once every line is produced', () => {
    expect(computeRank(poem, lex, progressOf(lines({ meaning: 0, recitation: 0 })))).toBe('juren');
  });
  it('one unproduced line holds the rank back', () => {
    const ls = lines({});
    ls[2] = mastered({ production: 0.4 });
    expect(computeRank(poem, lex, progressOf(ls))).toBe('xiucai');
  });
  it('進士 needs meaning and recitation too', () => {
    expect(computeRank(poem, lex, progressOf(lines({ recitation: 0 })))).toBe('juren');
    expect(computeRank(poem, lex, progressOf(lines({ meaning: 0.5 })))).toBe('juren');
    expect(computeRank(poem, lex, progressOf(lines({})))).toBe('jinshi');
  });
  it('探花 once the Tangle is cleared', () => {
    expect(computeRank(poem, lex, progressOf(lines({ tangleCleared: true })))).toBe('tanhua');
  });
  it('狀元 needs the seal from the final recitation as well', () => {
    expect(computeRank(poem, lex, progressOf(lines({ tangleCleared: true }), ['zhuangyuan']))).toBe(
      'zhuangyuan',
    );
  });
  it('drops back when a unit is forgotten (demotion)', () => {
    const p = progressOf(lines({ tangleCleared: true }), ['zhuangyuan']);
    const forgotten = setStatus(lex, '月', { status: 'learning', level: 1 }, now);
    expect(computeRank(poem, forgotten, p)).toBe('tongsheng');
  });
});

describe('seals', () => {
  it('lists every seal up to the rank, excluding 童生, merged with seals already held', () => {
    expect(sealsFor('tongsheng', [])).toEqual([]);
    expect(sealsFor('juren', [])).toEqual(['xiucai', 'juren']);
    expect(sealsFor('xiucai', ['zhuangyuan'])).toEqual(['xiucai', 'zhuangyuan']);
  });
});

describe('fade levels', () => {
  it('is 0 for a fresh poem, 1 everywhere when fully mastered, and per char', () => {
    expect(fadeLevels(poem, {}, freshProgress()).flat().every((f) => f === 0)).toBe(true);
    const done = progressOf(poem.lines.map(() => mastered({ tangleCleared: true })));
    const f = fadeLevels(poem, allKnown(), done);
    expect(f).toHaveLength(n);
    expect(f.flat().every((x) => x === 1)).toBe(true);
    expect(f[0]).toHaveLength(5);
  });
  it('fades only the mastered lines and stays within 0..1', () => {
    const ls = poem.lines.map(() => emptyLineMastery());
    ls[0] = mastered({ tangleCleared: true });
    const f = fadeLevels(poem, allKnown(), progressOf(ls));
    expect(f[0]!.every((x) => x === 1)).toBe(true);
    expect(f[1]!.every((x) => x === 0)).toBe(true);
    const mid = fadeLevels(poem, allKnown(), progressOf(ls.map(() => mastered({ meaning: 0.5 }))));
    expect(mid.flat().every((x) => x > 0 && x < 1)).toBe(true);
  });
  it('a char that is not recognised stays visible even on a mastered line', () => {
    const lex = setStatus(allKnown(), '光', { status: 'learning', level: 1 }, now);
    const f = fadeLevels(poem, lex, progressOf(poem.lines.map(() => mastered({ tangleCleared: true }))));
    expect(f[0]![4]).toBeLessThan(1);
    expect(f[0]![0]).toBe(1);
  });
});

describe('initial progress', () => {
  it('has one empty line mastery per poem line', () => {
    const p = initialProgress(poem, NOW);
    expect(p.poemId).toBe(poem.id);
    expect(p.lines).toHaveLength(n);
    expect(p.seals).toEqual([]);
    expect(p.startedAt).toBe(NOW);
    expect(allUnitIds().length).toBeGreaterThan(0);
  });
});
