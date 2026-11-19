import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';

import { Climb } from '../src/core/climb.ts';
import type { Game } from '../src/core/game.ts';
import { KELURAHAN } from '../src/core/tower.ts';
import type { FloorDef } from '../src/core/types.ts';
import { bestStore } from '../src/platform/storage.ts';
import { STEP } from './helpers.ts';

/** The second floor's rules can be tested before its real route is built. */
const SECOND: FloorDef = {
  id: 'kecamatan',
  name: 'Kecamatan',
  height: 120,
  ledges: [{ x: 0, y: 0, w: 384 }],
  auditors: [],
  stamps: [],
  amplop: [{ x: 100, y: 12 }],
  checkpoints: [{ ledge: 0, x: 40 }],
  exit: { ledge: 0, x: 200 },
};
const FLOORS = [KELURAHAN, SECOND] as const;
const KELURAHAN_KEY = 'korupsi.kelurahan.best';
const KECAMATAN_KEY = 'korupsi.kecamatan.best';

function browserStorage(t: TestContext, initial: Record<string, string> = {}): Map<string, string> {
  const values = new Map(Object.entries(initial));
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });
  return values;
}

function finish(game: Game): void {
  const { ledge, x } = game.floor.exit;
  game.placeOn(ledge, x);
  game.step(STEP);
  assert.equal(game.phase, 'won');
}

function takeLobbyEnvelope(game: Game): number {
  game.placeOn(0, game.floor.amplop[0].x);
  game.step(STEP);
  assert.equal(game.weight, 1);
  return game.money;
}

test('finishing Kelurahan unlocks Kecamatan even if the page closes before promotion', (t) => {
  const data = browserStorage(t);
  const climb = new Climb(FLOORS, bestStore);
  assert.equal(climb.highestUnlocked, 1);
  assert.equal(climb.startAt(2), false);
  assert.equal(climb.startAt(1), true);
  assert.equal(climb.promote(), false, 'the first floor has not been finished');
  finish(climb.game);
  assert.equal(climb.highestUnlocked, 2);
  assert.ok(data.has(KELURAHAN_KEY));

  const reopened = new Climb(FLOORS, bestStore);
  assert.equal(reopened.highestUnlocked, 2);
  assert.equal(reopened.startAt(2), true);
  assert.equal(reopened.game.floor, SECOND);
  assert.equal(reopened.game.phase, 'playing');
});

test('promotion pays the money in but starts the next floor with an empty bag', (t) => {
  browserStorage(t);
  const climb = new Climb(FLOORS, bestStore);
  climb.game.start();
  const money = takeLobbyEnvelope(climb.game);
  finish(climb.game);

  assert.equal(climb.promote(), true);
  assert.equal(climb.number, 2);
  assert.equal(climb.game.floor, SECOND);
  assert.equal(climb.game.phase, 'playing');
  assert.equal(climb.game.weight, 0);
  assert.equal(climb.game.time, 0);
  assert.equal(climb.game.money, 0, 'the second floor has its own score');
  assert.equal(climb.money, money, 'the climb keeps the money from Kelurahan');
  assert.equal(climb.promote(), false, 'cannot pay twice or step past the last floor');

  takeLobbyEnvelope(climb.game);
  finish(climb.game);
  assert.equal(climb.promote(), false);
  assert.equal(climb.money, 2 * money);
  assert.equal(bestStore(SECOND.id).read().money, money, 'only this floor counts for its record');
  assert.equal(climb.startAt(2), true);
  assert.equal(climb.money, 0, 'entry from the title starts a new climb');
});

test('an existing v0.8.0 Kelurahan record opens Kecamatan without being rewritten', (t) => {
  const old = JSON.stringify({ time: 180, money: 2_500_000 });
  const data = browserStorage(t, { [KELURAHAN_KEY]: old });
  const climb = new Climb(FLOORS, bestStore);
  assert.equal(climb.highestUnlocked, 2);
  assert.equal(climb.startAt(2), true);
  assert.equal(climb.game.floor, SECOND);
  assert.equal(climb.game.time, 0);
  assert.equal(climb.game.deaths, 0);
  assert.equal(climb.money, 0);
  assert.deepEqual(climb.game.best, { time: 0, money: 0 });
  finish(climb.game);
  assert.ok(data.has(KECAMATAN_KEY));
  assert.equal(data.get(KELURAHAN_KEY), old);
  assert.equal(climb.startAt(1), true, 'Kelurahan remains available to replay');
});

test('unreadable or incomplete records do not count as a finish', (t) => {
  const data = browserStorage(t, { 'korupsi.best': '{"time":1,"money":0}' });
  for (const record of [undefined, '{bad JSON', '{"time":0,"money":500000}', '{"time":-1}', '{"time":true}']) {
    if (record === undefined) data.delete(KELURAHAN_KEY);
    else data.set(KELURAHAN_KEY, record);
    const climb = new Climb(FLOORS, bestStore);
    assert.equal(climb.highestUnlocked, 1);
    assert.equal(climb.startAt(2), false);
  }
});
