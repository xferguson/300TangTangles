import type { ManifestOptions } from 'vite-plugin-pwa';

// Served from GitHub Pages at https://<owner>.github.io/300TangTangles/
export const BASE = '/300TangTangles/';

export const manifest: Partial<ManifestOptions> = {
  name: '300 Tang Tangles · 唐詩糾纏',
  short_name: '唐詩糾纏',
  lang: 'zh-Hant',
  start_url: BASE,
  scope: BASE,
  display: 'standalone',
  background_color: '#f3ead8',
  theme_color: '#2b2420',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    {
      src: 'icons/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};
