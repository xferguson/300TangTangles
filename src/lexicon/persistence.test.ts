import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';
import { clear } from 'idb-keyval';

import { emptyLexicon, markKnown, reviewUnit, setStatus } from './lexicon';
import {
  EXPORT_VERSION,
  exportLexicon,
  importLexicon,
  loadLexicon,
  mergeLexicons,
  saveLexicon,
} from './persistence';

const T0 = new Date('2026-01-01T00:00:00.000Z');
const day = (n: number) => new Date(T0.getTime() + n * 86_400_000);

function sample() {
  let lex = reviewUnit(emptyLexicon(), '月', 'good', T0);
  lex = markKnown(lex, ['光'], T0);
  lex = setStatus(lex, '之', { status: 'ignored' }, T0);
  return lex;
}

describe('IndexedDB persistence', () => {
  beforeEach(async () => {
    await clear();
  });

  it('loads an empty lexicon when nothing is saved', async () => {
    expect(await loadLexicon()).toEqual({});
  });

  it('round-trips a lexicon through IndexedDB', async () => {
    const lex = sample();
    await saveLexicon(lex);
    expect(await loadLexicon()).toEqual(lex);
  });

  it('drops invalid stored entries instead of crashing', async () => {
    const { set } = await import('idb-keyval');
    await set('lexicon', { 月: { unit: '月', status: 'learning', level: null } });
    expect(await loadLexicon()).toEqual({});
  });
});

describe('export / import', () => {
  it('exports versioned JSON that imports back identically', () => {
    const lex = sample();
    const json = exportLexicon(lex, day(1));
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(EXPORT_VERSION);
    expect(parsed.exportedAt).toBe(day(1).toISOString());
    expect(importLexicon(json)).toEqual({ ok: true, lexicon: lex });
  });

  it('rejects text that is not JSON', () => {
    const r = importLexicon('not json');
    expect(r.ok).toBe(false);
  });

  it('rejects an unknown version', () => {
    const r = importLexicon(JSON.stringify({ version: 99, entries: [] }));
    expect(r).toMatchObject({ ok: false });
  });

  it('rejects malformed entries and reports which one', () => {
    const bad = {
      version: EXPORT_VERSION,
      exportedAt: T0.toISOString(),
      entries: [{ unit: '月' }],
    };
    const r = importLexicon(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/entries/);
  });

  it('rejects duplicate units', () => {
    const lex = sample();
    const entry = lex['月']!;
    const dup = { version: EXPORT_VERSION, exportedAt: T0.toISOString(), entries: [entry, entry] };
    const r = importLexicon(JSON.stringify(dup));
    expect(r.ok).toBe(false);
  });
});

describe('mergeLexicons', () => {
  it('keeps the most recently updated entry per unit and the union of units', () => {
    const a = reviewUnit(emptyLexicon(), '月', 'good', T0);
    const b = setStatus(emptyLexicon(), '月', { status: 'known' }, day(1));
    const c = markKnown(emptyLexicon(), ['光'], T0);
    const merged = mergeLexicons(mergeLexicons(a, b), c);
    expect(merged['月']!.status).toBe('known');
    expect(merged['光']!.status).toBe('known');
    expect(mergeLexicons(b, a)['月']!.status).toBe('known');
  });
});
