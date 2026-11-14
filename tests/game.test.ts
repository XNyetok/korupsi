import assert from 'node:assert/strict';
import test from 'node:test';

import { clock, Game, jumpFactor, rupiah } from '../src/core/game.ts';
import { PARAMS } from '../src/core/params.ts';
import { MAX_SPOTS, runReport } from '../src/core/report.ts';
import { auditorAt, KELURAHAN, ledgeX, STAMP, stampAt } from '../src/core/tower.ts';
import type { Best, FloorDef, Input } from '../src/core/types.ts';
import { idle, jumpApex, quietGame, run, STEP } from './helpers.ts';

const hold = (input: Partial<Input>): Input => ({ ...idle, ...input });

/** A floor with one of everything, small enough to reason about by hand. */
const YARD: FloorDef = {
  name: 'Yard',
  height: 300,
  ledges: [
    { x: 0, y: 0, w: 384 },
    { x: 100, y: 28, w: 80 },
    { x: 220, y: 28, w: 40, kind: 'fiktif' },
    { x: 60, y: 120, w: 120 },
    { x: 280, y: 28, w: 40, kind: 'troli', travel: 20, period: 2 },
  ],
  auditors: [{ ledge: 0, from: 300, to: 340, speed: 20 }],
  stamps: [{ ledge: 1, x: 150, period: 2.4, offset: 0 }],
  amplop: [
    { x: 60, y: 12 },
    { x: 40, y: 12 },
  ],
  checkpoints: [
    { ledge: 0, x: 20 },
    { ledge: 3, x: 80 },
  ],
  exit: { ledge: 3, x: 170 },
};

function yard(): Game {
  const game = new Game({ floor: YARD });
  game.start();
  return game;
}

/** Steps until `done` says so, or fails the test after `limit` seconds. */
function until(game: Game, done: () => boolean, input: Input = idle, limit = 10): void {
  for (let t = 0; t < limit; t += STEP) {
    if (done()) return;
    game.step(STEP, input);
  }
  assert.fail('the moment never came');
}

test('nothing moves before the run starts', () => {
  const game = new Game();
  run(game, 1, hold({ move: 1, jump: true }));
  assert.equal(game.phase, 'ready');
  assert.equal(game.time, 0);
  assert.equal(game.player.x, KELURAHAN.checkpoints[0]?.x);
});

test('a full jump clears one ledge and never two', () => {
  const apex = jumpApex(0);
  assert.ok(apex > 46 && apex < 54, `apex ${apex.toFixed(1)}`);
});

test('every envelope shortens the jump, down to the floor', () => {
  assert.ok(jumpApex(3) < jumpApex(0));
  assert.ok(jumpApex(6) < jumpApex(3));
  assert.equal(jumpFactor(1000), PARAMS.minFactor);
  assert.equal(jumpApex(1000), jumpApex(Math.ceil((1 - PARAMS.minFactor) / PARAMS.weightPenalty)));
});

test('letting go early makes a short hop', () => {
  const game = quietGame();
  let apex = 0;
  for (let i = 0; i < 120; i++) {
    game.step(STEP, hold({ jump: i < 8 }));
    apex = Math.max(apex, game.player.y);
  }
  assert.ok(apex > 6 && apex < jumpApex(0) * 0.6, `apex ${apex.toFixed(1)}`);
});

test('a held jump does not repeat on landing', () => {
  const game = quietGame();
  run(game, 2, hold({ jump: true }));
  assert.equal(game.player.ground, 0);
  assert.equal(game.drain().filter((e) => e.type === 'jump').length, 1);
});

test('a jump pressed just before landing still happens', () => {
  const game = quietGame();
  game.step(STEP, hold({ jump: true }));
  until(game, () => game.player.vy < 0 && game.player.y < 4);
  game.drain();
  game.step(STEP, hold({ jump: true }));
  run(game, 0.2, hold({ jump: true }));
  assert.equal(game.drain().filter((e) => e.type === 'jump').length, 1, 'the early press was kept for the landing');
});

test('a jump just after walking off a ledge still counts', () => {
  const game = quietGame(YARD);
  game.placeOn(1, 178);
  until(game, () => game.player.ground < 0, hold({ move: 1 }));
  run(game, PARAMS.coyote * 0.5, hold({ move: 1 }));
  game.step(STEP, hold({ move: 1, jump: true }));
  assert.ok(game.player.vy > 0, 'coyote time allowed the jump');

  const late = quietGame(YARD);
  late.placeOn(1, 178);
  until(late, () => late.player.ground < 0, hold({ move: 1 }));
  run(late, PARAMS.coyote * 1.5, hold({ move: 1 }));
  late.step(STEP, hold({ move: 1, jump: true }));
  assert.ok(late.player.vy <= 0, 'too late is too late');
});

