import { expect, test } from '@playwright/test';

// A stubbed `speechSynthesis` records utterances and ends each one asynchronously.
const stub = (withVoice: boolean) => {
  const w = window as unknown as Record<string, unknown>;
  const spoken: { text: string; lang: string; rate: number; voice: string | null }[] = [];
  w.__spoken = spoken;
  const voices = withVoice
    ? [{ name: 'Stub Mei-Jia', lang: 'zh-TW', localService: true, default: false, voiceURI: 's' }]
    : [];
  // The real utterance rejects a stub voice object, so replace it with a plain one.
  class StubUtterance {
    text: string;
    lang = '';
    rate = 1;
    voice: { name: string } | null = null;
    onend: ((e: Event) => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    onstart: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  }
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    value: StubUtterance,
    configurable: true,
  });
  const synth = {
    getVoices: () => voices,
    speak(u: StubUtterance) {
      spoken.push({ text: u.text, lang: u.lang, rate: u.rate, voice: u.voice?.name ?? null });
      setTimeout(() => u.onend?.(new Event('end')), 30);
    },
    cancel() {},
    addEventListener() {},
    removeEventListener() {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
};

test('a line button on the reading screen speaks through the stubbed speechSynthesis', async ({
  page,
}) => {
  await page.addInitScript(stub, true);
  await page.goto('./#/read/jingyesi');
  await page.getByRole('button', { name: 'Play line 1' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as never as { __spoken: unknown[] }).__spoken.length))
    .toBe(1);
  const spoken = await page.evaluate(
    () =>
      (window as never as { __spoken: { text: string; lang: string; voice: string | null }[] })
        .__spoken,
  );
  expect(spoken[0]).toMatchObject({ text: '床前明月光', voice: 'Stub Mei-Jia' });
});

test('with no voice installed the reading screen marks audio unavailable', async ({ page }) => {
  await page.addInitScript(stub, false);
  await page.goto('./#/read/jingyesi');
  await expect(page.getByRole('heading', { level: 1, name: '靜夜思' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play line 1 (coming soon)' })).toBeVisible();
});
