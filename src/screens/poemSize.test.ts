import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Pulls the `font-size` declared on a selector's rule, or undefined. */
function fontSize(file: string, selector: string): string | undefined {
  const css = readFileSync(new URL(file, import.meta.url), 'utf8');
  const rule = css.split('}').find((r) => r.split('{')[0]?.trim() === selector);
  return rule?.match(/font-size:\s*([^;]+);/)?.[1]?.trim();
}

describe('poem text is large enough to read', () => {
  it('session scroll sets a poem-sized font', () => {
    expect(fontSize('./session/SessionScreen.css', '.ss-scroll')).toMatch(/clamp\(|rem/);
  });
  it('reading screen lines set a poem-sized font', () => {
    expect(fontSize('./reading/ReadingScreen.css', '.rd-chars')).toMatch(/clamp\(|rem/);
  });
});