test('running reaches top speed and stops quickly', () => {
  const game = quietGame();
  run(game, 0.5, hold({ move: 1 }));
  assert.equal(game.player.vx, PARAMS.runSpeed);
  assert.equal(game.player.facing, 1);
  run(game, 0.2);
  assert.equal(game.player.vx, 0);
});

test('the walls stop the player', () => {
  const game = quietGame();
  run(game, 6, hold({ move: -1 }));
  assert.ok(game.player.x >= 5 && game.player.x < 6);
});

test('a dash is level, faster than a run, and once per time in the air', () => {
  const game = quietGame();
  game.step(STEP, hold({ jump: true }));
  run(game, 0.15, hold({ jump: true }));
  const y = game.player.y;
  const x = game.player.x;

  game.step(STEP, hold({ jump: true, dash: true, move: 1 }));
  run(game, PARAMS.dashTime - 2 * STEP, hold({ jump: true, dash: true, move: 1 }));
  assert.ok(Math.abs(game.player.y - y) < 0.001, 'a dash does not rise or fall');
  assert.ok(game.player.x - x > PARAMS.runSpeed * PARAMS.dashTime * 1.8, 'a dash covers ground');

  // A second press in the same flight does nothing, even with the cooldown over.
  run(game, 0.05, hold({ move: 1 }));
  game.drain();
  assert.equal(game.player.ground, -1);
  game.player.dashCool = 0;
  game.step(STEP, hold({ move: 1, dash: true }));
  assert.equal(game.drain().filter((e) => e.type === 'dash').length, 0);

  until(game, () => game.player.ground >= 0);
  run(game, PARAMS.dashCooldown);
  game.step(STEP, hold({ dash: true }));
  assert.equal(game.drain().filter((e) => e.type === 'dash').length, 1, 'landing gives the dash back');
});

test('an envelope adds weight and money', () => {
  const game = quietGame(YARD);
  run(game, 1, hold({ move: 1 }));
  assert.equal(game.weight, 2);
  assert.equal(game.money, 2 * PARAMS.moneyValue);
  assert.deepEqual(game.taken, [true, true]);
});

test('an auditor catches a walker, and a dash slips past', () => {
  const caught = yard();
  caught.placeOn(0, 270);
  until(caught, () => caught.deaths > 0, hold({ move: 1 }));
  assert.equal(caught.cause, 'auditor');

  const slipped = yard();
  slipped.placeOn(0, 270);
  until(
    slipped,
    () => auditorAt(YARD.auditors[0] as FloorDef['auditors'][number], slipped.worldTime).x - slipped.player.x < 14,
    hold({ move: 1 }),
  );
  slipped.step(STEP, hold({ move: 1, dash: true }));
  run(slipped, 0.5, hold({ move: 1 }));
  assert.equal(slipped.deaths, 0);
  assert.ok(slipped.player.x > 340, 'and came out the other side');
});

test('the stamp only bites on the way down and on the desk', () => {
  const def = YARD.stamps[0] as FloorDef['stamps'][number];

  const under = yard();
  under.placeOn(1, def.x);
  until(under, () => stampAt(def, under.worldTime).phase === 'warn');
  assert.equal(under.deaths, 0, 'standing under a raised stamp is safe');
  until(under, () => under.deaths > 0);
  assert.equal(under.cause, 'stempel');
  assert.ok(['slam', 'hold'].includes(stampAt(def, under.worldTime).phase));

  const beside = yard();
  beside.placeOn(1, def.x + STAMP.w / 2 + 8);
  run(beside, def.period * 2);
  assert.equal(beside.deaths, 0, 'standing beside it is safe');
});

test('a stamp announces itself: a warning, then the hit, once per cycle', () => {
  const def = YARD.stamps[0] as FloorDef['stamps'][number];
  const game = quietGame(YARD);
  run(game, def.period * 3);
  const heard = game
    .drain()
    .filter((e) => e.type === 'warn' || e.type === 'stamp')
    .map((e) => e.type);
  assert.deepEqual(heard, ['warn', 'stamp', 'warn', 'stamp', 'warn', 'stamp']);
});

