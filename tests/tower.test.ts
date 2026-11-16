import assert from 'node:assert/strict';
import test from 'node:test';

import { PARAMS, PLAYER, WORLD_WIDTH } from '../src/core/params.ts';
import { AUDITOR, auditorAt, FLOORS, KELURAHAN, ledgeX, STAMP, stampAt, stampBites } from '../src/core/tower.ts';
import { Game } from '../src/core/game.ts';
import { canReach, climbTo, quietGame, run, STEP } from './helpers.ts';

/** The way up, ledge by ledge. */
const ROUTE = [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20];
/** Side trips for an envelope, there and back. */
const BRANCHES: [number, number][] = [
  [6, 7],
  [7, 6],
  [15, 16],
  [16, 15],
];

const FULL = KELURAHAN.amplop.length;

test('every floor is well formed', () => {
  for (const floor of FLOORS) {
    const ground = floor.ledges[0];
    assert.ok(ground && ground.x === 0 && ground.y === 0 && ground.w === WORLD_WIDTH, 'ledge 0 is the ground floor');

    for (const [i, ledge] of floor.ledges.entries()) {
      const travel = ledge.kind === 'troli' ? (ledge.travel ?? 0) : 0;
      assert.ok(
        ledge.x - travel >= 0 && ledge.x + ledge.w + travel <= WORLD_WIDTH,
        `ledge ${i} stays inside the walls`,
      );
      assert.ok(ledge.y >= 0 && ledge.y < floor.height, `ledge ${i} is inside the floor`);
    }
    for (const a of floor.auditors) {
      const ledge = floor.ledges[a.ledge];
      assert.ok(
        ledge && a.from >= ledge.x + 4 && a.to <= ledge.x + ledge.w - 4 && a.from < a.to,
        'an auditor stays on its ledge',
      );
    }
    for (const s of floor.stamps) {
      const ledge = floor.ledges[s.ledge];
      assert.ok(
        ledge && s.x - STAMP.w / 2 >= ledge.x && s.x + STAMP.w / 2 <= ledge.x + ledge.w,
        'a stamp lands on its ledge',
      );
    }
    for (const spot of [...floor.checkpoints, floor.exit]) {
      const ledge = floor.ledges[spot.ledge];
      assert.ok(ledge && spot.x > ledge.x && spot.x < ledge.x + ledge.w, 'a checkpoint or exit sits on its ledge');
      assert.notEqual(ledge.kind, 'fiktif');
      assert.notEqual(ledge.kind, 'troli');
    }
  }
});

test('the envelope count is what the jump floor was built for', () => {
  assert.ok(1 - PARAMS.weightPenalty * FULL >= PARAMS.minFactor, 'a full bag is not below the minimum factor');
});

test('the route can be climbed with an empty bag', () => {
  for (let i = 0; i + 1 < ROUTE.length; i++) {
    const [from, to] = [ROUTE[i] as number, ROUTE[i + 1] as number];
    assert.ok(canReach(KELURAHAN, from, to, 0), `ledge ${from} to ${to}`);
  }
});

test('the route can be climbed with every envelope in the bag', () => {
  for (let i = 0; i + 1 < ROUTE.length; i++) {
    const [from, to] = [ROUTE[i] as number, ROUTE[i + 1] as number];
    assert.ok(canReach(KELURAHAN, from, to, FULL), `ledge ${from} to ${to}`);
  }
});

test('every envelope branch can be taken and left, even with a full bag', () => {
  for (const [from, to] of BRANCHES) {
    assert.ok(canReach(KELURAHAN, from, to, FULL), `ledge ${from} to ${to}`);
  }
});

test('no ledge on the route can be skipped', () => {
  for (let i = 0; i + 2 < ROUTE.length; i++) {
    const [from, to] = [ROUTE[i] as number, ROUTE[i + 2] as number];
    assert.ok(!canReach(KELURAHAN, from, to, 0), `ledge ${from} reaches ${to}, skipping ${ROUTE[i + 1]}`);
  }
});

test('the gap after the first stamp needs a dash', () => {
  assert.ok(!canReach(KELURAHAN, 13, 14, 0, { dash: false }));
  assert.ok(canReach(KELURAHAN, 13, 14, FULL));
});

/**
 * The jump most players make from ledge `from`: run to its end on the `dir`
 * side, jump there holding the button for `hold` seconds, and keep steering.
 * Returns where the player lands.
 */
function runningJump(from: number, dir: -1 | 1, hold: number, weight: number): { ledge: number; x: number } {
  const ledge = KELURAHAN.ledges[from];
  assert.ok(ledge);
  const game = quietGame(KELURAHAN);
  game.weight = weight;
  game.placeOn(from, ledge.x + ledge.w / 2);
  const edge = dir < 0 ? ledge.x + 2 : ledge.x + ledge.w - 2;
  let jumpedAt = -1;
  let airborne = false;
  for (let i = 0; i < 600; i++) {
    const t = i * STEP;
    if (jumpedAt < 0 && (dir < 0 ? game.player.x <= edge : game.player.x >= edge)) jumpedAt = t;
    game.step(STEP, { move: dir, jump: jumpedAt >= 0 && t - jumpedAt < hold, dash: false });
    if (game.player.ground < 0) airborne = true;
    else if (airborne) break;
  }
  return { ledge: game.player.ground, x: game.player.x };
}

