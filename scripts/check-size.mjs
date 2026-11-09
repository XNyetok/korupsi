#!/usr/bin/env node
/**
 * Fails when the build a player downloads grows past its budget. Run after
 * `npm run build`. Sizes are gzipped, which is what nginx sends.
 *
 * Counted: index.html and everything under assets/, the files a first visit
 * loads. Not counted: the social card (og.png), the touch icon and the kill
 * switch, which players do not download to play.
 *
 * Raising a budget is fine when it is a decision: change the number here, and
 * say why in the pull request. V1 (sprite sheets) is expected to.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const BUDGET = {
  js: 14 * KB,
  css: 3 * KB,
  html: 1.5 * KB,
  other: 4 * KB,
  total: 18 * KB,
};

const dist = process.argv[2] ?? 'dist';

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = [join(dist, 'index.html'), ...walk(join(dist, 'assets'))];
const totals = { js: 0, css: 0, html: 0, other: 0 };
const rows = [];

for (const file of files) {
  const raw = readFileSync(file);
  const gz = gzipSync(raw, { level: 9 }).length;
  const ext = extname(file).slice(1);
  const kind = ext in totals ? ext : 'other';
  totals[kind] += gz;
  rows.push([relative(dist, file), raw.length, gz]);
}

const fmt = (n) => `${(n / KB).toFixed(2)} KB`;
for (const [name, raw, gz] of rows) console.log(`${name.padEnd(36)} ${fmt(raw).padStart(10)}  gzip ${fmt(gz)}`);

const total = Object.values(totals).reduce((a, b) => a + b, 0);
let failed = false;
for (const [kind, size] of [...Object.entries(totals), ['total', total]]) {
  const limit = BUDGET[kind];
  const over = size > limit;
  failed ||= over;
  console.log(`${over ? 'OVER' : 'ok  '} ${kind.padEnd(6)} ${fmt(size).padStart(10)} of ${fmt(limit)}`);
}

if (failed) {
  console.error('\nThe build is over its size budget. See scripts/check-size.mjs.');
  process.exit(1);
}
