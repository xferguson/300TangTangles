/**
 * Poem content contract. Every file in `content/poems/*.json` must parse with `poemSchema`.
 * Pure data + validation: no React, no DOM, no Node APIs.
 *
 * This is a contract (see CLAUDE.md): change it only in a dedicated small PR.
 */
import { z } from 'zod';

/** Exactly one Han character (one Unicode code point). */
const hanChar = z.string().refine((s) => [...s].length === 1, 'must be exactly one character');
const text = z.string().min(1);

/** Traditional / Simplified pair for any displayed text. */
export const scriptPairSchema = z.strictObject({ trad: text, simp: text });

/**
 * Readings for one character in the *modern* pronunciation of each language.
 * Tâi-lô has two layers: `lit` 文讀 (literary; how poems are recited) and `col` 白讀 (everyday).
 * They may be equal when a character has only one reading.
 */
export const readingsSchema = z.strictObject({
  zhuyin: text,
  pinyin: text,
  jyutping: text,
  tailo: z.strictObject({ lit: text, col: text }),
});

export const charSchema = z.strictObject({
  trad: hanChar,
  simp: hanChar,
  readings: readingsSchema,
});

export const lineSchema = z.strictObject({
  /** The characters of the line, without punctuation. */
  chars: z.array(charSchema).min(1),
  /** Punctuation that follows the line when displayed, e.g. `，` or `。`. */
  punct: z.string().default(''),
  /** One-line gloss shown under the line. */
  gloss: text,
  literal: text,
  poetic: text,
  /** Material for "what is the poet feeling?" meaning checks. */
  meaning: z.strictObject({
    feeling: text,
    wrongFeelings: z.array(text).min(2),
  }),
});

export const occurrenceSchema = z.strictObject({
  line: z.number().int().min(0),
  start: z.number().int().min(0),
});

/**
 * A learnable vocabulary unit. `id` is the Traditional text (a single char, or a compound of
 * several) and is the key used by the global lexicon, so it is shared across poems.
 */
export const unitSchema = z.strictObject({
  id: text,
  simp: text,
  kind: z.enum(['char', 'compound']),
  gloss: text,
  occurrences: z.array(occurrenceSchema).min(1),
});

export const noteSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  kind: z.enum(['interpretation', 'text-variant', 'rhyme', 'tone', 'history', 'other']),
  title: text,
  body: text,
});

/** Look-alike / sound-alike / meaning-alike characters used to build distractors (T33). */
export const distractorSeedSchema = z.strictObject({
  look: z.array(hanChar).default([]),
  sound: z.array(hanChar).default([]),
  meaning: z.array(hanChar).default([]),
});

export const poemFormSchema = z.enum(['wujue', 'qijue', 'wulu', 'qilu', 'gufeng', 'yuefu']);

/** [number of lines, characters per line] for fixed forms; `null` means free. */
const FORM_SHAPE: Record<z.infer<typeof poemFormSchema>, [number, number] | null> = {
  wujue: [4, 5],
  qijue: [4, 7],
  wulu: [8, 5],
  qilu: [8, 7],
  gufeng: null,
  yuefu: null,
};

