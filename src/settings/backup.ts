import type { Lexicon, Settings } from '../core';

export type BackupResult =
  | { ok: true; settings: Settings | undefined; lexicon: Lexicon }
  | { ok: false; error: string };

export function createBackup(_settings: Settings, _lexicon: Lexicon, _now: Date): string {
  throw new Error('not implemented');
}
export function parseBackup(_text: string): BackupResult {
  throw new Error('not implemented');
}
