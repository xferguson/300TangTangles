import { expect, test } from '@playwright/test';

test('library lists poems and a card navigates to the reading hash', async ({ page }) => {
  await page.goto('./#/library');
  await expect(page.getByRole('heading', { level: 1, name: '詩庫' })).toBeVisible();
  await expect(page.getByText(/1 of 5 open/)).toBeVisible();
  await page.getByRole('link', { name: /靜夜思/ }).click();
  await expect(page).toHaveURL(/#\/read\/jingyesi$/);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`library has no horizontal scroll at 360px (${scheme})`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('./#/library');
    await expect(page.getByRole('link', { name: /靜夜思/ })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath(`library-${scheme}.png`), fullPage: true });
  });
}
