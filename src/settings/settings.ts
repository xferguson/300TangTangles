import type { Settings } from '../core';

export const SETTINGS_STORAGE_KEY = 'tt-settings';

export function getSettings(): Settings {
  throw new Error('not implemented');
}
export function setSettings(_patch: Partial<Settings>): Settings {
  throw new Error('not implemented');
}
export function resetSettings(): void {
  throw new Error('not implemented');
}
export function reloadSettings(): void {
  throw new Error('not implemented');
}
export function subscribe(_fn: () => void): () => void {
  throw new Error('not implemented');
}
