/** Pure library model: catalog + poem content + lexicon -> tiers of cards. No React / DOM. */
import { z } from 'zod';

import type { Lexicon } from '../../core';
import { poemFormSchema, scriptPairSchema, type Poem } from '../../core/poem';

export const catalogPoemSchema = z.object({
  id: z.string().min(1),
  title: scriptPairSchema,
  poet: scriptPairSchema,
  form: poemFormSchema,
  status: z.enum(['available', 'coming-soon']),
  charCount: z.number().int().positive(),
  /** 0-1, higher = more familiar (T11 scoring). */
  familiarity: z.number(),
  /** 1-5 ink drops of difficulty (T11 scoring). */
  inkDrops: z.number().int().min(1).max(5),
});
export type CatalogPoem = z.infer<typeof catalogPoemSchema>;

export const catalogSchema = z.object({
  tiers: z.array(z.object({ tier: poemFormSchema, poems: z.array(catalogPoemSchema) })),
});
export type Catalog = z.infer<typeof catalogSchema>;

export interface LibraryCard {
  id: string;
  title: { trad: string; simp: string };
  poet: { trad: string; simp: string };
  status: 'available' | 'coming-soon';
  inkDrops: number;
  familiarity: number;
  /** Distinct characters you know / distinct characters in the poem; null for coming-soon. */
  known: number | null;
  total: number | null;
}

export interface LibraryTier {
  tier: CatalogPoem['form'];
  label: string;
  poems: LibraryCard[];
}

const TIER_LABELS: Record<string, string> = {
  wujue: '五絕',
  qijue: '七絕',
  wulu: '五律',
  qilu: '七律',
  gufeng: '古風',
  yuefu: '樂府',
};

export function tierLabel(tier: string): string {
  return TIER_LABELS[tier] ?? tier;
}

function distinctChars(poem: Poem): string[] {
  return [...new Set(poem.lines.flatMap((l) => l.chars.map((c) => c.trad)))];
}

/** Tiers in catalog order (empty ones dropped); playable poems first, then most familiar first. */
export function buildLibrary(
  catalog: Catalog,
  poems: readonly Poem[],
  lexicon: Lexicon,
): LibraryTier[] {
  const byId = new Map(poems.map((p) => [p.id, p]));
  return catalog.tiers
    .map(({ tier, poems: entries }): LibraryTier => {
      const cards = entries.map((e): LibraryCard => {
        const poem = e.status === 'available' ? byId.get(e.id) : undefined;
        const chars = poem ? distinctChars(poem) : null;
        return {
          id: e.id,
          title: e.title,
          poet: e.poet,
          status: poem ? 'available' : 'coming-soon',
          inkDrops: e.inkDrops,
          familiarity: e.familiarity,
          known: chars ? chars.filter((c) => lexicon[c]?.status === 'known').length : null,
          total: chars ? chars.length : null,
        };
      });
      cards.sort(
        (a, b) =>
          Number(b.status === 'available') - Number(a.status === 'available') ||
          b.familiarity - a.familiarity,
      );
      return { tier, label: tierLabel(tier), poems: cards };
    })
    .filter((t) => t.poems.length > 0);
}
