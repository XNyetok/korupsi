import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { normaliseEvent, openStore } from '../server/store.mjs';

const daysAgo = (days) => Date.now() - days * 86_400_000;

/** Rows straight from the database have no prototype; copy them to compare with plain objects. */
const plain = (rows) => rows.map((row) => ({ ...row }));

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
  assert.deepEqual(stats.finished, { n: 0, duration: null, money: null, weight: null, deaths: null });
  assert.deepEqual(stats.abandoned, { n: 0, duration: null, height: null, deaths: null });

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
  assert.deepEqual(stats.finished, { n: 3, duration: 90, money: 1_500_000, weight: 3, deaths: null });
  assert.deepEqual(stats.abandoned, { n: 4, duration: 45, height: 17, deaths: null });

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

test('what a run says about itself is kept only when it is well formed', () => {
  const event = normaliseEvent({
    type: 'run_ended',
    cause: 'finished',
    deaths: 3.4,
    checkpoint: 2,
    hazards: { 'stempel:12': 2, 'auditor:10': 1, jatuh: 0, 'laser:3': 9, '<script>': 1, 'auditor:10000': 1 },
    title: 'oknum',
    muted: true,
    device: 'touch',
    layout: 'fill-tall',
    via: 'shared',
  });
  assert.equal(event.deaths, 3);
  assert.equal(event.checkpoint, 2);
  // Known hazards with a count, in order; everything else is dropped.
  assert.equal(event.hazards, '{"auditor:10":1,"stempel:12":2}');
  assert.equal(event.title, 'oknum');
  assert.equal(event.muted, 1);
  assert.equal(event.device, 'touch');
  assert.equal(event.layout, 'fill-tall');
  assert.equal(event.via, null, 'only a share says how it was shared');

  const junk = normaliseEvent({
    type: 'run_ended',
    cause: 'finished',
    deaths: 'many',
    hazards: ['auditor:10'],
    title: 'Raja Amplop <b>',
    muted: 'yes',
    device: 'fridge',
    layout: 'sideways',
  });
  assert.deepEqual(
    [junk.deaths, junk.hazards, junk.title, junk.muted, junk.device, junk.layout],
    [null, null, null, null, null, null],
  );

  assert.equal(normaliseEvent({ type: 'shared', via: 'saved' }).via, 'saved');
  assert.equal(normaliseEvent({ type: 'shared', via: 'fax' }).via, null);
  assert.equal(normaliseEvent({ type: 'visit', device: 'keys', layout: 'window' }).device, 'keys');

  // A tally cannot be used to store an essay.
  const many = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`auditor:${i}`, 1]));
  const stored = JSON.parse(normaliseEvent({ type: 'run_ended', cause: 'abandoned', hazards: many }).hazards);
  assert.ok(Object.keys(stored).length <= 24);
});

