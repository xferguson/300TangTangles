// Validates content/poems/*.json against the poem schema (src/core/poem.ts).
// Run by CI as `pnpm validate:content`; also unit-tested.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { safeParsePoem } from '../src/core/poem';

export interface ValidationResult {
  checked: number;
  errors: string[];
}

export function validateDir(dir: string): ValidationResult {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  const errors: string[] = [];
  const ids = new Map<string, string>();

  for (const file of files) {
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    } catch (err) {
      errors.push(`${file}: invalid JSON (${err instanceof Error ? err.message : String(err)})`);
      continue;
    }

    const parsed = safeParsePoem(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`${file}: ${issue.path.join('.') || '(root)'}: ${issue.message}`);
      }
      continue;
    }

    const { id } = parsed.data;
    if (file !== `${id}.json`)
      errors.push(`${file}: file name must match the poem id, expected ${id}.json`);
    const earlier = ids.get(id);
    if (earlier) errors.push(`${file}: poem id ${id} is already used by ${earlier}`);
    else ids.set(id, file);
  }

  return { checked: files.length, errors };
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const dir = fileURLToPath(new URL('../content/poems/', import.meta.url));
  const { checked, errors } = validateDir(dir);
  for (const e of errors) console.error(`✗ ${e}`);
  console.log(`validate:content: ${checked} poem file(s) checked, ${errors.length} problem(s)`);
  process.exit(errors.length ? 1 : 0);
}
