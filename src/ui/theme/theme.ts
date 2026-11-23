import { useCallback, useEffect, useState } from 'react';

/** `system` follows `prefers-color-scheme`; `light` is 宣紙 paper, `dark` is 漆 lacquer + gold. */
export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'tt-theme';

const PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (PREFERENCES as readonly string[]).includes(value);
}

/** Set or clear `data-theme` on the root element. tokens.css keys every theme off that attribute. */
export function applyTheme(pref: ThemePreference, root: HTMLElement = document.documentElement) {
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.dataset.theme = pref;
}

export function readStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    // Storage can be blocked (private mode); fall back to the OS setting.
    return 'system';
  }
}

function storeTheme(pref: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Storage blocked: the choice still applies for this visit.
  }
}

/** The current theme preference and a setter that applies and remembers it. */
export function useThemePreference(): [ThemePreference, (pref: ThemePreference) => void] {
  const [pref, setPref] = useState<ThemePreference>(readStoredTheme);

  useEffect(() => {
    applyTheme(pref);
  }, [pref]);

  const choose = useCallback((next: ThemePreference) => {
    storeTheme(next);
    setPref(next);
  }, []);

  return [pref, choose];
}
