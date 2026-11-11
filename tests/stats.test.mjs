import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { normaliseEvent, openStore } from '../server/store.mjs';

const daysAgo = (days) => Date.now() - days * 86_400_000;

test('unknown event types are dropped', () => {
  assert.equal(normaliseEvent({ type: 'hack' }), null);
  assert.equal(normaliseEvent({}), null);
  assert.equal(normaliseEvent(null), null);
  assert.equal(normaliseEvent({ type: 'visit' }).type, 'visit');
  assert.equal(normaliseEvent({ type: 'band_warned' }).type, 'band_warned');
});

test('numbers from the network are clamped', () => {
  const event = normaliseEvent({
    type: 'run_ended',
    cause: 'nonsense',
    money: 1e18,
    weight: -4,
    height: 'abc',
    duration: 999999,
  });

  assert.equal(event.cause, null, 'unknown causes are not stored');
  assert.equal(normaliseEvent({ type: 'run_ended', cause: 'finished' }).cause, 'finished');
  assert.equal(normaliseEvent({ type: 'run_ended', cause: 'abandoned' }).cause, 'abandoned');
  assert.equal(event.money, 1_000_000_000);
  assert.equal(event.weight, 0);
  assert.equal(event.height, null);
  assert.equal(event.duration, 3600);
});

test('error messages are clipped and empty ones dropped', () => {
  const long = normaliseEvent({ type: 'error', message: 'x'.repeat(1000) });
  assert.equal(long.message.length, 300);
  assert.equal(normaliseEvent({ type: 'error', message: '   ' }), null);
});

test('error messages are stored without addresses', () => {
  const event = normaliseEvent({
    type: 'error',
    message: 'Failed at https://korupsi.web.id/?seed=1\n    at chrome-extension://abc/x.js',
  });
  assert.equal(event.message, 'Failed at <url>');
  assert.equal(normaliseEvent({ type: 'error', message: '\n https://only.example/x' }), null);
});

