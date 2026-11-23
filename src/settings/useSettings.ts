import { useSyncExternalStore } from 'react';
import type { Settings } from '../core';
import { getSettings, setSettings, subscribe } from './settings';

/** Current settings plus a patch-style updater. Re-renders on any change. */
export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const settings = useSyncExternalStore(subscribe, getSettings, getSettings);
  return [settings, setSettings];
}
