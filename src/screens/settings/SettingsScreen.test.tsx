import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clear } from 'idb-keyval';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getSettings, resetSettings, setSettings } from '../../settings/settings';
import { loadLexicon } from '../../lexicon/persistence';
import { SettingsScreen } from './SettingsScreen';

beforeEach(async () => {
  localStorage.clear();
  resetSettings();
  await clear();
});

describe('SettingsScreen', () => {
  it('persists a changed setting', async () => {
    const user = userEvent.setup();
    render(<SettingsScreen />);
    await user.click(screen.getByRole('radio', { name: /Simplified/ }));
    expect(getSettings().script).toBe('simp');
    expect(localStorage.getItem('tt-settings')).toContain('simp');
  });

  it('reflects stored settings and applies the theme', async () => {
    setSettings({ mandarinRomanization: 'pinyin' });
    const user = userEvent.setup();
    render(<SettingsScreen />);
    expect(screen.getByRole('radio', { name: /Pinyin/ })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: /Dark/ }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('disables audio languages without a voice', () => {
    render(<SettingsScreen voices={[]} />);
    expect(screen.getByRole('radio', { name: /Mandarin/ })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /Cantonese/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Hokkien/ })).toBeDisabled();
  });

  it('enables Cantonese when a zh-HK voice exists', () => {
    render(<SettingsScreen voices={[{ name: 'v', lang: 'zh-HK', local: true }]} />);
    expect(screen.getByRole('radio', { name: /Cantonese/ })).toBeEnabled();
  });

  it('shows an error for an invalid import and leaves data untouched', async () => {
    const user = userEvent.setup();
    render(<SettingsScreen />);
    const file = new File(['not json'], 'bad.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText(/Import backup/), file);
    expect(await screen.findByRole('alert')).toHaveTextContent(/not valid JSON/);
    expect(getSettings().script).toBe('trad');
  });

  it('imports a valid backup', async () => {
    const user = userEvent.setup();
    render(<SettingsScreen />);
    const backup = JSON.stringify({
      app: '300tangtangles-backup',
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      settings: { ...getSettings(), script: 'simp' },
      lexicon: { version: 1, exportedAt: '2026-01-01T00:00:00.000Z', entries: [] },
    });
    await user.upload(
      screen.getByLabelText(/Import backup/),
      new File([backup], 'ok.json', { type: 'application/json' }),
    );
    await waitFor(() => expect(getSettings().script).toBe('simp'));
    expect(await screen.findByRole('status')).toHaveTextContent(/imported/i);
    expect(await loadLexicon()).toEqual({});
  });
});
