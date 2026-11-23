import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';
import { routeRegistry } from './registry';

describe('route registry', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('auto-discovers route files, including the #/ui gallery', () => {
    expect(routeRegistry.map((r) => r.path)).toContain('#/ui');
  });

  it('has no dev preview routes', () => {
    const paths = routeRegistry.map((r) => r.path);
    for (const gone of ['#/line-builder', '#/audio-check', '#/recite']) {
      expect(paths).not.toContain(gone);
    }
  });

  it('has unique route paths', () => {
    const paths = routeRegistry.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('falls back to the home shell for an unknown hash', () => {
    window.location.hash = '#/nowhere';
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: /唐詩糾纏/ })).toBeInTheDocument();
  });
});
