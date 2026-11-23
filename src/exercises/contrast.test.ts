import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const tokensCss = read('../ui/theme/tokens.css');
const exerciseCss = read('./exercise.css');
const reciteCss = read('./recite/recite.css');
const lineBuilderCss = read('./line-builder/LineBuilder.css');

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** `over` drawn at `alpha` on top of `under`. */
function blend(over: Rgb, under: Rgb, alpha: number): Rgb {
  return over.map((v, i) => v * alpha + under[i]! * (1 - alpha)) as Rgb;
}

/** Token values declared in the first block whose selector matches `selector`. */
function tokens(selector: RegExp): Record<string, Rgb> {
  const out: Record<string, Rgb> = {};
  const blocks = [...tokensCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) =>
    selector.test(m[1]!),
  );
  for (const m of blocks) {
    for (const d of m[2]!.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) {
      out[d[1]!] ??= parseHex(d[2]!);
    }
  }
  return out;
}

const themes = {
  light: tokens(/^:root,\s*\.t-light\s*$/m),
  dark: tokens(/:root\[data-theme='dark'\]/),
};

/** The declarations of the rule for `selector` in `css`. */
function rule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no rule ${selector}`);
  return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
}

function colorOf(decls: string): string {
  return /(?:^|[\s;])color:\s*var\(--([\w-]+)\)/.exec(decls)![1]!;
}

function opacityOf(decls: string): number {
  return Number(/opacity:\s*([\d.]+)/.exec(decls)?.[1] ?? 1);
}

const AA = 4.5;

describe('wrong-answer text meets WCAG AA in both themes', () => {
  for (const [name, t] of Object.entries(themes)) {
    it(`${name}: a wrong choice is readable on the card`, () => {
      const decls = rule(exerciseCss, ".ex-choice[data-state='wrong']");
      const text = blend(t[colorOf(decls)]!, t['paper-3']!, opacityOf(decls));
      expect(contrast(text, t['paper-3']!)).toBeGreaterThanOrEqual(AA);
    });

    it(`${name}: the heard-instead character in a recitation is readable`, () => {
      const decls = rule(reciteCss, '.rc-heard');
      const bg = blend(t['cinnabar']!, t['paper-3']!, 0.14); // .rc-char[data-status='wrong'] tint
      expect(contrast(t[colorOf(decls)]!, bg)).toBeGreaterThanOrEqual(AA);
    });

    it(`${name}: the wrong-order line builder status is readable`, () => {
      const decls = rule(lineBuilderCss, ".lb-status[data-feedback='wrong']");
      expect(contrast(t[colorOf(decls)]!, t['paper']!)).toBeGreaterThanOrEqual(AA);
    });
  }
});