test('messages stored before redaction are cleaned when the store opens', () => {
  const dir = mkdtempSync(join(tmpdir(), 'korupsi-stats-'));
  const path = join(dir, 'stats.db');
  try {
    const raw = new DatabaseSync(path);
    raw.exec(`CREATE TABLE events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, day TEXT NOT NULL,
      type TEXT NOT NULL, rev TEXT, cause TEXT, money INTEGER, weight INTEGER,
      height INTEGER, duration INTEGER, message TEXT)`);
    const insert = raw.prepare('INSERT INTO events (ts, day, type, message) VALUES (?, ?, ?, ?)');
    const day = new Date().toISOString().slice(0, 10);
    insert.run(Date.now(), day, 'error', 'boom at https://korupsi.web.id/?a=1');
    insert.run(Date.now(), day, 'error', 'https://only.example/x');
    insert.run(Date.now(), day, 'error', 'clean message');
    insert.run(Date.now(), day, 'error', '   ');
    raw.close();

    const store = openStore(path);
    const messages = store
      .stats(1)
      .errors.map((row) => row.message)
      .sort();
    assert.deepEqual(messages, ['<url>', 'boom at <url>', 'clean message']);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('stats aggregate counts, causes and medians', () => {
  const store = openStore(':memory:');
  const now = Date.now();
  const insert = (event, at) => store.insert(normaliseEvent(event), at);

  insert({ type: 'visit', rev: 'r1' }, now - 1000);
  insert({ type: 'visit', rev: 'r1' }, now - 900);
  insert({ type: 'run_started', rev: 'r1' }, now - 800);
  insert(
    { type: 'run_ended', rev: 'r1', cause: 'band', money: 1_000_000, weight: 2, height: 100, duration: 30 },
    now - 700,
  );
  insert(
    { type: 'run_ended', rev: 'r1', cause: 'band', money: 3_000_000, weight: 6, height: 300, duration: 60 },
    now - 600,
  );
  insert(
    { type: 'run_ended', rev: 'r1', cause: 'auditor', money: 2_000_000, weight: 4, height: 200, duration: 45 },
    now - 500,
  );
  insert({ type: 'shared', rev: 'r1' }, now - 400);
  insert({ type: 'error', rev: 'r1', message: 'boom' }, now - 300);
  insert({ type: 'error', rev: 'r1', message: 'boom' }, now - 200);
  insert({ type: 'visit', rev: 'r2' }, daysAgo(10));

  const stats = store.stats(7);

  assert.equal(stats.totals.visits, 2, 'only the last 7 days count');
  assert.equal(stats.totals.runs, 1);
  assert.equal(stats.totals.ended, 3);
  assert.equal(stats.totals.shared, 1);
  assert.equal(stats.totals.errors, 2);

  assert.deepEqual(
    stats.causes.map((row) => [row.cause, row.n]),
    [
      ['band', 2],
      ['auditor', 1],
    ],
  );

  // None of these three runs reached the door or was walked away from.
  assert.deepEqual(stats.finished, { n: 0, duration: null, money: null, weight: null });
  assert.deepEqual(stats.abandoned, { n: 0, duration: null, height: null });

  assert.equal(stats.errors[0].message, 'boom');
  assert.equal(stats.errors[0].n, 2);

  assert.deepEqual(
    stats.revs.map((row) => row.rev),
    ['r1'],
  );

  store.close();
});

test('finished and abandoned runs are measured apart', () => {
  const store = openStore(':memory:');
  const now = Date.now();
  const run = (cause, fields) => store.insert(normaliseEvent({ type: 'run_ended', rev: 'r1', cause, ...fields }), now);

  run('finished', { money: 500_000, weight: 1, height: 42, duration: 60 });
  run('finished', { money: 1_500_000, weight: 3, height: 42, duration: 90 });
  run('finished', { money: 3_000_000, weight: 6, height: 42, duration: 200 });
  run('abandoned', { money: 0, weight: 0, height: 3, duration: 8 });
  run('abandoned', { money: 0, weight: 0, height: 9, duration: 20 });
  run('abandoned', { money: 500_000, weight: 1, height: 24, duration: 70 });
  run('abandoned', { money: 500_000, weight: 1, height: 57, duration: 300 });

  const stats = store.stats(7);

  // Each day says how many of its runs reached the door, for the daily chart.
  assert.equal(stats.totals.ended, 7);
  assert.equal(stats.totals.finished, 3);
  assert.equal(stats.daily.at(-1).finished, 3);

  // The time to the door is not dragged down by people who left in ten seconds.
  assert.deepEqual(stats.finished, { n: 3, duration: 90, money: 1_500_000, weight: 3 });
  assert.deepEqual(stats.abandoned, { n: 4, duration: 45, height: 17 });

  // Where they left, in ten-metre bands; anything above the last band counts in it.
  assert.deepEqual(stats.quit, [
    { from: 0, to: 9, n: 2 },
    { from: 10, to: 19, n: 0 },
    { from: 20, to: 29, n: 1 },
    { from: 30, to: 39, n: 0 },
    { from: 40, to: null, n: 1 },
  ]);

  assert.deepEqual(
    stats.causes.map((row) => [row.cause, row.n]),
    [
      ['abandoned', 4],
      ['finished', 3],
    ],
  );
  store.close();
});

test('an empty store still answers with every field', () => {
  const store = openStore(':memory:');
  const stats = store.stats(30);
  assert.deepEqual(stats.totals, { visits: 0, runs: 0, ended: 0, finished: 0, shared: 0, errors: 0 });
  assert.equal(stats.finished.n, 0);
  assert.equal(stats.abandoned.n, 0);
  assert.equal(stats.quit.length, 5);
  assert.ok(stats.quit.every((band) => band.n === 0));
  assert.deepEqual(stats.daily, []);
  store.close();
});

test('pruning removes old rows only', () => {
  const store = openStore(':memory:');
  store.insert(normaliseEvent({ type: 'visit' }), daysAgo(120));
  store.insert(normaliseEvent({ type: 'visit' }), daysAgo(1));

  assert.equal(store.prune(90), 1);
  assert.equal(store.stats(365).totals.visits, 1);

  store.close();
});
