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

test('an error the browser hid from the page is not stored', () => {
  // A script from another origin threw, and this is all the page was told.
  assert.equal(normaliseEvent({ type: 'error', message: 'Script error.' }), null);
  assert.equal(normaliseEvent({ type: 'error', message: ' Script error ' }), null);
  // Only the bare placeholder: a message that goes on says something.
  assert.equal(normaliseEvent({ type: 'error', message: 'Script error. Retrying' }).message, 'Script error. Retrying');
});

test('messages stored under older rules are cleaned when the store opens', () => {
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
    insert.run(Date.now(), day, 'error', 'Script error.');
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

test('how a run was played is kept only when it is what the game sends', () => {
  const event = normaliseEvent({
    type: 'run_ended',
    cause: 'finished',
    attempt: 2,
    splits: [23, null, 'x', 99999],
    spots: [[150, 28, 2], [1, 2], 'nope', [-5, 20000, 3], [10, 10, 1, 9]],
    lastHazard: 'stempel:12',
    sinceCaught: 4,
    picked: [3, 1, 1, 70, -1, 2.5, 'a'],
    kept: [],
    lost: 2,
    carried: [30, 12, 'x'],
    caughtWith: [1, 3],
    jumps: 41,
    dashes: 3,
    dwell: { 0: 9, 3: 2.4, 17: 0, abc: 5, 100: 4 },
    pauses: 1,
    away: 0,
    finishedBefore: true,
    record: 'time',
  });
  assert.equal(event.attempt, 2);
  assert.equal(event.splits, '[23,null,null,3600]', 'nonsense becomes a gap, and time is bounded');
  assert.equal(event.spots, '[[150,28,2],[0,9999,3]]', 'only triples, bounded');
  assert.equal(event.lastHazard, 'stempel:12');
  assert.equal(event.sinceCaught, 4);
  assert.equal(event.picked, '[1,3]', 'whole indices in range, once each, in order');
  assert.equal(event.kept, '[]', 'carrying nothing out is an answer');
  assert.equal(event.carried, '[30,12,0]');
  assert.equal(event.caughtWith, '[1,3]');
  assert.deepEqual([event.lost, event.jumps, event.dashes, event.pauses, event.away], [2, 41, 3, 1, 0]);
  assert.equal(event.dwell, '{"0":9,"3":2}', 'ledge numbers only, and no empty seconds');
  assert.equal(event.finishedBefore, 1);
  assert.equal(event.record, 'time');

  const odd = normaliseEvent({
    type: 'run_ended',
    cause: 'abandoned',
    lastHazard: 'DROP TABLE',
    record: 'time',
    spots: 'many',
    dwell: [1, 2],
    finishedBefore: 'yes',
    jumps: null,
  });
  assert.equal(odd.lastHazard, null);
  assert.equal(odd.record, null, 'only a finish can set a record');
  assert.equal(odd.spots, null);
  assert.equal(odd.dwell, null);
  assert.equal(odd.finishedBefore, null);
  assert.equal(odd.jumps, null, 'missing stays missing');

  // A list cannot be used to store an essay either.
  const long = normaliseEvent({ type: 'run_ended', spots: Array.from({ length: 500 }, () => [1, 1, 1]) });
  assert.equal(JSON.parse(long.spots).length, 30);
  assert.equal(normaliseEvent({ type: 'run_started', attempt: 0 }).attempt, 1);
  assert.equal(normaliseEvent({ type: 'visit', attempt: 3 }).attempt, null, 'a visit is not a run');
});

test('the statistics say how runs were played', () => {
  const store = openStore(':memory:');
  const now = Date.now();
  const add = (event) => store.insert(normaliseEvent(event), now);

  for (const attempt of [1, 1, 1, 2, 6]) add({ type: 'run_started', attempt });
  const play = { type: 'run_ended', deaths: 0, pauses: 0, away: 0, finishedBefore: false };
  // A clean finish on the first try, with two envelopes carried out.
  add({
    ...play,
    cause: 'finished',
    attempt: 1,
    duration: 90,
    checkpoint: 2,
    splits: [30, 60],
    picked: [0, 1],
    kept: [0, 1],
    lost: 0,
    carried: [40, 30, 20],
    caughtWith: [0, 0, 0],
    jumps: 40,
    dashes: 2,
    dwell: { 0: 10, 11: 4 },
    record: 'both',
  });
  // A finish by someone who had finished before, slower, caught twice on the way.
  add({
    ...play,
    cause: 'finished',
    attempt: 2,
    duration: 150,
    checkpoint: 2,
    splits: [50, 100],
    spots: [
      [150, 312, 1],
      [151, 313, 1],
    ],
    lastHazard: 'stempel:12',
    sinceCaught: 60,
    picked: [0],
    kept: [0],
    lost: 1,
    carried: [60, 80, 0],
    caughtWith: [0, 2, 0],
    jumps: 60,
    dashes: 0,
    dwell: { 11: 8 },
    pauses: 1,
    finishedBefore: true,
  });
  // Left right after the stamp caught them, past the first machine.
  add({
    ...play,
    cause: 'abandoned',
    attempt: 1,
    duration: 70,
    checkpoint: 1,
    splits: [40, null],
    spots: [[140, 310, 0]],
    lastHazard: 'stempel:12',
    sinceCaught: 3,
    picked: [],
    kept: [],
    lost: 0,
    carried: [69, 0, 0],
    caughtWith: [1, 0, 0],
    jumps: 20,
    dashes: 0,
    away: 2,
  });
  // Left in the lobby, never caught.
  add({
    ...play,
    cause: 'abandoned',
    attempt: 6,
    duration: 10,
    checkpoint: 0,
    splits: [null, null],
    picked: [1],
    kept: [1],
    lost: 0,
    carried: [5, 5, 0],
    caughtWith: [0, 0, 0],
    jumps: 4,
    dashes: 1,
  });
  // A run from before the details were sent: counted in the totals only.
  add({ type: 'run_ended', cause: 'abandoned', duration: 5, checkpoint: 0 });

  const stats = store.stats(7);

  assert.deepEqual(stats.route, {
    runs: 4,
    stretches: [
      { to: 1, reached: 3, seconds: 40 },
      { to: 2, reached: 2, seconds: 40 },
      { to: 'door', reached: 2, seconds: 40 },
    ],
  });

  // The two catches on the stamp's desk share a square; the third is beside it.
  assert.deepEqual(stats.spots, [
    { x: 148, y: 316, n: 2 },
    { x: 140, y: 308, n: 1 },
  ]);

  assert.deepEqual(stats.carrying, [
    { envelopes: 0, seconds: 174, catches: 1 },
    { envelopes: 1, seconds: 115, catches: 2 },
    { envelopes: 2, seconds: 20, catches: 0 },
  ]);

  assert.deepEqual(stats.lastCatch, {
    left: 2,
    uncaught: 1,
    soon: 15,
    hazards: [{ hazard: 'stempel:12', runs: 1, soon: 1, kind: 'stempel', ledge: 12 }],
  });

  assert.deepEqual(stats.envelopes, {
    runs: 4,
    finished: 2,
    lost: 1,
    lostRuns: 1,
    list: [
      { envelope: 0, picked: 2, kept: 2 },
      { envelope: 1, picked: 2, kept: 1 },
    ],
  });

  assert.deepEqual(stats.moves, { runs: 4, dashed: 2, jumps: 30, dashes: 1 });
  assert.deepEqual(stats.dwell, [
    { ledge: 0, runs: 1, total: 10, seconds: 10 },
    { ledge: 11, runs: 2, total: 12, seconds: 6 },
  ]);
  assert.deepEqual(stats.breaks, { runs: 4, paused: 1, away: 1 });

  assert.deepEqual(stats.attempts, [
    { from: 1, to: 1, started: 3, ended: 2, finished: 1 },
    { from: 2, to: 2, started: 1, ended: 1, finished: 1 },
    { from: 3, to: 3, started: 0, ended: 0, finished: 0 },
    { from: 4, to: 4, started: 0, ended: 0, finished: 0 },
    { from: 5, to: null, started: 1, ended: 1, finished: 0 },
  ]);

  assert.deepEqual(stats.returning, {
    new: { runs: 3, finished: 1, records: 1 },
    returning: { runs: 1, finished: 1, records: 0 },
  });
  store.close();
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

  assert.equal(stats.format, 5);
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
  assert.deepEqual(stats.route, { runs: 0, stretches: [] });
  for (const list of ['spots', 'carrying', 'dwell']) assert.deepEqual(stats[list], [], list);
  assert.deepEqual(stats.lastCatch, { left: 0, uncaught: 0, soon: 15, hazards: [] });
  assert.deepEqual(stats.envelopes, { runs: 0, finished: 0, lost: 0, lostRuns: 0, list: [] });
  assert.deepEqual(stats.moves, { runs: 0, dashed: 0, jumps: null, dashes: null });
  assert.deepEqual(stats.breaks, { runs: 0, paused: 0, away: 0 });
  assert.equal(stats.attempts.length, 5);
  assert.ok(stats.attempts.every((row) => row.started === 0 && row.ended === 0));
  assert.deepEqual(stats.returning, {
    new: { runs: 0, finished: 0, records: 0 },
    returning: { runs: 0, finished: 0, records: 0 },
  });
  for (const list of ['browsers', 'systems', 'forms', 'models', 'zones']) assert.deepEqual(stats[list], [], list);
  assert.deepEqual(
    stats.widths.map((row) => row.n),
    [0, 0, 0, 0],
  );
  assert.deepEqual(stats.visitors, { installed: { said: 0, yes: 0 }, finishedBefore: { said: 0, yes: 0 } });
  assert.equal(stats.hours.length, 24);
  assert.equal(stats.weekdays.length, 7);
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
