import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { FLOOR_FILE, floorPlan } from '../scripts/floor.mjs';
import { openStore } from '../server/store.mjs';
import { FLOORS } from '../src/core/tower.ts';

test('the panel draws the floor the game plays', () => {
  const drawn = JSON.parse(readFileSync(FLOOR_FILE, 'utf8'));
  assert.deepEqual(drawn, floorPlan(FLOORS[0]), 'server/floor.json is out of date: run node scripts/floor.mjs');
});

test('the statistics carry the floor they are about', () => {
  const store = openStore(':memory:');
  assert.deepEqual(store.stats(1).floor, floorPlan(FLOORS[0]));
  store.close();
});
