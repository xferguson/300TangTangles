import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { clear } from 'idb-keyval';

import { routeRegistry } from '../../app/registry';
import { resetSettings, setSettings } from '../../settings/settings';
import { SessionRoute } from './SessionRoute';

afterEach(async () => {
  window.location.hash = '';
  await clear();
});

describe('play route', () => {
  it('is registered at #/play', () => {
    expect(routeRegistry.map((r) => r.path)).toContain('#/play');
  });

  it('opens 靜夜思 by default and starts the session', async () => {
    window.location.hash = '#/play';
    render(<SessionRoute />);
    expect(await screen.findByRole('region', { name: '靜夜思' })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Flashcard' })).toBeInTheDocument();
  });

  it('says so when the poem does not exist', async () => {
    window.location.hash = '#/play/nope';
    render(<SessionRoute />);
    expect(await screen.findByText(/No poem called "nope"/)).toBeInTheDocument();
  });
});

describe('play route settings', () => {
  afterEach(() => resetSettings());

  it('follows the persisted script setting', async () => {
    setSettings({ script: 'simp' });
    window.location.hash = '#/play/jingyesi';
    render(<SessionRoute />);
    expect(await screen.findByRole('heading', { level: 1, name: '静夜思' })).toBeInTheDocument();
  });
});
