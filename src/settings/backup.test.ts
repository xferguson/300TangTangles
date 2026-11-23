import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core';
import { emptyLexicon, reviewUnit } from '../lexicon/lexicon';
import { exportLexicon } from '../lexicon/persistence';
import { createBackup, parseBackup } from './backup';

const now = new Date('2026-01-01T00:00:00.000Z');
const lex = reviewUnit(emptyLexicon(), '月', 'good', now);
const settings = { ...DEFAULT_SETTINGS, script: 'simp' as const };

describe('backup', () => {
  it('round-trips settings and lexicon', () => {
    const r = parseBackup(createBackup(settings, lex, now));
    expect(r).toEqual({ ok: true, settings, lexicon: lex });
  });

  it('accepts a plain lexicon export (settings stay unchanged)', () => {
    const r = parseBackup(exportLexicon(lex, now));
    expect(r).toEqual({ ok: true, settings: undefined, lexicon: lex });
  });

  it('rejects non-JSON', () => {
    expect(parseBackup('hello')).toEqual({ ok: false, error: 'File is not valid JSON.' });
  });

  it('rejects invalid settings', () => {
    const bad = JSON.parse(createBackup(settings, lex, now));
    bad.settings.script = 'klingon';
    const r = parseBackup(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/settings/i);
  });

  it('rejects a bad lexicon and unknown files', () => {
    const bad = JSON.parse(createBackup(settings, lex, now));
    bad.lexicon.version = 99;
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false);
    expect(parseBackup('{"foo":1}').ok).toBe(false);
  });
});
