import { expect, test } from '@playwright/test';

test('theme choice applies and persists across reload', async ({ page }) => {
  await page.goto('./#/settings');
  await expect(page.getByRole('heading', { level: 1, name: '設定' })).toBeVisible();
  await page.getByRole('radio', { name: /Dark/ }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('radio', { name: /Dark/ })).toBeChecked();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`settings has no horizontal scroll at 360px (${scheme})`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('./#/settings');
    await expect(page.getByRole('heading', { level: 1, name: '設定' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath(`settings-${scheme}.png`), fullPage: true });
  });
}
