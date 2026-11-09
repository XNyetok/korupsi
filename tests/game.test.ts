import assert from 'node:assert/strict';
import test from 'node:test';

import { PARAMS } from '../src/config.ts';
import { AWAY_LIMIT_MS, Game, envelope } from '../src/game.ts';

const STEP = 1 / 120;

function newGame(): Game {
  const game = new Game({ onEnd() {} });
  game.setViewport(390, 844);
  game.start();
  return game;
}

function advance(game: Game, seconds: number): void {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps && game.phase === 'playing'; i++) game.step(STEP);
}

function levelAbove(game: Game): { x: number; y: number; w: number; gold: boolean }[] {
  const anchor = game.player.onGround;
  if (!anchor) return [];
  const above = game.platforms.filter((p) => p.alive && p.y < anchor.y - 4);
  let top = Infinity;
  for (const p of above) if (p.y < top) top = p.y;
  return above.filter((p) => Math.abs(p.y - top) < 1);
}

function jumpAndLand(game: Game, preferGold: boolean): boolean {
  const options = levelAbove(game);
  if (!options.length) return false;

  const pick = (preferGold ? options.find((o) => o.gold) : options.find((o) => !o.gold)) ?? options[0];
  game.jump(pick.x < game.player.x ? -1 : 1);

  for (let i = 0; i < 400 && game.phase === 'playing' && !game.player.onGround; i++) game.step(STEP);
  return game.phase === 'playing' && !!game.player.onGround;
}

test('the ledge underfoot survives the rebuild', () => {
  const game = newGame();
  let landings = 0;

  for (let i = 0; i < 2000 && landings < 300; i++) {
    if (game.phase !== 'playing') {
      game.start();
      continue;
    }
    if (!game.player.onGround) {
      game.step(STEP);
      continue;
    }

    if (!jumpAndLand(game, false)) continue;
    landings++;

    // Regression: the platform being stood on used to be dropped from the
    // render list, so the player appeared to stand in the air.
    assert.ok(
      game.player.onGround && game.platforms.includes(game.player.onGround),
      'the platform underfoot is missing from the scene',
    );
  }

  assert.ok(landings >= 300, `expected 300 landings, got ${landings}`);
});

test('every generated ledge is inside the jump envelope', () => {
  const game = newGame();
  let checked = 0;

  for (let i = 0; i < 3000 && checked < 400; i++) {
    if (game.phase !== 'playing') {
      game.start();
      continue;
    }
    if (!game.player.onGround) {
      game.step(STEP);
      continue;
    }

    // Too close to the audit band and the run is already lost; that is not a
    // geometry problem, so start a fresh run instead of asserting on it.
    if (game.player.y - game.camY > game.height * 0.7) {
      game.start();
      continue;
    }

    const anchor = game.player.onGround;
    const options = levelAbove(game);
    assert.ok(options.length >= 1 && options.length <= 2, 'a level has one or two ledges');

    const env = envelope(game.jumpFactor());
    for (const option of options) {
      const dy = anchor.y - option.y;
      const dx = Math.abs(option.x - game.player.x);

      assert.ok(dy <= env.h * 0.7, `ledge ${dy.toFixed(1)}px up exceeds the jump rise`);
      assert.ok(
        dx <= env.dxAt(dy) + option.w / 2 + 8,
        `ledge ${dx.toFixed(1)}px away exceeds the jump reach at ${dy.toFixed(1)}px up`,
      );
    }

    assert.ok(jumpAndLand(game, false), 'the bot failed to land on a ledge it was told was reachable');
    checked++;
  }

  assert.ok(checked >= 400, `expected 400 levels, got ${checked}`);
});

test('a lone ledge is never the risky one', () => {
  const game = newGame();
  let single = 0;

  for (let i = 0; i < 2000 && single < 60; i++) {
    if (game.phase !== 'playing') {
      game.start();
      continue;
    }
    if (!game.player.onGround) {
      game.step(STEP);
      continue;
    }

    const options = levelAbove(game);
    if (options.length === 1) {
      single++;
      assert.equal(options[0].gold, false, 'a level without a choice must not force the risky ledge');
    }
    jumpAndLand(game, false);
  }

  assert.ok(single >= 60, `expected at least 60 single-ledge levels, saw ${single}`);
});

test('standing still ends the run on its own', () => {
  const game = newGame();
  advance(game, 120);

  assert.equal(game.phase, 'over');
  assert.ok(['band', 'fall'].includes(game.cause), `unexpected cause: ${game.cause}`);
});

test('a glance keeps the run, a departure ends it', () => {
  const game = newGame();
  game.handleAway(AWAY_LIMIT_MS - 1);
  assert.equal(game.phase, 'playing');

  game.handleAway(AWAY_LIMIT_MS);
  assert.equal(game.phase, 'over');
  assert.equal(game.cause, 'abandoned');
});

test('the best score only goes up', () => {
  const game = newGame();
  game.money = 2_000_000;
  game.maxClimb = 1200;
  game.endRun('band');

  assert.deepEqual(game.best, { money: 2_000_000, height: 200 });

  game.start();
  game.money = 500_000;
  game.maxClimb = 600;
  game.endRun('auditor');

  assert.deepEqual(game.best, { money: 2_000_000, height: 200 });
});

test('weight shortens the jump and the floor stops it', () => {
  const game = newGame();
  const base = envelope(game.jumpFactor()).h;

  game.weight = 5;
  const lighter = envelope(game.jumpFactor()).h;
  game.weight = 40;
  const floor = envelope(game.jumpFactor()).h;

  assert.ok(lighter < base, 'five envelopes should shorten the jump');
  assert.ok(floor < lighter, 'more weight should shorten it further');
  assert.equal(game.jumpFactor(), PARAMS.minFactor, 'the jump factor must stop at the floor');
  // Height scales with the square of the factor, so the floor is predictable.
  assert.ok(Math.abs(floor / base - PARAMS.minFactor ** 2) < 0.01, 'the floor must be a real jump');
  assert.ok(floor > 20, 'the floor must clear the smallest gap the generator can pick');
});