export const poemSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    /** Lowercase slug, also the content file name. */
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    title: scriptPairSchema,
    poet: z.strictObject({ trad: text, simp: text, pinyin: text }),
    dynasty: z.enum(['tang', 'other']),
    form: poemFormSchema,
    lines: z.array(lineSchema).min(1),
    units: z.array(unitSchema).min(1),
    translation: z.strictObject({ literal: text, poetic: text }),
    notes: z.array(noteSchema).default([]),
    /** Keyed by Traditional character. */
    distractorSeeds: z.record(hanChar, distractorSeedSchema).default({}),
    meta: z.strictObject({
      curriculum: z
        .array(z.strictObject({ region: z.enum(['prc', 'tw', 'hk']), grade: text.optional() }))
        .default([]),
      /** Computed by the catalog scoring script (T11); absent in hand-written content. */
      familiarity: z.number().min(0).max(1).optional(),
      /** Scene id for the poem's illustrated backdrop. */
      scene: text.optional(),
    }),
  })
  .superRefine((poem, ctx) => {
    const issue = (message: string, path: (string | number)[] = []) =>
      ctx.addIssue({ code: 'custom', message, path });

    // Form must match line shape.
    const shape = FORM_SHAPE[poem.form];
    if (shape) {
      const [lineCount, perLine] = shape;
      if (poem.lines.length !== lineCount) {
        issue(`form ${poem.form} needs ${lineCount} lines, got ${poem.lines.length}`, ['lines']);
      }
      poem.lines.forEach((l, i) => {
        if (l.chars.length !== perLine) {
          issue(
            `form ${poem.form} needs ${perLine} chars per line, line ${i} has ${l.chars.length}`,
            ['lines', i, 'chars'],
          );
        }
      });
    }

    // Units: unique ids, occurrences must match the text.
    const seen = new Set<string>();
    poem.units.forEach((u, ui) => {
      if (seen.has(u.id)) issue(`duplicate unit id ${u.id}`, ['units', ui, 'id']);
      seen.add(u.id);

      const len = [...u.id].length;
      if (u.kind === 'char' && len !== 1)
        issue('char unit must be one character', ['units', ui, 'kind']);
      if (u.kind === 'compound' && len < 2)
        issue('compound unit needs two or more characters', ['units', ui, 'kind']);

      u.occurrences.forEach((o, oi) => {
        const line = poem.lines[o.line];
        const slice = line?.chars.slice(o.start, o.start + len);
        const path = ['units', ui, 'occurrences', oi];
        if (!line || !slice || slice.length !== len) {
          issue(`occurrence of ${u.id} is outside the line`, path);
          return;
        }
        if (slice.map((c) => c.trad).join('') !== u.id)
          issue(`text at occurrence does not match unit ${u.id}`, path);
        if (slice.map((c) => c.simp).join('') !== u.simp)
          issue(`simplified text at occurrence does not match unit ${u.id}`, path);
      });
    });

    // Every distinct character needs a char unit that lists *all* of its positions.
    const positions = new Map<string, string[]>();
    poem.lines.forEach((l, li) =>
      l.chars.forEach((c, ci) =>
        positions.set(c.trad, [...(positions.get(c.trad) ?? []), `${li}:${ci}`]),
      ),
    );
    for (const [ch, where] of positions) {
      const unit = poem.units.find((u) => u.id === ch && u.kind === 'char');
      if (!unit) {
        issue(`no char unit for ${ch}`, ['units']);
        continue;
      }
      const listed = new Set(unit.occurrences.map((o) => `${o.line}:${o.start}`));
      if (where.some((w) => !listed.has(w)))
        issue(`char unit ${ch} must list every occurrence`, ['units']);
    }

    // Distractor seeds: single chars, never equal to the key.
    for (const [key, seed] of Object.entries(poem.distractorSeeds)) {
      for (const kind of ['look', 'sound', 'meaning'] as const) {
        if (seed[kind].includes(key))
          issue(`distractor seed for ${key} lists itself`, ['distractorSeeds', key, kind]);
      }
    }
  });

export type Poem = z.infer<typeof poemSchema>;
export type PoemLine = Poem['lines'][number];
export type PoemChar = PoemLine['chars'][number];
export type PoemUnit = Poem['units'][number];
export type Readings = z.infer<typeof readingsSchema>;
export type PoemForm = z.infer<typeof poemFormSchema>;
export type Script = 'trad' | 'simp';

/** Parse and validate; throws a `ZodError` listing every problem. */
export function parsePoem(data: unknown): Poem {
  return poemSchema.parse(data);
}

export function safeParsePoem(data: unknown) {
  return poemSchema.safeParse(data);
}

/** A line's text in the chosen script, optionally with its trailing punctuation. */
export function lineText(line: PoemLine, script: Script, opts: { punct?: boolean } = {}): string {
  const body = line.chars.map((c) => c[script]).join('');
  return opts.punct ? body + line.punct : body;
}

/** Total characters in the poem, excluding punctuation. */
export function poemCharCount(poem: Poem): number {
  return poem.lines.reduce((n, l) => n + l.chars.length, 0);
}
