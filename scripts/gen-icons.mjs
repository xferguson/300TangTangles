// Renders public/icons/*.svg to the PNG sizes the PWA manifest needs.
// Run: node scripts/gen-icons.mjs  (needs playwright's chromium)
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const jobs = [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512],
  ['icon.svg', 'apple-touch-icon.png', 180],
];
const browser = await chromium.launch();
for (const [src, out, size] of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const svg = readFileSync(`public/icons/${src}`, 'utf8');
  await page.setContent(
    `<body style="margin:0">${svg.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body>`,
  );
  await page.screenshot({ path: `public/icons/${out}` });
  await page.close();
}
await browser.close();
