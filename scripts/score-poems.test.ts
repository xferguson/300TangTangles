import { describe, expect, it } from 'vitest';

import {
  curriculumExposure,
  frequencyScore,
  scoreFamiliarity,
  shortnessScore,
  WEIGHTS,
  type CurriculumData,
  type FrequencyData,
} from './score-poems';

const freq: FrequencyData = {
  listSize: 3000,
  ranks: { 床: 1, 月: 10, 霜: 1500, 鄉: 3000 },
};

describe('frequencyScore', () => {
  it('maps rank 1 to 1 and the list tail to 0 on a log scale', () => {
    expect(frequencyScore('床', freq)).toBeCloseTo(1);
    expect(frequencyScore('鄉', freq)).toBeCloseTo(0);
    expect(frequencyScore('月', freq)).toBeGreaterThan(frequencyScore('霜', freq));
  });

  it('scores characters missing from the list as 0', () => {
    expect(frequencyScore('龘', freq)).toBe(0);
  });
});

describe('shortnessScore', () => {
  it('is 1 at 20 chars and falls linearly to 0 at 80 chars, clamped', () => {
    expect(shortnessScore(20)).toBe(1);
    expect(shortnessScore(50)).toBeCloseTo(0.5);
    expect(shortnessScore(80)).toBe(0);
    expect(shortnessScore(200)).toBe(0);
    expect(shortnessScore(10)).toBe(1);
  });
});

describe('curriculumExposure', () => {
  const cur: CurriculumData = {
    entries: {
      a: [{ region: 'prc', grade: 1 }],
      b: [
        { region: 'prc', grade: 7 },
        { region: 'tw', grade: 7 },
        { region: 'hk', grade: 7 },
      ],
      c: [
        { region: 'prc', grade: 1 },
        { region: 'tw', grade: 1 },
        { region: 'hk', grade: 1 },
      ],
    },
  };

  it('is 0 for poems on no list', () => {
    expect(curriculumExposure('zzz', cur)).toBe(0);
  });

  it('weights earlier grades higher', () => {
    expect(curriculumExposure('c', cur)).toBeCloseTo(1);
    expect(curriculumExposure('b', cur)).toBeLessThan(curriculumExposure('c', cur));
  });

  it('rewards appearing on more regional lists', () => {
    expect(curriculumExposure('c', cur)).toBeGreaterThan(curriculumExposure('a', cur));
    expect(curriculumExposure('a', cur)).toBeCloseTo(1 / 3);
  });
});

describe('scoreFamiliarity', () => {
  it('combines the three components with the documented weights', () => {
    expect(WEIGHTS.curriculum + WEIGHTS.frequency + WEIGHTS.shortness).toBeCloseTo(1);
    const cur: CurriculumData = { entries: { p: [{ region: 'prc', grade: 1 }] } };
    const f = scoreFamiliarity({ id: 'p', text: '床床月月' }, freq, cur);
    expect(f.curriculum).toBeCloseTo(1 / 3);
    expect(f.shortness).toBe(1);
    expect(f.frequencyMean).toBeGreaterThan(f.frequencyP25 - 1e-9);
    const expected =
      WEIGHTS.curriculum * f.curriculum +
      WEIGHTS.frequency * f.frequency +
      WEIGHTS.shortness * f.shortness;
    expect(f.familiarity).toBeCloseTo(expected);
  });

  it('lets one rare character drag the poem down via the 25th percentile', () => {
    const cur: CurriculumData = { entries: {} };
    const allCommon = scoreFamiliarity({ id: 'x', text: '床床床床' }, freq, cur);
    const oneRare = scoreFamiliarity({ id: 'x', text: '床床床鄉' }, freq, cur);
    expect(oneRare.frequencyP25).toBeLessThan(allCommon.frequencyP25);
    expect(oneRare.familiarity).toBeLessThan(allCommon.familiarity);
  });
});
