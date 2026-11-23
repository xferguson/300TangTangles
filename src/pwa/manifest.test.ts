import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { BASE, manifest } from '../../pwa-manifest';

// Chrome on Android only offers "Install" when the manifest has a 192px and a
// 512px PNG icon. A maskable icon makes it look right in the launcher.
describe('PWA manifest installability', () => {
  const icons = manifest.icons ?? [];
  const has = (sizes: string, purpose: string) =>
    icons.some((i) => i.sizes === sizes && i.type === 'image/png' && i.purpose === purpose);

  it('declares 192px, 512px and maskable 512px PNG icons', () => {
    expect(has('192x192', 'any')).toBe(true);
    expect(has('512x512', 'any')).toBe(true);
    expect(has('512x512', 'maskable')).toBe(true);
  });
  it('points every icon at a file that exists in public/', () => {
    expect(icons.length).toBeGreaterThan(0);
    for (const i of icons) expect(existsSync(`public/${i.src}`)).toBe(true);
  });
  it('is scoped to the GitHub Pages base', () => {
    expect(manifest.start_url).toBe(BASE);
  });
  it('links an apple-touch-icon from index.html', () => {
    expect(readFileSync('index.html', 'utf8')).toContain('rel="apple-touch-icon"');
  });
});
