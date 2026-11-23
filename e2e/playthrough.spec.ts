import { readFileSync } from 'node:fs';

import { expect, test, type Locator, type Page } from '@playwright/test';

interface RawChar {
  trad: string;
  simp: string;
}
const poem = JSON.parse(readFileSync('content/poems/jingyesi.json', 'utf8')) as {
  lines: { chars: RawChar[] }[];
};

/** When set, screenshots are written here (used to refresh docs/screenshots/T60). */
const SHOTS = process.env.T60_SHOTS_DIR;

type Script = 'trad' | 'simp';

/** Speech is mocked: a synthesizer that never speaks, and no recognizer, so Recite self-grades. */
async function mockSpeech(page: Page) {
  await page.addInitScript(() => {
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      speak: (u: { onend?: () => void }) => setTimeout(() => u.onend?.(), 0),
      cancel: () => {},
      pause: () => {},
      resume: () => {},
      getVoices: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    class Utterance {
      onend?: () => void;
      constructor(public text: string) {}
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: Utterance,
      configurable: true,
    });
  });
}

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function shot(page: Page, name: string, testInfo: { outputPath: (n: string) => string }) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: SHOTS ? `${SHOTS}/${name}.png` : testInfo.outputPath(`${name}.png`),
    fullPage: true,
  });
}

/** Click bank tiles (by visible text) in order; duplicates take the next enabled tile. */
async function clickChars(bank: Locator, chars: string[]) {
  for (const ch of chars) {
    await bank.locator('button:enabled', { hasText: ch }).first().click();
  }
}

async function playStep(page: Page, script: Script) {
  const region = (name: string | RegExp, exact = false) =>
    page.getByRole('region', { name, exact });
  const cont = page.getByRole('button', { name: /continue|繼續/i });
  const bank = page.getByRole('group', { name: 'Character bank' });
  const lineNo = async (r: Locator) =>
    Number((await r.getAttribute('aria-label'))!.match(/\d+/)![0]);

  if (await region('Rank up').isVisible()) {
    await cont.click();
  } else if (await region(/^Build line \d+$/).isVisible()) {
    const n = await lineNo(region(/^Build line \d+$/));
    const answer = poem.lines[n - 1]!.chars.map((c) => c[script]);
    const locked = await page.getByRole('button', { name: /first character/ }).count();
    await clickChars(bank, answer.slice(locked));
    await page.getByRole('button', { name: /^(Check|檢查)/ }).click();
    await cont.click();
  } else if (await region(/^Tangle, line \d+$/).isVisible()) {
    const n = await lineNo(region(/^Tangle, line \d+$/));
    await clickChars(
      bank,
      poem.lines[n - 1]!.chars.map((c) => c[script]),
    );
    await page.getByRole('button', { name: 'Submit' }).click();
    await cont.click();
  } else if (await region('Recite', true).isVisible()) {
    await page.getByRole('button', { name: /grade myself|自評/i }).click();
    await page.getByRole('button', { name: /got it|對/i }).click();
    await cont.click();
  } else {
    // Flashcard, cloze, meaning check: a learner who knows the answers. The answer key is read from
    // the exercise object that React holds for the on-screen choice list.
    const all = page.getByRole('group', { name: 'Choices' }).locator('button');
    const key = await page.evaluate(() => {
      const el = document.querySelector('.ex-choices');
      const fk = el && Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- React internals
      let f: any = fk ? (el as any)[fk] : null;
      while (f && !f.memoizedProps?.exercise) f = f.return;
      const ex = f?.memoizedProps?.exercise as
        { kind: string; answerIndex?: number; blanks?: { answer: string }[] } | undefined;
      return ex
        ? { kind: ex.kind, answerIndex: ex.answerIndex, answers: ex.blanks?.map((b) => b.answer) }
        : null;
    });
    if (key?.answerIndex !== undefined) {
      await all.nth(key.answerIndex).click();
    } else if (key?.answers) {
      const toShown = (t: string) =>
        [...t]
          .map(
            (ch) => poem.lines.flatMap((l) => l.chars).find((c) => c.trad === ch)?.[script] ?? ch,
          )
          .join('');
      const want = new Set(key.answers.map(toShown));
      for (let i = 0; i < key.answers.length; i++) {
        const labels = await all.evaluateAll((bs) =>
          bs.map(
            (b) => [b.getAttribute('aria-label') ?? '', (b as HTMLButtonElement).disabled] as const,
          ),
        );
        const idx = labels.findIndex(([l, d]) => !d && want.has(l));
        await all.nth(idx).click();
      }
    }
    for (let i = 0; i < 12 && !(await cont.isVisible()); i++) {
      await all.locator(':scope:enabled').first().click();
    }
    await cont.click();
  }
}

for (const script of ['trad', 'simp'] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`童生 to 狀元 with Continue only (${script}, ${scheme})`, async ({ page }, testInfo) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: 360, height: 780 });
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await mockSpeech(page);
      await page.addInitScript(
        ([s, t]) => localStorage.setItem('tt-settings', JSON.stringify({ script: s, theme: t })),
        [script, scheme],
      );
      await page.goto('./#/play/jingyesi');
      await expect(page.getByLabel('Current rank')).toContainText('童生');
      await shot(page, `play-start-${script}-${scheme}`, testInfo);

      const summary = page.getByRole('region', { name: 'Session summary' });
      let steps = 0;
      let shotSeal = false;
      while (!(await summary.isVisible())) {
        if (++steps > 400) throw new Error('session did not finish within 400 steps');
        if (steps === 12) await shot(page, `play-mid-${script}-${scheme}`, testInfo);
        if (!shotSeal && (await page.getByRole('region', { name: 'Rank up' }).isVisible())) {
          shotSeal = true;
          await shot(page, `play-rankup-${script}-${scheme}`, testInfo);
        }
        await playStep(page, script);
        await noOverflow(page);
      }
      await expect(summary).toContainText('Rank: 童生 → 狀元');
      await expect(page.getByLabel('Seals earned')).toBeVisible();
      await noOverflow(page);
      await shot(page, `play-summary-${script}-${scheme}`, testInfo);
    });
  }
}
