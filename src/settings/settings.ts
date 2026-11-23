/**
 * Persisted app settings (localStorage, validated by `settingsSchema`).
 * Usable from non-React code via `getSettings` / `setSettings` / `subscribe`;
 * components use `useSettings()`. The theme setting is applied to the document here.
 */
import { DEFAULT_SETTINGS, settingsSchema, type Settings } from '../core';
import { THEME_STORAGE_KEY, applyTheme } from '../ui/theme/theme';

export const SETTINGS_STORAGE_KEY = 'tt-settings';

function readStored(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = settingsSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    }
  } catch {
    // Storage blocked or corrupt JSON: use defaults.
  }
  return { ...DEFAULT_SETTINGS };
}

function persist(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    // main.tsx reads this key before React mounts, so the theme never flashes.
    localStorage.setItem(THEME_STORAGE_KEY, settings.theme);
  } catch {
    // Storage blocked: settings still apply for this visit.
  }
}

let current: Settings = readStored();
applyTheme(current.theme);
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function commit(next: Settings, save: boolean) {
  current = next;
  applyTheme(next.theme);
  if (save) persist(next);
  emit();
}

export function getSettings(): Settings {
  return current;
}

/** Merge a patch into the settings (invalid values are rejected by the schema), save, and notify. */
export function setSettings(patch: Partial<Settings>): Settings {
  commit(settingsSchema.parse({ ...current, ...patch }), true);
  return current;
}

/** Replace all settings, e.g. from an imported backup. */
export function replaceSettings(next: Settings): void {
  commit(settingsSchema.parse(next), true);
}

/** Back to defaults without touching saved data (test helper; also "reset" for callers). */
export function resetSettings(): void {
  commit({ ...DEFAULT_SETTINGS }, false);
}

/** Re-read from storage. */
export function reloadSettings(): void {
  commit(readStored(), false);
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
