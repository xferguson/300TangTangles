import { expect, test } from '@playwright/test';

test('app shell loads under the Pages base path', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle(/300 Tang Tangles/);
  await expect(page.getByRole('heading', { level: 1, name: /唐詩糾纏/ })).toBeVisible();
});

test('a hash deep link still serves the app shell', async ({ page }) => {
  await page.goto('./#/poem/jingyesi');
  await expect(page.getByRole('heading', { level: 1, name: /唐詩糾纏/ })).toBeVisible();
});

test('the PWA manifest is scoped to the base path', async ({ request }) => {
  const res = await request.get('manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const manifest = (await res.json()) as { scope: string; start_url: string };
  expect(manifest.scope).toBe('/300TangTangles/');
  expect(manifest.start_url).toBe('/300TangTangles/');
});
