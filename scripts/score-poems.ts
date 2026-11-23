// Catalog scoring (T11): familiarity, tiers and ink drops. See docs/PLAN.md section 2.
// Pure functions are exported for tests; the CLI at the bottom generates content/catalog/index.json.

export type Region = 'prc' | 'tw' | 'hk';

export interface FrequencyData {
  /** Size of the ranked list the ranks refer to. A character at this rank scores 0. */
  listSize: number;
  /** Traditional character -> frequency rank (1 = most frequent). */
  ranks: Record<string, number>;
}

export interface CurriculumEntry {
  region: Region;
  /** School grade, 1 (first year of primary) to 12. Earlier grades score higher. */
  grade: number;
}

export interface CurriculumData {
  /** Poem id -> required-list appearances. */
  entries: Record<string, CurriculumEntry[]>;
}

/** w1, w2, w3 of the familiarity formula. They sum to 1. */
export const WEIGHTS = { curriculum: 0.5, frequency: 0.35, shortness: 0.15 } as const;

const REGIONS: readonly Region[] = ['prc', 'tw', 'hk'];
const MAX_GRADE = 12;
const SHORTEST = 20;
const LONGEST = 80;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Log-scaled frequency in [0, 1]: rank 1 -> 1, rank >= listSize or unknown -> 0. */
export function frequencyScore(char: string, data: FrequencyData): number {
  const rank = data.ranks[char];
  if (rank === undefined || data.listSize <= 1) return 0;
  return clamp01(1 - Math.log(rank) / Math.log(data.listSize));
}

/** 1 for a 20-char poem, falling linearly to 0 at 80 chars. */
export function shortnessScore(charCount: number): number {
  return clamp01(1 - (charCount - SHORTEST) / (LONGEST - SHORTEST));
}

/**
 * Average over the three regional lists of that list's grade weight
 * (grade 1 -> 1, grade 12 -> 1/12). A region where the poem is absent contributes 0.
 */
export function curriculumExposure(poemId: string, data: CurriculumData): number {
  const entries = data.entries[poemId] ?? [];
  let total = 0;
  for (const region of REGIONS) {
    const grades = entries.filter((e) => e.region === region).map((e) => e.grade);
    if (grades.length === 0) continue;
    const earliest = Math.min(...grades);
    total += clamp01((MAX_GRADE + 1 - earliest) / MAX_GRADE);
  }
  return total / REGIONS.length;
}

/** Percentile with linear interpolation; `p` in [0, 1]. */
function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

export interface ScoreInput {
  id: string;
  /** All characters of the poem (Traditional); punctuation is ignored. */
  text: string;
}

export interface FamiliarityBreakdown {
  curriculum: number;
  frequencyMean: number;
  frequencyP25: number;
  /** Mean of `frequencyMean` and `frequencyP25`, so one rare character counts against a poem. */
  frequency: number;
  shortness: number;
  familiarity: number;
}

export function scoreFamiliarity(
  poem: ScoreInput,
  freq: FrequencyData,
  curriculum: CurriculumData,
): FamiliarityBreakdown {
  const chars = [...poem.text].filter((c) => /\p{Script=Han}/u.test(c));
  const scores = chars.map((c) => frequencyScore(c, freq));
  const frequencyMean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const frequencyP25 = percentile(scores, 0.25);
  const frequency = (frequencyMean + frequencyP25) / 2;
  const curriculumScore = curriculumExposure(poem.id, curriculum);
  const shortness = shortnessScore(chars.length);
  const familiarity =
    WEIGHTS.curriculum * curriculumScore +
    WEIGHTS.frequency * frequency +
    WEIGHTS.shortness * shortness;
  return {
    curriculum: curriculumScore,
    frequencyMean,
    frequencyP25,
    frequency,
    shortness,
    familiarity,
  };
}
