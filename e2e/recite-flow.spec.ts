import { expect, test } from '@playwright/test';

import seed from './fixtures/almost-there.json' with { type: 'json' };

// Everything is learned except the final blank-scroll recitation, so the session opens on the real
// Recite exercise. Headless Chromium has no usable microphone: the learner grades themselves.
for (const scheme of ['light', 'dark'] as const) {
  test(`the real Recite exercise finishes the poem at phone width (${scheme})`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('./');
    await page.evaluate(async (data) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('keyval-store');
        req.onupgradeneeded = () => req.result.createObjectStore('keyval');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').put(data.lexicon, 'lexicon');
        tx.objectStore('keyval').put(data.progress, 'progress:jingyesi');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    }, seed);

    await page.goto('./#/play/jingyesi');
    await page.reload();
    const recite = page.getByRole('region', { name: 'Recite', exact: true });
    await expect(recite).toBeVisible();
    await expect(page.getByText(/placeholder/i)).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: testInfo.outputPath(`recite-${scheme}.png`), fullPage: true });

    await recite.getByRole('button', { name: /grade myself|自評/i }).click();
    await page.getByRole('button', { name: /got it|對/i }).click();
    await page.screenshot({
      path: testInfo.outputPath(`recite-${scheme}-graded.png`),
      fullPage: true,
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: /continue|繼續/i }).click();

    await expect(page.getByRole('region', { name: 'Rank up' })).toBeVisible();
    await page.getByRole('button', { name: /continue|繼續/i }).click();
    await expect(page.getByRole('region', { name: 'Session summary' })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`summary-${scheme}.png`),
      fullPage: true,
    });
  });
}