test('a running jump onto the first auditor or the first stamp lands out of reach', () => {
  // The first numbers (2026-11-16) found both catching players where the jump
  // towards them comes down. By the fiktif ledge a player can carry three
  // envelopes, by the first machine four.
  const auditor = KELURAHAN.auditors.find((a) => a.ledge === 10);
  const stamp = KELURAHAN.stamps.find((s) => s.ledge === 12);
  assert.ok(auditor && stamp);
  for (const hold of [1, 0.25, 0.12]) {
    for (const weight of [0, 3]) {
      const desk = runningJump(9, 1, hold, weight);
      assert.equal(desk.ledge, 10, `the jump to the auditor's desk, held ${hold} s with ${weight} envelopes`);
      const reach = auditor.from - AUDITOR.half - PLAYER.half;
      assert.ok(desk.x <= reach, `it lands at ${desk.x.toFixed(0)}, in the auditor's reach from ${reach}`);
    }
    for (const weight of [0, 4]) {
      const under = runningJump(11, -1, hold, weight);
      assert.equal(under.ledge, 12, `the jump to the stamp's desk, held ${hold} s with ${weight} envelopes`);
      const reach = stamp.x + STAMP.w / 2 + PLAYER.half - 1;
      assert.ok(under.x >= reach, `it lands at ${under.x.toFixed(0)}, under the stamp, which reaches ${reach}`);
    }
  }
});

test('a jump from the first machine towards the stamp lands on its desk', () => {
  // An OTT puts the player back at the machine. A jump straight from there
  // used to fall short of the desk and through the tape, back to the machine.
  const machine = KELURAHAN.checkpoints[1];
  assert.ok(machine && machine.ledge === 11);
  for (const hold of [1, 0.25]) {
    for (const weight of [0, 4]) {
      const game = quietGame(KELURAHAN);
      game.weight = weight;
      game.placeOn(machine.ledge, machine.x);
      let airborne = false;
      for (let i = 0; i < 600; i++) {
        game.step(STEP, { move: -1, jump: i * STEP < hold, dash: false });
        if (game.player.ground < 0) airborne = true;
        else if (airborne) break;
      }
      assert.equal(game.player.ground, 12, `held ${hold} s with ${weight} envelopes`);
    }
  }
});

test('every envelope can be touched from a ledge', () => {
  // An envelope is within a jump of some ledge: no higher than a full-bag
  // jump above it, and over it or just beside it.
  const rise = (PARAMS.jumpV * PARAMS.minFactor) ** 2 / (2 * PARAMS.gravity);
  for (const [i, a] of KELURAHAN.amplop.entries()) {
    const near = KELURAHAN.ledges.some((ledge) => {
      const travel = ledge.kind === 'troli' ? (ledge.travel ?? 0) : 0;
      const over = a.x >= ledge.x - travel - 8 && a.x <= ledge.x + ledge.w + travel + 8;
      return over && a.y >= ledge.y && a.y - 28 <= ledge.y + rise;
    });
    assert.ok(near, `envelope ${i} at ${a.x},${a.y}`);
  }
});

test('a troli rolls around its base and an auditor walks its beat', () => {
  const troli = KELURAHAN.ledges[5];
  assert.ok(troli?.kind === 'troli' && troli.travel);
  const xs = Array.from({ length: 200 }, (_, i) => ledgeX(troli, i * 0.05));
  assert.ok(Math.min(...xs) >= troli.x - troli.travel - 1e-9 && Math.max(...xs) <= troli.x + troli.travel + 1e-9);
  assert.ok(Math.max(...xs) - Math.min(...xs) > troli.travel * 1.9, 'it uses its whole track');

  const def = KELURAHAN.auditors[0];
  assert.ok(def);
  for (let t = 0; t < 30; t += 0.07) {
    const a = auditorAt(def, t);
    assert.ok(a.x >= def.from - 1e-9 && a.x <= def.to + 1e-9);
  }
});

test('a stamp warns before it bites, and rests long enough to walk under', () => {
  for (const def of KELURAHAN.stamps) {
    let previous = stampAt(def, 0).phase;
    let rest = 0;
    for (let t = 0; t < def.period * 2; t += 1 / 120) {
      const state = stampAt(def, t);
      if (state.phase === 'slam' && previous !== 'slam') assert.equal(previous, 'warn', 'the slam follows the warning');
      if (!stampBites(state)) rest += 1 / 120;
      previous = state.phase;
    }
    // Walking under the stamp takes about half a second.
    const walk = (STAMP.w + 12) / PARAMS.runSpeed;
    assert.ok(rest / 2 > walk * 2, 'there is time to cross');
  }
});

test('a careful player finishes the floor with the hazards on', () => {
  let game: Game | null = new Game();
  game.start();
  for (const next of ROUTE.slice(1)) {
    const from: number = game.player.ground;
    game = climbTo(game, next);
    assert.ok(game, `no safe way from ledge ${from} to ${next}`);
  }
  // The door is at the far end of the last ledge.
  run(game, 3, { move: 1, jump: false, dash: false });
  assert.equal(game.phase, 'won');
  assert.equal(game.deaths, 0);
  assert.ok(game.time < 120, `a clean climb takes ${game.time.toFixed(0)} s`);
});
