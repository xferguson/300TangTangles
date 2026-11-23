import { expect, test } from '@playwright/test';

// Recite preview at phone width in both themes (T56). Headless Chromium has no usable microphone, so this
// walks the self-grade fallback: the learner can always finish.
for (const scheme of ['light', 'dark'] as const) {
  test(`recite finishes via self-grade at phone width in the ${scheme} theme`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('./#/recite');
    await page.getByRole('button', { name: /grade myself/i }).click();
    await expect(page.getByLabel('Answer')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: testInfo.outputPath(`recite-${scheme}.png`), fullPage: true });

    await page.getByRole('button', { name: /got it/i }).click();
    await expect(page.getByRole('status')).toContainText('Correct');
    await page.screenshot({
      path: testInfo.outputPath(`recite-${scheme}-done.png`),
      fullPage: true,
    });
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByTestId('result')).toContainText('"kind":"recite"');

    const noHScroll = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(noHScroll).toBe(true);
  });
}
