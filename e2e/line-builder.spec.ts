import { expect, test } from '@playwright/test';

// Line builder preview: builds the line by tapping, screenshots in both themes at phone width (T53).
for (const scheme of ['light', 'dark'] as const) {
  test(`line builder works at phone width in the ${scheme} theme`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('./#/line-builder');
    await expect(page.getByRole('group', { name: 'Character bank' })).toBeVisible();

    for (const c of ['舉', '頭', '望'])
      await page
        .getByRole('group', { name: 'Character bank' })
        .getByRole('button', { name: c })
        .click();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: testInfo.outputPath(`line-builder-${scheme}.png`),
      fullPage: true,
    });

    for (const c of ['明', '月'])
      await page
        .getByRole('group', { name: 'Character bank' })
        .getByRole('button', { name: c })
        .click();
    await page.getByRole('button', { name: /check/i }).click();
    await expect(page.getByRole('status')).toHaveText('Correct!');

    const noHScroll = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(noHScroll).toBe(true);
  });
}
