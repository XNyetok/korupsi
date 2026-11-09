import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';

const SRC = new URL('../src/', import.meta.url).pathname;

/** Which layers each layer may import. main.ts, the composition root, may import all. */
const ALLOWED: Record<string, string[]> = {
  core: ['core'],
  platform: ['core', 'platform'],
  view: ['core', 'view'],
  ui: ['core', 'platform', 'view', 'ui'],
};

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

test('each layer imports only the layers below it', () => {
  const problems: string[] = [];
  for (const file of files(SRC)) {
    const rel = relative(SRC, file);
    const layer = rel.split('/')[0] ?? '';
    const allowed = ALLOWED[layer];
    if (!allowed) continue;

    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)) {
      const spec = match[1] ?? '';
      if (!spec.startsWith('.')) continue;
      const target = relative(SRC, join(file, '..', spec)).split('/')[0] ?? '';
      if (target.endsWith('.ts') || target.endsWith('.css')) {
        problems.push(`${rel} imports ${spec}, outside any layer`);
      } else if (!allowed.includes(target)) {
        problems.push(`${rel} (${layer}) imports ${spec} (${target})`);
      }
    }
  }
  assert.deepEqual(problems, []);
});
