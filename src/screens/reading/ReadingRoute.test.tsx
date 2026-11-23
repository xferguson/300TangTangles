import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeSpeechSynthesis } from '../../audio/fakeSpeech';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clear } from 'idb-keyval';

import { loadLexicon } from '../../lexicon';
import { routeRegistry } from '../../app/registry';
import { resetSettings, setSettings } from '../../settings/settings';
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

describe('reading route settings', () => {
  afterEach(() => resetSettings());

  it('follows the persisted script setting', async () => {
    setSettings({ script: 'simp' });
    window.location.hash = '#/read';
    render(<ReadingRoute />);
    expect(await screen.findByRole('heading', { level: 1, name: '静夜思' })).toBeInTheDocument();
  });
});

describe('reading route audio', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('enables audio once browser voices load late, and speaks on click', async () => {
    const synth = new FakeSpeechSynthesis([]);
    vi.stubGlobal('speechSynthesis', synth);
    vi.stubGlobal('SpeechSynthesisUtterance', function (this: { text: string }, text: string) {
      this.text = text;
    });
    window.location.hash = '#/read/jingyesi';
    render(<ReadingRoute />);
    await screen.findByRole('heading', { level: 1, name: '靜夜思' });
    synth.setVoices([{ name: 'Mei-Jia', lang: 'zh-TW', localService: true }]);
    const [button] = await screen.findAllByRole('button', { name: /^Play/ });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button!);
    expect(synth.spoken).toHaveLength(1);
  });
});
