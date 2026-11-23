import { expect, test } from '@playwright/test';

// Screenshots of every primitive in both themes, for PR review (T21). Saved under test-results/.
for (const scheme of ['light', 'dark'] as const) {
  test(`UI gallery renders in the ${scheme} theme`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('./#/ui');
    await expect(page.getByRole('heading', { level: 1, name: /UI primitives/ })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // 宣紙 paper #efe6d3 in light; 漆 lacquer #15110e in dark.
    expect(bg).toBe(scheme === 'light' ? 'rgb(239, 230, 211)' : 'rgb(21, 17, 14)');

    await page.screenshot({
      path: testInfo.outputPath(`ui-gallery-${scheme}.png`),
      fullPage: true,
    });
  });
}

test('an explicit theme choice overrides the OS setting', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./#/ui');
  await page.getByRole('button', { name: '漆 Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(21, 17, 14)');
});
