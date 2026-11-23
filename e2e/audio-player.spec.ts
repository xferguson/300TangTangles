import { expect, test } from '@playwright/test';

// A stubbed `speechSynthesis` records utterances and ends each one asynchronously.
const stub = (withVoice: boolean) => () => {
  const w = window as unknown as Record<string, unknown>;
  const spoken: { text: string; lang: string; rate: number; voice: string | null }[] = [];
  w.__spoken = spoken;
  const voices = withVoice
    ? [{ name: 'Stub Mei-Jia', lang: 'zh-TW', localService: true, default: false, voiceURI: 's' }]
    : [];
  const synth = {
    getVoices: () => voices,
    speak(u: SpeechSynthesisUtterance) {
      spoken.push({ text: u.text, lang: u.lang, rate: u.rate, voice: u.voice?.name ?? null });
      setTimeout(() => u.onend?.(new Event('end') as SpeechSynthesisEvent), 30);
    },
    cancel() {},
    addEventListener() {},
    removeEventListener() {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
};

test('buttons speak the poem and a slow line through the stubbed speechSynthesis', async ({
  page,
}) => {
  await page.addInitScript(stub(true));
  await page.goto('./#/audio-check');
  await expect(page.getByTestId('audio-status')).toContainText('Stub Mei-Jia');

  await page.getByRole('button', { name: 'Play poem' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as never as { __spoken: unknown[] }).__spoken.length))
    .toBe(4);
  await expect(page.getByRole('button', { name: 'Play poem' })).toHaveAttribute(
    'data-state',
    'idle',
  );

  await page.getByRole('button', { name: 'Play line 1 slowly' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as never as { __spoken: unknown[] }).__spoken.length))
    .toBe(5);
  const spoken = await page.evaluate(
    () => (window as never as { __spoken: { text: string; rate: number }[] }).__spoken,
  );
  expect(spoken.slice(0, 4).map((s) => s.text)).toEqual([
    '床前明月光',
    '疑是地上霜',
    '舉頭望明月',
    '低頭思故鄉',
  ]);
  expect(spoken[0]!.rate).toBe(1);
  expect(spoken[4]).toMatchObject({ text: '床前明月光', rate: 0.6 });
});

test('with no voice installed the buttons are disabled and say so', async ({ page }) => {
  await page.addInitScript(stub(false));
  await page.goto('./#/audio-check');
  await expect(page.getByTestId('audio-status')).toContainText('No Mandarin voice');
  await expect(page.getByRole('button', { name: /Play poem/ })).toBeDisabled();
});
