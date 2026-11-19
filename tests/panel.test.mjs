import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { FLOOR_FILE, floorPlan } from '../scripts/floor.mjs';
import { normaliseEvent, openStore } from '../server/store.mjs';
import { FLOORS } from '../src/core/tower.ts';

test('the panel draws the floor the game plays', () => {
  const drawn = JSON.parse(readFileSync(FLOOR_FILE, 'utf8'));
  assert.deepEqual(drawn, FLOORS.map(floorPlan), 'server/floor.json is out of date: run node scripts/floor.mjs');
});

test('the statistics carry the floor they are about', () => {
  const store = openStore(':memory:');
  assert.deepEqual(store.stats(1).floor, floorPlan(FLOORS[0]));
  assert.deepEqual(store.stats(1, null, 'kecamatan').floor, floorPlan(FLOORS[1]));
  assert.deepEqual(store.stats(1, null, 'other').floor, floorPlan(FLOORS[0]));
  store.close();
});

test('floor reports do not mix catches, starts, resumes or shares across floors', () => {
  const store = openStore(':memory:');
  const add = (input) => store.insert(normaliseEvent(input));
  const floor = 'kecamatan';
  add({ type: 'visit', device: 'touch' });
  add({ type: 'run_started', attempt: 1, device: 'touch', rev: 'old' });
  add({ type: 'run_ended', cause: 'finished', jumps: 12, hazards: { 'stempel:12': 2 }, spots: [[120, 312, 0]] });
  add({ type: 'run_started', floor, after: 'promotion', wait: 3, attempt: 2, device: 'touch' });
  add({
    type: 'run_ended',
    floor,
    cause: 'abandoned',
    jumps: 3,
    hazards: { 'berkas:7': 1 },
    lastHazard: 'berkas:7',
    spots: [[216, 306, 0]],
    checkpoint: 1,
    attempt: 2,
  });
  add({ type: 'run_resumed', floor, cause: 'finished' });
  add({ type: 'shared', floor, via: 'saved' });
  assert.equal(normaliseEvent({ type: 'run_started', floor: 'unknown' }), null);
  assert.equal(normaliseEvent({ type: 'visit', floor }).floor, null);

  const kelurahan = store.stats(1);
  const kecamatan = store.stats(1, null, floor);
  assert.deepEqual(kelurahan.totals, { visits: 1, runs: 1, ended: 1, finished: 1, shared: 0, errors: 0 });
  assert.deepEqual(kecamatan.totals, { visits: 1, runs: 1, ended: 1, finished: 0, shared: 1, errors: 0 });
  assert.deepEqual(
    kelurahan.hazards.map((row) => row.hazard),
    ['stempel:12'],
  );
  assert.deepEqual(
    kecamatan.hazards.map((row) => row.hazard),
    ['berkas:7'],
  );
  assert.deepEqual(kecamatan.spots, [{ x: 220, y: 308, n: 1 }]);
  assert.equal(kecamatan.floor.ledges[1].liftTo, 114);
  assert.equal(kecamatan.lastCatch.hazards[0].kind, 'berkas');
  assert.equal(kecamatan.attempts[0].started, 0);
  assert.equal(kecamatan.attempts[1].started, 1);
  assert.equal(kelurahan.breaks.finishedAfter, 0);
  assert.equal(kecamatan.breaks.finishedAfter, 1);
  assert.deepEqual(kecamatan.cards.promotions, { runs: 1, wait: 3 });
  assert.deepEqual(kecamatan.revs, kelurahan.revs, 'build shares cover the whole game');
  store.close();
});
