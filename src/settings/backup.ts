/** Backup file: settings + lexicon in one JSON. A plain T30 lexicon export is also accepted. */
import { settingsSchema, type Lexicon, type Settings } from '../core';
import { exportLexicon, importLexicon } from '../lexicon/persistence';

export const BACKUP_APP = '300tangtangles-backup';
export const BACKUP_VERSION = 1;

export type BackupResult =
  { ok: true; settings: Settings | undefined; lexicon: Lexicon } | { ok: false; error: string };

export function createBackup(settings: Settings, lexicon: Lexicon, now: Date): string {
  return JSON.stringify(
    {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: now.toISOString(),
      settings,
      lexicon: JSON.parse(exportLexicon(lexicon, now)) as unknown,
    },
    null,
    2,
  );
}

/** All-or-nothing: any problem rejects the whole file. */
export function parseBackup(text: string): BackupResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    return { ok: false, error: 'This is not a 300 Tang Tangles backup file.' };
  }
  const obj = json as Record<string, unknown>;
  if (obj.app !== BACKUP_APP) {
    // Maybe a plain lexicon export.
    if ('entries' in obj && 'version' in obj) {
      const r = importLexicon(text);
      return r.ok ? { ok: true, settings: undefined, lexicon: r.lexicon } : r;
    }
    return { ok: false, error: 'This is not a 300 Tang Tangles backup file.' };
  }
  if (obj.version !== BACKUP_VERSION) {
    return { ok: false, error: `Unsupported backup version: ${String(obj.version)}.` };
  }
  const settings = settingsSchema.safeParse(obj.settings);
  if (!settings.success) {
    const issue = settings.error.issues[0];
    return {
      ok: false,
      error: `Invalid settings in backup at "${issue?.path.join('.') ?? ''}": ${issue?.message ?? 'unknown'}`,
    };
  }
  const lex = importLexicon(JSON.stringify(obj.lexicon));
  if (!lex.ok) return lex;
  return { ok: true, settings: settings.data, lexicon: lex.lexicon };
}
