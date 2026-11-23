import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/ui/AppNav/AppNav.css', 'utf8');
const rule = css.split('}').find((r) => r.split('{')[0]?.trim() === '.app-nav') ?? '';

describe('AppNav stays anchored while scrolling', () => {
  it('is sticky to the top', () => {
    expect(rule).toMatch(/position:\s*sticky/);
    expect(rule).toMatch(/top:\s*0/);
  });
  it('has an opaque background and sits above the page content', () => {
    expect(rule).toMatch(/background:\s*var\(--paper\)/);
    expect(rule).toMatch(/z-index:\s*\d+/);
  });
});
