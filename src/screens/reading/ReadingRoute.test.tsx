import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clear } from 'idb-keyval';

import { loadLexicon } from '../../lexicon';
import { routeRegistry } from '../../app/registry';
import { ReadingRoute } from './ReadingRoute';

afterEach(async () => {
  window.location.hash = '';
  await clear();
});

describe('reading route', () => {
  it('is registered at #/read', () => {
    expect(routeRegistry.map((r) => r.path)).toContain('#/read');
  });

  it('opens 靜夜思 by default', async () => {
    window.location.hash = '#/read';
    render(<ReadingRoute />);
    expect(await screen.findByRole('heading', { level: 1, name: '靜夜思' })).toBeInTheDocument();
  });

  it('opens the poem named in the hash', async () => {
    window.location.hash = '#/read/jingyesi';
    render(<ReadingRoute />);
    expect(await screen.findByRole('heading', { level: 1, name: '靜夜思' })).toBeInTheDocument();
  });

  it('says so for an unknown poem id', async () => {
    window.location.hash = '#/read/nope';
    render(<ReadingRoute />);
    expect(await screen.findByText(/No poem called/)).toBeInTheDocument();
  });

  it('saves status changes to the persisted lexicon', async () => {
    window.location.hash = '#/read';
    const user = userEvent.setup();
    render(<ReadingRoute />);
    await user.click(await screen.findByRole('button', { name: '霜 · new' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Known' }));
    await waitFor(async () => expect((await loadLexicon())['霜']?.status).toBe('known'));
  });
});
