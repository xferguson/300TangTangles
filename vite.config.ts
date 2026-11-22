/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Served from GitHub Pages at https://<owner>.github.io/300TangTangles/
export const BASE = '/300TangTangles/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    // Stub: manifest + service worker registration only. Offline caching and icons come later.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: '300 Tang Tangles · 唐詩糾纏',
        short_name: '唐詩糾纏',
        lang: 'zh-Hant',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#f3ead8',
        theme_color: '#2b2420',
        icons: [],
      },
      workbox: {
        navigateFallback: `${BASE}index.html`,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.{ts,mjs}'],
  },
});