test('being caught sends the player back to the checkpoint with the bag as it was', () => {
  const game = yard();
  run(game, 0.3, hold({ move: 1 }));
  assert.equal(game.weight, 1, 'one envelope before the checkpoint');

  game.placeOn(3, 80);
  game.step(STEP);
  assert.equal(game.checkpoint, 1);

  // Pick up the other one, then walk into the stamp.
  game.placeOn(0, 60);
  game.step(STEP);
  assert.equal(game.weight, 2);
  game.placeOn(1, 150);
  until(game, () => game.deaths === 1);
  assert.ok(game.caught > 0);

  const frozen = { ...game.player };
  run(game, PARAMS.caughtPause / 2, hold({ move: 1, jump: true }));
  assert.deepEqual({ ...game.player }, frozen, 'caught means held');

  run(game, PARAMS.caughtPause);
  assert.equal(game.player.ground, 3);
  assert.equal(game.player.x, 80);
  assert.equal(game.weight, 1, 'what was taken after clocking in is back on the floor');
  assert.deepEqual(game.taken, [false, true]);
  assert.ok(game.drain().some((e) => e.type === 'respawn'));
});

test('a run remembers which hazard caught the player, and reports itself', () => {
  const game = yard();
  const back = (ledge: number) => () => game.caught <= 0 && game.player.ground === ledge;

  // The stamp twice and the auditor once, from the lobby.
  game.placeOn(1, 150);
  until(game, () => game.deaths === 1);
  until(game, back(0));
  game.placeOn(1, 150);
  until(game, () => game.deaths === 2);
  until(game, back(0));
  game.placeOn(0, 320);
  until(game, () => game.deaths === 3);
  until(game, back(0));

  // Then clock in, so there is a tape to fall below, and fall below it.
  game.placeOn(3, 80);
  game.step(STEP);
  until(game, () => game.deaths === 4, hold({ move: -1 }));

  // Named by what it is and the ledge it is on, the way the tower names them.
  assert.deepEqual(game.catches, { 'stempel:1': 2, 'auditor:0': 1, jatuh: 1 });

  const left = runReport(game, 'abandoned');
  assert.equal(left.cause, 'abandoned');
  assert.equal(left.deaths, 4);
  assert.equal(left.checkpoint, 1);
  assert.deepEqual(left.hazards, { 'stempel:1': 2, 'auditor:0': 1, jatuh: 1 });
  assert.equal(left.title, undefined, 'only a finished run earns a title');
  assert.equal(left.duration, Math.round(game.time));

  until(game, back(3));
  game.placeOn(3, 165);
  run(game, 1, hold({ move: 1 }));
  assert.equal(game.phase, 'won');
  const done = runReport(game, 'finished');
  // Caught four times with an empty bag.
  assert.equal(done.title, 'kosong');
  assert.equal(done.height, game.heightMetres);

  // A new run starts with a clean sheet.
  game.start();
  assert.deepEqual(game.catches, {});
  assert.equal(runReport(game, 'abandoned').deaths, 0);
});

