/** Shared helpers for engine tests (not exported from the engine's public API). */
import { fixturePoemData } from '../core/fixtures/poem.fixture';
import { parsePoem, type Poem } from '../core/poem';
import {
  DEFAULT_SETTINGS,
  emptyLineMastery,
  type EngineState,
  type LineMastery,
  type Lexicon,
  type PoemProgress,
  type UnitId,
} from '../core/types';
import { markKnown } from '../lexicon/lexicon';

export const poem: Poem = parsePoem(fixturePoemData);
export const NOW = '2026-03-01T08:00:00.000Z';

export const allUnitIds = (p: Poem = poem): UnitId[] => p.units.map((u) => u.id);

export const mastered = (over: Partial<LineMastery> = {}): LineMastery => ({
  recognition: 1,
  production: 1,
  meaning: 1,
  recitation: 1,
  scaffoldStep: 5,
  tangleCleared: false,
  ...over,
});

export function progressOf(lines: LineMastery[], seals: PoemProgress['seals'] = []): PoemProgress {
  return { poemId: poem.id, lines, seals, startedAt: NOW, updatedAt: NOW };
}

export const freshProgress = (): PoemProgress =>
  progressOf(poem.lines.map(() => emptyLineMastery()));

export const allKnown = (): Lexicon => markKnown({}, allUnitIds(), new Date(NOW));

export function stateOf(over: Partial<EngineState> = {}): EngineState {
  return {
    poem,
    lexicon: {},
    progress: freshProgress(),
    settings: DEFAULT_SETTINGS,
    now: NOW,
    seed: 1,
    history: [],
    ...over,
  };
}
