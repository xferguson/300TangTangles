/**
 * Lexicon persistence (IndexedDB via idb-keyval) and versioned export/import JSON.
 * Uses IndexedDB only through idb-keyval; no React and no direct DOM access.
 */
import { get, set } from 'idb-keyval';
import { z } from 'zod';

import { lexiconEntrySchema, type Lexicon } from '../core';

const STORAGE_KEY = 'lexicon';

/** Bump when the export shape changes; `importLexicon` rejects versions it does not know. */
export const EXPORT_VERSION = 1;

const exportSchema = z.strictObject({
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.iso.datetime(),
  entries: z.array(lexiconEntrySchema),
});

function indexEntries(entries: readonly unknown[]): Lexicon {
  const lex: Lexicon = {};
  for (const raw of entries) {
    const parsed = lexiconEntrySchema.safeParse(raw);
    if (parsed.success) lex[parsed.data.unit] = parsed.data;
  }
  return lex;
}

/** Load the saved lexicon; entries that fail validation are dropped. */
export async function loadLexicon(): Promise<Lexicon> {
  const stored = await get<Record<string, unknown>>(STORAGE_KEY);
  if (!stored || typeof stored !== 'object') return {};
  return indexEntries(Object.values(stored));
}

export async function saveLexicon(lex: Lexicon): Promise<void> {
  await set(STORAGE_KEY, lex);
}

export function exportLexicon(lex: Lexicon, now: Date): string {
  const entries = Object.values(lex).sort((a, b) => a.unit.localeCompare(b.unit));
  return JSON.stringify(
    { version: EXPORT_VERSION, exportedAt: now.toISOString(), entries },
    null,
    2,
  );
}

export type ImportResult = { ok: true; lexicon: Lexicon } | { ok: false; error: string };

/** Parse and validate an export file. All-or-nothing: any problem rejects the whole import. */
export function importLexicon(text: string): ImportResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }
  const parsed = exportSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join('.') ?? '';
    return {
      ok: false,
      error: `Invalid lexicon file at "${path}": ${issue?.message ?? 'unknown'}`,
    };
  }
  const lexicon: Lexicon = {};
  for (const entry of parsed.data.entries) {
    if (lexicon[entry.unit]) {
      return { ok: false, error: `Invalid lexicon file: duplicate entries for "${entry.unit}".` };
    }
    lexicon[entry.unit] = entry;
  }
  return { ok: true, lexicon };
}

/** Union of two lexicons; for a unit in both, the more recently updated entry wins. */
export function mergeLexicons(a: Lexicon, b: Lexicon): Lexicon {
  const out: Lexicon = { ...a };
  for (const entry of Object.values(b)) {
    const mine = out[entry.unit];
    if (!mine || entry.updatedAt > mine.updatedAt) out[entry.unit] = entry;
  }
  return out;
}