test('a run logs how it was played, and reports it', () => {
  let saved: Best | null = null;
  const store = { read: () => saved ?? { time: 0, money: 0 }, write: (best: Best) => (saved = best) };
  const game = new Game({ floor: YARD, store });
  game.start();
  assert.equal(game.log.finishedBefore, false, 'the floor was never finished on this device');

  // One envelope in the lobby, a jump and a dash.
  run(game, 0.3, hold({ move: 1 }));
  assert.deepEqual(game.log.picked, [false, true]);
  game.step(STEP, hold({ jump: true }));
  until(game, () => game.player.ground >= 0);
  run(game, PARAMS.dashCooldown);
  game.step(STEP, hold({ dash: true, move: -1 }));
  until(game, () => game.player.dashT <= 0);
  assert.equal(game.log.jumps, 1);
  assert.equal(game.log.dashes, 1);

  // Clock in and wait at the machine.
  game.placeOn(3, 80);
  game.step(STEP);
  const clockedIn = game.time;
  assert.deepEqual(game.log.splits, [clockedIn]);
  run(game, 1.5);

  // The other envelope lies below the audit tape now: picking it up is a fall,
  // so the catch comes with both envelopes in the bag, and the new one goes back.
  game.placeOn(0, 60);
  game.step(STEP);
  assert.equal(game.deaths, 1);
  const caughtAt = game.time;
  assert.deepEqual(game.log.spots, [[60, 0, 2]]);
  assert.equal(game.log.lastHazard, 'jatuh');
  assert.deepEqual(game.log.caughtWith, [0, 0, 1], 'caught carrying two');
  run(game, PARAMS.caughtPause + 2 * STEP);
  assert.equal(game.weight, 1);
  assert.equal(game.log.lost, 1);

  // Free time is counted by what was carried; the pause after the catch is not.
  const free = game.log.carried.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(free - (game.time - PARAMS.caughtPause)) < 3 * STEP, `${free} of ${game.time}`);
  assert.ok((game.log.dwell[3] ?? 0) >= 1.5, 'standing at the machine counts on its ledge');

  game.placeOn(3, 165);
  run(game, 1, hold({ move: 1 }));
  assert.equal(game.phase, 'won');

  const report = runReport(game, 'finished');
  assert.deepEqual(report.splits, [Math.round(clockedIn)]);
  assert.deepEqual(report.spots, [[60, 0, 2]]);
  assert.equal(report.lastHazard, 'jatuh');
  assert.equal(report.sinceCaught, Math.round(game.time - caughtAt));
  assert.deepEqual(report.picked, [0, 1]);
  assert.deepEqual(report.kept, [1]);
  assert.equal(report.lost, 1);
  assert.equal(report.carried.length, 3, 'one entry per possible weight, nothing to two');
  assert.deepEqual(report.caughtWith, [0, 0, 1]);
  assert.equal(report.jumps, 1);
  assert.equal(report.dashes, 1);
  assert.ok((report.dwell['3'] ?? 0) >= 2, 'whole seconds, rounded');
  assert.ok(
    Object.values(report.dwell).every((s) => s >= 1),
    'only ledges stood on for a second or more',
  );
  assert.equal(report.finishedBefore, false);
  assert.equal(report.record, 'both', 'the first finish sets both records');

  // The next run starts a clean log, from a player who has now finished here.
  game.start();
  assert.equal(game.log.finishedBefore, true);
  const fresh = runReport(game, 'abandoned');
  assert.deepEqual(fresh.splits, [null]);
  assert.deepEqual(fresh.spots, []);
  assert.deepEqual(fresh.picked, []);
  assert.equal(fresh.lastHazard, undefined);
  assert.equal(fresh.record, undefined, 'only a finish can set a record');
});

test('a run with many catches reports an even sample of where they were', () => {
  const game = yard();
  for (let i = 0; i < 100; i++) game.log.spots.push([i, i, 0]);
  const spots = runReport(game, 'abandoned').spots;
  assert.equal(spots.length, MAX_SPOTS);
  assert.deepEqual(spots[0], [0, 0, 0], 'the first catch');
  assert.deepEqual(spots[MAX_SPOTS - 1], [99, 99, 0], 'the last catch');
});

test('the longest report of the real floor still fits in a beacon', () => {
  // An hour on the Kelurahan with every ledge stood on and every hazard met many times.
  const game = new Game();
  game.start();
  game.time = 3599;
  game.deaths = 9999;
  game.catches = { 'auditor:10': 999, 'auditor:17': 999, 'stempel:12': 999, 'stempel:19': 999, jatuh: 999 };
  game.log.splits = game.log.splits.map(() => 3599);
  for (let i = 0; i < 2000; i++) game.log.spots.push([383, 595, 6]);
  game.log.lastHazard = 'stempel:19';
  game.log.picked = game.log.picked.map(() => true);
  game.log.lost = 999;
  game.log.carried = game.log.carried.map(() => 3599);
  game.log.caughtWith = game.log.caughtWith.map(() => 9999);
  game.log.jumps = 99999;
  game.log.dashes = 99999;
  game.log.dwell = game.log.dwell.map(() => 3599);
  const body = JSON.stringify({
    type: 'run_ended',
    rev: '10.10.10+abcdef0',
    ...runReport(game, 'finished'),
    muted: false,
    device: 'touch',
    layout: 'fill-tall',
    attempt: 999,
    pauses: 999,
    away: 999,
    // Where the visit came from, at the longest the page sends it.
    from: `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`,
    source: 'x'.repeat(40),
    campaign: 'y'.repeat(40),
    fps: 500,
    slow: 100,
    audio: 'interrupted',
    full: true,
    turns: 999,
  });
  // nginx and the collector refuse anything over 2 KB.
  assert.ok(body.length < 2048, `${body.length} bytes`);
});

