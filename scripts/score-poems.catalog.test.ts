import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assignTier,
  buildCatalog,
  generateCatalog,
  inkDrops,
  type CatalogSource,
  type CurriculumData,
  type FrequencyData,
} from './score-poems';

describe('assignTier', () => {
  it('maps fixed forms to their length tier', () => {
    expect(assignTier('wujue')).toBe('wujue');
    expect(assignTier('qijue')).toBe('qijue');
    expect(assignTier('wulu')).toBe('wulu');
    expect(assignTier('qilu')).toBe('qilu');
  });

  it('puts free forms in the ancient-style tier', () => {
    expect(assignTier('gufeng')).toBe('ancient');
    expect(assignTier('yuefu')).toBe('ancient');
  });
});

describe('inkDrops', () => {
  it('gives 1 drop to the most familiar poems and 5 to the least', () => {
    expect(inkDrops(1)).toBe(1);
    expect(inkDrops(0)).toBe(5);
  });

  it('steps through 1-5 as familiarity falls, in fifths', () => {
    expect(inkDrops(0.9)).toBe(1);
    expect(inkDrops(0.75)).toBe(2);
    expect(inkDrops(0.5)).toBe(3);
    expect(inkDrops(0.3)).toBe(4);
    expect(inkDrops(0.1)).toBe(5);
  });

  it('is monotone non-increasing in familiarity', () => {
    let prev = 5;
    for (let f = 0; f <= 1; f += 0.01) {
      const d = inkDrops(f);
      expect(d).toBeLessThanOrEqual(prev);
      prev = d;
    }
  });
});

describe('buildCatalog', () => {
  const freq: FrequencyData = { listSize: 100, ranks: { 一: 1, 二: 2, 三: 3, 四: 50 } };
  const cur: CurriculumData = { entries: { easy: [{ region: 'prc', grade: 1 }] } };
  const base = { title: { trad: 't', simp: 't' }, poet: { trad: 'p', simp: 'p' } };
  const src: CatalogSource = {
    entries: [
      { id: 'hard', ...base, form: 'wujue', status: 'coming-soon', text: '四'.repeat(20) },
      { id: 'easy', ...base, form: 'wujue', status: 'available', text: '一二三一二'.repeat(4) },
      {
        id: 'seven',
        ...base,
        form: 'qijue',
        status: 'coming-soon',
        text: '一二三一二三一'.repeat(4),
      },
    ],
  };

  it('groups by tier in fixed order and sorts each tier by familiarity, high first', () => {
    const index = buildCatalog(src, freq, cur);
    expect(index.tiers.map((t) => t.tier)).toEqual(['wujue', 'qijue']);
    expect(index.tiers[0]!.poems.map((p) => p.id)).toEqual(['easy', 'hard']);
  });

  it('records char count, status, familiarity and ink drops', () => {
    const [easy, hard] = buildCatalog(src, freq, cur).tiers[0]!.poems;
    expect(easy).toMatchObject({ charCount: 20, status: 'available' });
    expect(easy!.familiarity).toBeGreaterThan(hard!.familiarity);
    expect(hard!.inkDrops).toBeGreaterThan(easy!.inkDrops);
  });

  it('rejects duplicate ids and a form/char-count mismatch', () => {
    const dup = { entries: [src.entries[0]!, src.entries[0]!] };
    expect(() => buildCatalog(dup, freq, cur)).toThrow(/duplicate/);
    const bad = { entries: [{ ...src.entries[0]!, text: '一二三' }] };
    expect(() => buildCatalog(bad, freq, cur)).toThrow(/characters/);
  });
});

describe('committed catalog data', () => {
  const dir = join(process.cwd(), 'content/catalog') + '/';
  const index = generateCatalog(dir);

  it('marks a poem available exactly when its content file exists', () => {
    const files = new Set(
      readdirSync(join(process.cwd(), 'content/poems'))
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace(/\.json$/, '')),
    );
    const all = index.tiers.flatMap((t) => t.poems);
    expect(all.some((p) => p.id === 'jingyesi' && p.status === 'available')).toBe(true);
    for (const p of all) expect(files.has(p.id), p.id).toBe(p.status === 'available');
    expect(all.length).toBeGreaterThanOrEqual(files.size);
  });

  it('keeps content/catalog/index.json in sync with the generator', () => {
    const committed: unknown = JSON.parse(readFileSync(`${dir}index.json`, 'utf8'));
    expect(committed).toEqual(index);
  });

  it('records provenance for every source data file', () => {
    for (const f of ['char-frequency.json', 'curriculum.json', 'entries.json']) {
      const data = JSON.parse(readFileSync(`${dir}${f}`, 'utf8')) as {
        provenance?: { source?: string; status?: string; notes?: string };
      };
      expect(data.provenance?.source, f).toBeTruthy();
      expect(data.provenance?.status, f).toMatch(/^(seed|verified)$/);
    }
  });
});
