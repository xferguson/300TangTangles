import { describe, expect, it } from 'vitest';
import { parsePoem } from '../../core/poem';
import type { Lexicon } from '../../core';
import jingyesi from '../../../content/poems/jingyesi.json';
import { buildLibrary, tierLabel, type Catalog } from './library';

const poem = parsePoem(jingyesi);

const entry = (title: string, id: string, status: 'available' | 'coming-soon', fam: number) => ({
  id,
  title: { trad: title, simp: title },
  poet: { trad: '詩人', simp: '诗人' },
  form: 'wujue' as const,
  status,
  charCount: 20,
  familiarity: fam,
  inkDrops: 2,
});

const catalog: Catalog = {
  tiers: [
    {
      tier: 'wujue',
      poems: [
        entry('甲', 'a', 'coming-soon', 0.9),
        entry('靜夜思', 'jingyesi', 'available', 0.4),
        entry('乙', 'b', 'coming-soon', 0.5),
      ],
    },
    { tier: 'qijue', poems: [entry('丙', 'c', 'coming-soon', 0.2)] },
    { tier: 'wulu', poems: [] },
  ],
};

const known = (unit: string): Lexicon[string] => ({
  unit,
  status: 'known',
  level: null,
  fsrs: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('buildLibrary', () => {
  it('keeps catalog tier order and drops empty tiers', () => {
    const tiers = buildLibrary(catalog, [poem], {});
    expect(tiers.map((t) => t.tier)).toEqual(['wujue', 'qijue']);
  });

  it('puts playable poems first, then sorts by familiarity descending', () => {
    const [wujue] = buildLibrary(catalog, [poem], {});
    expect(wujue?.poems.map((p) => p.id)).toEqual(['jingyesi', 'a', 'b']);
  });

  it('counts distinct known characters for a playable poem', () => {
    const lex: Lexicon = { 月: known('月'), 明: known('明'), 山: known('山') };
    const [wujue] = buildLibrary(catalog, [poem], lex);
    const card = wujue?.poems[0];
    // 月 and 明 repeat in the poem but count once; 山 is not in it.
    expect(card?.known).toBe(2);
    expect(card?.total).toBe(17);
  });

  it('ignores learning and new units when counting known', () => {
    const lex: Lexicon = {
      月: { ...known('月'), status: 'learning', level: 2 },
    };
    const [wujue] = buildLibrary(catalog, [poem], lex);
    expect(wujue?.poems[0]?.known).toBe(0);
  });

  it('gives coming-soon cards no known count', () => {
    const [wujue] = buildLibrary(catalog, [poem], {});
    expect(wujue?.poems[1]?.known).toBeNull();
    expect(wujue?.poems[1]?.total).toBeNull();
  });

  it('treats an available catalog entry with no poem file as coming soon', () => {
    const [wujue] = buildLibrary(catalog, [], {});
    expect(wujue?.poems.every((p) => p.status === 'coming-soon')).toBe(true);
  });
});

describe('tierLabel', () => {
  it('names the length tiers', () => {
    expect(tierLabel('wujue')).toBe('五絕');
    expect(tierLabel('qilu')).toBe('七律');
  });
});
