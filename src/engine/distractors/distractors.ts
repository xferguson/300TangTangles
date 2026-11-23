/**
 * Distractor generator (T33). Picks wrong tiles/choices for the line builder, cloze and other
 * exercises. Pure and deterministic: the same inputs and seed always give the same output.
 *
 * Sources, from most to least confusable:
 * - content seeds on the line's characters (`distractorSeeds`: look-, sound- and meaning-alikes),
 * - other characters of the same poem,
 * - characters of other poems.
 *
 * Never returns a character that is valid in the position: the whole line for a bank
 * (no `index`), or the one answer character for a single blank (`index`).
 */
import type { Poem } from '../../core/poem';

export type DistractorDifficulty = 'easy' | 'medium' | 'hard';

export interface DistractorOptions {
  poem: Poem;
  line: number;
  /** How many distractors to return (fewer if the sources run out). */
  count: number;
  difficulty: DistractorDifficulty;
  seed: number;
  /** Position within the line (cloze). Omit for a whole-line bank. */
  index?: number;
  /** Other poems whose characters may be used as unrelated distractors. */
  otherPoems?: readonly Poem[];
}

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const uniq = <T>(items: readonly T[]): T[] => [...new Set(items)];

export function generateDistractors(opts: DistractorOptions): string[] {
  const { poem, line, count, difficulty, seed, index, otherPoems = [] } = opts;
  const target = poem.lines[line];
  if (!target) throw new Error(`poem ${poem.id} has no line ${line}`);
  if (index !== undefined && (index < 0 || index >= target.chars.length)) {
    throw new Error(`line ${line} has no position ${index}`);
  }
  if (count <= 0) return [];

  const rand = rng(seed);
  const lineChars = target.chars.map((c) => c.trad);
  const valid = new Set(index === undefined ? lineChars : [lineChars[index]!]);

  // Seeds belong to the characters that are being tested.
  const seedOwners = index === undefined ? lineChars : [lineChars[index]!];
  const seedsOf = (kind: 'look' | 'sound' | 'meaning') =>
    shuffled(uniq(seedOwners.flatMap((c) => poem.distractorSeeds[c]?.[kind] ?? [])), rand);
  const look = seedsOf('look');
  const sound = seedsOf('sound');
  const meaning = seedsOf('meaning');

  const poemChars = new Set(poem.lines.flatMap((l) => l.chars.map((c) => c.trad)));
  const samePoem = shuffled(
    [...poemChars].filter((c) => !valid.has(c)),
    rand,
  );
  const foreign = shuffled(
    uniq(otherPoems.flatMap((p) => p.lines.flatMap((l) => l.chars.map((c) => c.trad)))).filter(
      (c) => !poemChars.has(c),
    ),
    rand,
  );

  const interleave = (...lists: string[][]): string[] => {
    const out: string[] = [];
    for (let i = 0; i < Math.max(...lists.map((l) => l.length)); i++) {
      for (const l of lists) if (i < l.length) out.push(l[i]!);
    }
    return out;
  };

  let ranked: string[];
  switch (difficulty) {
    case 'easy': // unrelated characters first; confusable ones only to fill up
      ranked = [...foreign, ...samePoem, ...meaning, ...sound, ...look];
      break;
    case 'medium': // one of each kind in turn, then unrelated
      ranked = [...interleave(look, sound, meaning), ...interleave(samePoem, foreign)];
      break;
    case 'hard': // all look-alikes, then sound-alikes, then meaning-alikes
      ranked = [...look, ...sound, ...meaning, ...samePoem, ...foreign];
      break;
  }

  return uniq(ranked)
    .filter((c) => !valid.has(c))
    .slice(0, count);
}
