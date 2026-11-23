import { readingFor, readingSystemFor } from '../core';
import type { Poem, ReadingSystem, Settings } from '../core';

/** Convert a Traditional string to the displayed script, using the poem's own Trad/Simp pairs. */
export function toScript(text: string, poem: Poem, settings: Settings): string {
  if (settings.script === 'trad') return text;
  const map = new Map<string, string>();
  for (const line of poem.lines) for (const c of line.chars) map.set(c.trad, c.simp);
  for (const u of poem.units) if (u.kind === 'char') map.set(u.id, u.simp);
  return [...text].map((ch) => map.get(ch) ?? ch).join('');
}

/** Reading system to hand to `RubyChar`. */
export function rubyMode(settings: Settings): ReadingSystem {
  return readingSystemFor(settings);
}

export interface DisplayChar {
  char: string;
  reading: string | undefined;
}

/**
 * Characters of `text` ready to render: script-converted, each with its reading per settings.
 * When `line` is given and `text` is exactly that line, the line's own readings are used.
 */
export function displayChars(
  text: string,
  poem: Poem,
  settings: Settings,
  line?: number,
): DisplayChar[] {
  const chars = [...text];
  const poemLine = line === undefined ? undefined : poem.lines[line];
  const exact = poemLine && poemLine.chars.map((c) => c.trad).join('') === text;

  return chars.map((ch, i) => {
    const pc = exact
      ? poemLine.chars[i]
      : poem.lines.flatMap((l) => l.chars).find((c) => c.trad === ch);
    return {
      char: settings.script === 'simp' ? (pc?.simp ?? toScript(ch, poem, settings)) : ch,
      reading: pc ? readingFor(pc.readings, settings) : undefined,
    };
  });
}
