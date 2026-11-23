import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { fixturePoemData } from '../src/core/fixtures/poem.fixture';

import { validateDir } from './validate-content';

function dirWith(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'poems-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

describe('validateDir', () => {
  it('passes valid poem files', () => {
    const dir = dirWith({ 'fixture-jingyesi.json': JSON.stringify(fixturePoemData) });
    expect(validateDir(dir)).toEqual({ checked: 1, errors: [] });
  });

  it('passes an empty directory', () => {
    expect(validateDir(dirWith({}))).toEqual({ checked: 0, errors: [] });
  });

  it('reports invalid JSON', () => {
    const { errors } = validateDir(dirWith({ 'bad.json': '{ nope' }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/bad\.json/);
  });

  it('reports schema problems with their path', () => {
    const broken = structuredClone(fixturePoemData) as { lines: { chars: unknown[] }[] };
    broken.lines[0]!.chars.pop();
    const { errors } = validateDir(dirWith({ 'fixture-jingyesi.json': JSON.stringify(broken) }));
    expect(errors.join('\n')).toMatch(/lines/);
  });

  it('requires the file name to match the poem id', () => {
    const { errors } = validateDir(dirWith({ 'other-name.json': JSON.stringify(fixturePoemData) }));
    expect(errors.join('\n')).toMatch(/fixture-jingyesi/);
  });

  it('rejects two files with the same poem id', () => {
    const dir = dirWith({
      'fixture-jingyesi.json': JSON.stringify(fixturePoemData),
      'copy.json': JSON.stringify(fixturePoemData),
    });
    expect(validateDir(dir).errors.length).toBeGreaterThan(0);
  });
});