test('a database from an earlier release gains the new columns and keeps its rows', () => {
  const dir = mkdtempSync(join(tmpdir(), 'korupsi-stats-'));
  const path = join(dir, 'stats.db');
  try {
    const raw = new DatabaseSync(path);
    raw.exec(`CREATE TABLE events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, day TEXT NOT NULL,
      type TEXT NOT NULL, rev TEXT, cause TEXT, money INTEGER, weight INTEGER,
      height INTEGER, duration INTEGER, message TEXT)`);
    const day = new Date().toISOString().slice(0, 10);
    raw
      .prepare(
        'INSERT INTO events (ts, day, type, cause, money, weight, height, duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(Date.now(), day, 'run_ended', 'finished', 1_000_000, 2, 42, 80);
    raw.close();

    const store = openStore(path);
    store.insert(
      normaliseEvent({
        type: 'run_ended',
        cause: 'finished',
        money: 0,
        weight: 0,
        height: 42,
        duration: 120,
        deaths: 4,
        device: 'touch',
      }),
    );
    const stats = store.stats(1);
    assert.equal(stats.finished.n, 2, 'the old row still counts');
    assert.equal(stats.finished.duration, 100);
    assert.equal(stats.finished.deaths, 4, 'and is left out of what it never recorded');
    store.close();

    // Opening it again changes nothing.
    const again = openStore(path);
    assert.equal(again.stats(1).finished.n, 2);
    again.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the statistics say what catches players, where they leave, and on what', () => {
  const store = openStore(':memory:');
  const now = Date.now();
  const add = (event) => store.insert(normaliseEvent(event), now);

  for (let i = 0; i < 5; i++) add({ type: 'visit', device: 'touch', layout: 'fill-tall' });
  for (let i = 0; i < 2; i++) add({ type: 'visit', device: 'keys', layout: 'window' });
  for (let i = 0; i < 6; i++) add({ type: 'run_started', device: 'touch' });
  for (let i = 0; i < 2; i++) add({ type: 'run_started', device: 'keys' });

  const base = { type: 'run_ended', money: 0, weight: 0, duration: 60 };
  add({
    ...base,
    cause: 'finished',
    height: 42,
    deaths: 2,
    checkpoint: 2,
    hazards: { 'stempel:12': 2 },
    title: 'oknum',
    muted: false,
    device: 'keys',
  });
  add({
    ...base,
    cause: 'finished',
    height: 42,
    deaths: 0,
    checkpoint: 2,
    title: 'emas',
    muted: true,
    device: 'touch',
  });
  add({
    ...base,
    cause: 'finished',
    height: 42,
    deaths: 6,
    checkpoint: 2,
    hazards: { 'stempel:12': 3, 'auditor:17': 3 },
    title: 'kebal',
    muted: false,
    device: 'keys',
  });
  add({ ...base, cause: 'abandoned', height: 9, deaths: 0, checkpoint: 0, muted: false, device: 'touch' });
  add({
    ...base,
    cause: 'abandoned',
    height: 26,
    deaths: 5,
    checkpoint: 1,
    hazards: { 'stempel:12': 4, jatuh: 1 },
    muted: false,
    device: 'touch',
  });
  add({
    ...base,
    cause: 'abandoned',
    height: 27,
    deaths: 3,
    checkpoint: 1,
    hazards: { 'stempel:12': 3 },
    muted: false,
    device: 'touch',
  });
  add({ type: 'shared', via: 'shared' });
  add({ type: 'shared', via: 'shared' });
  add({ type: 'shared', via: 'saved' });

  const stats = store.stats(7);

  assert.equal(stats.format, 2);
  assert.equal(stats.finished.deaths, 2);
  assert.equal(stats.abandoned.deaths, 3);

  // The stamp on ledge 12 is the floor's problem: most catches, most runs.
  assert.deepEqual(stats.hazards, [
    { hazard: 'stempel:12', catches: 12, runs: 4, kind: 'stempel', ledge: 12 },
    { hazard: 'auditor:17', catches: 3, runs: 1, kind: 'auditor', ledge: 17 },
    { hazard: 'jatuh', catches: 1, runs: 1, kind: 'jatuh', ledge: null },
  ]);

  // Two of the three who left were past the first clock-in machine.
  assert.deepEqual(stats.sections, [
    { checkpoint: 0, n: 1 },
    { checkpoint: 1, n: 2 },
  ]);

  assert.deepEqual(stats.titles, [
    { title: 'emas', n: 1 },
    { title: 'kebal', n: 1 },
    { title: 'oknum', n: 1 },
  ]);

  assert.deepEqual(plain(stats.devices), [
    { device: 'touch', visits: 5, runs: 6, finished: 1, abandoned: 3 },
    { device: 'keys', visits: 2, runs: 2, finished: 2, abandoned: 0 },
  ]);
  assert.deepEqual(plain(stats.layouts), [
    { layout: 'fill-tall', visits: 5 },
    { layout: 'window', visits: 2 },
  ]);
  assert.deepEqual(plain(stats.shares), [
    { via: 'shared', n: 2 },
    { via: 'saved', n: 1 },
  ]);
  assert.deepEqual(stats.sound, { runs: 6, muted: 1 });
  store.close();
});

test('the statistics explain themselves', () => {
  const store = openStore(':memory:');
  const stats = store.stats(30);
  // Every part of the answer has a line saying what it is, for whoever reads the file later.
  const described = new Set(Object.keys(stats.about));
  const structural = new Set(['format', 'generated', 'about', 'days', 'since']);
  for (const key of Object.keys(stats)) {
    if (!structural.has(key)) assert.ok(described.has(key), `"${key}" is in the statistics but not explained`);
  }
  for (const [key, text] of Object.entries(stats.about)) {
    assert.ok(typeof text === 'string' && text.length > 20, `the note on "${key}" says something`);
  }
  assert.match(stats.generated, /^\d{4}-\d\d-\d\dT/);
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
  for (const list of ['sections', 'hazards', 'titles', 'devices', 'layouts', 'shares', 'causes', 'errors', 'revs']) {
    assert.deepEqual(stats[list], [], list);
  }
  assert.deepEqual(stats.sound, { runs: 0, muted: 0 });
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
