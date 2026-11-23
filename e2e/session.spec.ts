import { expect, test, type Page } from '@playwright/test';

/** Answer a multiple-choice exercise by trying choices until Continue appears, then press it. */
async function answerAndContinue(page: Page) {
  const next = page.getByRole('button', { name: /繼續|continue/i });
  const choices = page.getByRole('group', { name: 'Choices' }).locator('button:enabled');
  for (let i = 0; i < 6 && !(await next.isVisible()); i++) {
    await choices.first().click();
  }
  await expect(next).toBeVisible();
  await next.click();
}

// Speech is never triggered in these steps (audio buttons are not pressed), so no mock is needed;
// the provider reports "unavailable" in headless Chromium and the exercises degrade gracefully.
for (const scheme of ['light', 'dark'] as const) {
  test(`play session completes a few steps in the ${scheme} theme`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('./#/play');
    await expect(page.getByRole('heading', { level: 1, name: '靜夜思' })).toBeVisible();
    await expect(page.getByRole('region', { name: '靜夜思' })).toBeVisible();
    await expect(page.getByText('童生')).toBeVisible();

    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: testInfo.outputPath(`play-start-${scheme}.png`),
      fullPage: true,
    });

    for (let step = 0; step < 3; step++) {
      await expect(page.getByRole('group', { name: 'Choices' })).toBeVisible();
      await answerAndContinue(page);
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // Ending early shows the summary for the steps completed.
    await page.getByRole('button', { name: /end session/i }).click();
    await expect(page.getByRole('region', { name: 'Session summary' })).toBeVisible();
    await expect(page.getByText(/3 exercises/)).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`play-summary-${scheme}.png`),
      fullPage: true,
    });
  });
}
