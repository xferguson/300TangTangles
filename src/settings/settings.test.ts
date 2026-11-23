import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../core';
import { THEME_STORAGE_KEY } from '../ui/theme/theme';
import {
  SETTINGS_STORAGE_KEY,
  getSettings,
  reloadSettings,
  resetSettings,
  setSettings,
  subscribe,
} from './settings';

beforeEach(() => {
  localStorage.clear();
  resetSettings();
});

describe('settings store', () => {
  it('starts at the defaults', () => {
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('merges a patch and persists it', () => {
    setSettings({ script: 'simp' });
    expect(getSettings().script).toBe('simp');
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
      script: 'simp',
    });
  });

  it('restores persisted settings on reload', () => {
    setSettings({ mandarinRomanization: 'pinyin', hokkienLayer: 'col' });
    reloadSettings();
    expect(getSettings()).toMatchObject({ mandarinRomanization: 'pinyin', hokkienLayer: 'col' });
  });

  it('falls back to defaults when stored data is corrupt', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, '{nope');
    reloadSettings();
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ script: 'klingon' }));
    reloadSettings();
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('applies the theme to the document and mirrors it for startup', () => {
    setSettings({ theme: 'dark' });
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    setSettings({ theme: 'system' });
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('notifies subscribers and keeps snapshots stable between changes', () => {
    const fn = vi.fn();
    const off = subscribe(fn);
    const a = getSettings();
    expect(getSettings()).toBe(a);
    setSettings({ showReadings: false });
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    setSettings({ showReadings: true });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
