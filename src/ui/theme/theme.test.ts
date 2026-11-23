import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { THEME_STORAGE_KEY, applyTheme, readStoredTheme, useThemePreference } from './theme';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  localStorage.clear();
});

describe('applyTheme', () => {
  it('sets data-theme for an explicit light or dark choice', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('removes data-theme for "system" so prefers-color-scheme decides', () => {
    applyTheme('dark');
    applyTheme('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});

describe('readStoredTheme', () => {
  it('defaults to system when nothing valid is stored', () => {
    expect(readStoredTheme()).toBe('system');
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    expect(readStoredTheme()).toBe('system');
  });

  it('returns a stored valid preference', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(readStoredTheme()).toBe('dark');
  });
});

describe('useThemePreference', () => {
  it('applies, stores and returns the chosen preference', () => {
    const { result } = renderHook(() => useThemePreference());
    expect(result.current[0]).toBe('system');
    act(() => result.current[1]('dark'));
    expect(result.current[0]).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });
});
