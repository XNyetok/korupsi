import assert from 'node:assert/strict';
import test from 'node:test';

import { Game } from '../src/core/game.ts';
import { formatSeed, mulberry32, parseSeed, randomSeed } from '../src/core/rng.ts';

const STEP = 1 / 120;

/** Everything about the world that the seed and the choices decide. */
function snapshot(game: Game): string {
  const ledges = game.platforms.map((p) => [p.id, p.x.toFixed(3), p.y.toFixed(3), p.w.toFixed(3), p.gold, p.type]);
  const auditors = game.auditors.map((a) => [
    a.upper.id,
    a.minX.toFixed(3),
    a.maxX.toFixed(3),
    a.speed.toFixed(3),
    a.dir,
  ]);
  return JSON.stringify({ ledges, auditors, level: game.level, money: game.money });
}

/**
 * Plays a run with a fixed list of choices, waiting a different number of
 * frames before each jump, and returns the world after every landing.
 */
function play(seed: number, choices: (-1 | 1)[], waits: number[]): string[] {
  const game = new Game({ onEnd() {} }, { seed });
  game.setViewport(780);
  game.start();
  const seen = [snapshot(game)];

  choices.forEach((dir, i) => {
    for (let n = 0; n < (waits[i % waits.length] ?? 0) && game.phase === 'playing'; n++) game.step(STEP);
    if (game.phase !== 'playing' || !game.player.onGround) return;
    game.jump(dir);
    for (let n = 0; n < 400 && game.phase === 'playing' && !game.player.onGround; n++) game.step(STEP);
    if (game.phase === 'playing') seen.push(snapshot(game));
  });
  return seen;
}

// Safe-ish path: alternate sides, which keeps the run alive long enough.
const CHOICES: (-1 | 1)[] = Array.from({ length: 40 }, (_, i) => (i % 3 === 0 ? -1 : 1));

test('the same seed and the same choices build the same levels', () => {
  const a = play(12345, CHOICES, [0]);
  const b = play(12345, CHOICES, [0]);
  assert.ok(a.length > 10, `the run ended after ${a.length} landings`);
  assert.deepEqual(a, b);
});

test('how long the player waits never changes the levels', () => {
  // Waiting changes how much dust flies and when ledges crumble; neither may
  // reach the level stream.
  const quick = play(777, CHOICES.slice(0, 12), [0]);
  const slow = play(777, CHOICES.slice(0, 12), [3, 40, 11, 25]);
  const n = Math.min(quick.length, slow.length);
  assert.ok(n > 5, `too few landings to compare (${n})`);
  assert.deepEqual(slow.slice(0, n), quick.slice(0, n));
});

test('different seeds build different levels', () => {
  assert.notDeepEqual(play(1, CHOICES, [0]).slice(0, 3), play(2, CHOICES, [0]).slice(0, 3));
});

test('a seeded run never touches Math.random', () => {
  const original = Math.random;
  Math.random = () => {
    throw new Error('Math.random was called');
  };
  try {
    play(42, CHOICES, [0, 5]);
  } finally {
    Math.random = original;
  }
});

test('every run gets its own seed unless one is fixed', () => {
  const free = new Game({ onEnd() {} });
  free.start();
  const first = free.seed;
  free.start();
  assert.notEqual(free.seed, first, 'two runs in a row shared a seed');

  const fixed = new Game({ onEnd() {} }, { seed: 99 });
  fixed.start();
  fixed.start();
  assert.equal(fixed.seed, 99);
});

test('seeds read and write in base 36, and junk is refused', () => {
  for (const seed of [0, 1, 35, 36, 123456789, 0xffffffff]) {
    assert.equal(parseSeed(formatSeed(seed)), seed);
  }
  assert.equal(formatSeed(0xffffffff), '1z141z3');
  assert.equal(parseSeed(' K3X9A1 '), parseSeed('k3x9a1'));
  for (const bad of [null, undefined, '', '-1', '1.5', 'abc def', '12345678', 'zzzzzzz', '<script>']) {
    assert.equal(parseSeed(bad), null, `accepted ${JSON.stringify(bad)}`);
  }
});

test('the generator stays in [0, 1) and is reproducible', () => {
  const a = mulberry32(2024);
  const b = mulberry32(2024);
  for (let i = 0; i < 10_000; i++) {
    const x = a();
    assert.ok(x >= 0 && x < 1);
    assert.equal(x, b());
  }
  const seed = randomSeed();
  assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff);
});
