import { expect, test } from '@playwright/test';

for (const scheme of ['light', 'dark'] as const) {
  test(`home links out and has no horizontal scroll at 360px (${scheme})`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1, name: /唐詩糾纏/ })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath(`home-${scheme}.png`), fullPage: true });

    await page.getByRole('link', { name: /^Play/ }).click();
    await expect(page).toHaveURL(/#\/play\/jingyesi$/);
    await expect(page.getByRole('heading', { level: 1, name: '靜夜思' })).toBeVisible();
  });
}

test('the library Play button opens the session', async ({ page }) => {
  await page.goto('./#/library');
  await page
    .getByRole('listitem')
    .filter({ hasText: '靜夜思' })
    .getByRole('link', { name: 'Play' })
    .click();
  await expect(page).toHaveURL(/#\/play\/jingyesi$/);
  await expect(page.getByRole('region', { name: 'Flashcard' })).toBeVisible();
});

test('the script setting changes the play, reading and library screens', async ({ page }) => {
  await page.goto('./#/settings');
  await page.getByRole('radio', { name: /Simplified/ }).check();
  await page.goto('./#/library');
  await expect(page.getByRole('link', { name: /静夜思/ })).toBeVisible();
  await page.goto('./#/read/jingyesi');
  await expect(page.getByRole('heading', { level: 1, name: '静夜思' })).toBeVisible();
  await page.goto('./#/play/jingyesi');
  await expect(page.getByRole('heading', { level: 1, name: '静夜思' })).toBeVisible();
});
