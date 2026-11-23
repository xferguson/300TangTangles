import { expect, test } from '@playwright/test';

// Route check plus light/dark phone screenshots for PR review (T51). Saved under test-results/.
for (const scheme of ['light', 'dark'] as const) {
  test(`reading mode loads in the ${scheme} theme`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('./#/read');
    await expect(page.getByRole('heading', { level: 1, name: '靜夜思' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    await page.getByRole('button', { name: '霜 · new' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Line', exact: true }).click();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.screenshot({ path: testInfo.outputPath(`reading-${scheme}.png`), fullPage: true });
  });
}