test('falling far below the last checkpoint is a catch, and not before one', () => {
  const lobby = yard();
  lobby.placeOn(1, 178);
  run(lobby, 1, hold({ move: 1 }));
  assert.equal(lobby.deaths, 0, 'before the first checkpoint a fall only costs time');

  const game = yard();
  game.placeOn(3, 80);
  game.step(STEP);
  assert.equal(game.auditLine, 120 - PARAMS.auditLine);
  until(game, () => game.deaths > 0, hold({ move: -1 }));
  assert.equal(game.cause, 'jatuh');
  assert.ok(game.player.y < game.auditLine);
});

test('a fiktif ledge holds for a moment, gives way, and comes back', () => {
  const game = yard();
  game.placeOn(2, 240);
  game.player.y += 4;
  game.player.ground = -1;
  until(game, () => game.player.ground === 2);
  run(game, PARAMS.crumbleDelay - 0.1);
  assert.equal(game.player.ground, 2, 'it holds at first');
  run(game, 0.2);
  assert.equal(game.player.ground, -1, 'then it is gone');
  assert.ok(!game.ledgeHolds(2));
  run(game, PARAMS.crumbleReturn + 0.1);
  assert.ok(game.ledgeHolds(2), 'and it comes back');
});

test('a troli carries the player', () => {
  const game = yard();
  const def = YARD.ledges[4] as FloorDef['ledges'][number];
  game.placeOn(4);
  const offset = game.player.x - ledgeX(def, game.worldTime);
  run(game, 1.3);
  assert.equal(game.player.ground, 4);
  assert.ok(Math.abs(game.player.x - ledgeX(def, game.worldTime) - offset) < 0.001);
});

test('ledges are passed through from below and landed on from above', () => {
  const game = quietGame(YARD);
  game.placeOn(0, 140);
  game.step(STEP, hold({ jump: true }));
  until(game, () => game.player.ground >= 0, hold({ jump: true }));
  assert.equal(game.player.ground, 1);
  assert.equal(game.player.y, 28);
});

test('reaching the door wins, and keeps the better record', () => {
  let saved: Best | null = null;
  const store = { read: () => ({ time: 50, money: 5_000_000 }), write: (best: Best) => (saved = best) };
  const game = new Game({ floor: YARD, store });
  game.start();
  run(game, 0.4, hold({ move: 1 }));
  game.placeOn(3, 150);
  run(game, 1, hold({ move: 1 }));

  assert.equal(game.phase, 'won');
  assert.deepEqual(game.record, { time: true, money: false });
  assert.deepEqual(saved, { time: game.time, money: 5_000_000 });
  assert.ok(game.drain().some((e) => e.type === 'win'));

  const frozen = game.time;
  run(game, 1, hold({ move: 1 }));
  assert.equal(game.time, frozen, 'the clock stops at the door');

  game.start();
  assert.equal(game.phase, 'playing');
  assert.equal(game.weight, 0);
  assert.equal(game.checkpoint, 0);
});

test('a pause freezes everything, and resuming is not a jump', () => {
  const game = quietGame();
  run(game, 0.5, hold({ move: 1 }));
  game.pause();
  const before = { x: game.player.x, time: game.time, world: game.worldTime };
  run(game, 1, hold({ move: 1, jump: true }));
  assert.deepEqual({ x: game.player.x, time: game.time, world: game.worldTime }, before);

  game.resume();
  game.step(STEP, hold({ jump: true, dash: true }));
  assert.equal(game.player.ground, 0, 'a button still held from before the pause does nothing');
  assert.equal(game.drain().filter((e) => e.type === 'jump' || e.type === 'dash').length, 0);
});

test('the same inputs give the same climb', () => {
  const play = () => {
    const game = new Game();
    game.start();
    for (let i = 0; i < 1200; i++) {
      game.step(STEP, { move: i % 400 < 250 ? 1 : -1, jump: i % 90 < 30, dash: i % 200 === 50 });
    }
    return JSON.stringify([game.player, game.weight, game.deaths, game.time]);
  };
  assert.equal(play(), play());
});

test('money and time read the way players write them', () => {
  assert.equal(rupiah(1_500_000), 'Rp 1.500.000');
  assert.equal(clock(0), '0:00');
  assert.equal(clock(83.9), '1:23');
  assert.equal(clock(600), '10:00');
});
