// Validates content/poems/*.json. Until T02 adds the Zod poem schema, this only checks that each file is valid JSON.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../content/poems/', import.meta.url).pathname;
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
let failed = 0;
for (const f of files) {
  try {
    JSON.parse(readFileSync(join(dir, f), 'utf8'));
  } catch (err) {
    failed++;
    console.error(`✗ ${f}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
console.log(`validate:content: ${files.length - failed}/${files.length} poem file(s) OK`);
process.exit(failed ? 1 : 0);
