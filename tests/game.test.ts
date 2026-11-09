import assert from 'node:assert/strict';
import test from 'node:test';

import { PARAMS } from '../src/config.ts';
import { AWAY_LIMIT_MS, Game, PLAYER_EDGE, envelope } from '../src/game.ts';
import { WORLD_WIDTH } from '../src/config.ts';

const STEP = 1 / 120;

function newGame(): Game {
  const game = new Game({ onEnd() {} });
  game.setViewport(780);
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

/** -1 for the left ledge of the pair, 1 for the right one. */
function sideOf(option: { x: number }, options: { x: number }[]): -1 | 1 {
  return options.every((o) => o.x >= option.x) ? -1 : 1;
}

function land(game: Game): void {
  for (let i = 0; i < 400 && game.phase === 'playing' && !game.player.onGround; i++) game.step(STEP);
}

function jumpAndLand(game: Game, preferGold: boolean): boolean {
  const options = levelAbove(game);
  if (!options.length) return false;

  const pick = (preferGold ? options.find((o) => o.gold) : options.find((o) => !o.gold)) ?? options[0];
  game.jump(sideOf(pick, options));
  land(game);
  return game.phase === 'playing' && !!game.player.onGround;
}

/** Plays many levels, calling `visit` on each with the pair above the player. */
function eachLevel(
  levels: number,
  visit: (game: Game, options: ReturnType<typeof levelAbove>) => void,
): number {
  const game = newGame();
  let seen = 0;
  for (let i = 0; i < levels * 20 && seen < levels; i++) {
    if (game.phase !== 'playing') {
      game.start();
      continue;
    }
    if (!game.player.onGround) {
      game.step(STEP);
      continue;
    }
    // Close to the band the run is lost anyway; start fresh rather than
    // judging geometry the player will never get to use.
    if (game.player.y - game.camY > game.auditLine * 0.75) {
      game.start();
      continue;
    }
    seen++;
    visit(game, levelAbove(game));
  }
  return seen;
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
    assert.equal(options.length, 2, 'every level has two ledges');

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

test('every level offers two separate ledges, and each side lands on its own', () => {
  const counts = { left: 0, right: 0, wall: 0 };

  const seen = eachLevel(3000, (game, options) => {
    assert.equal(options.length, 2, 'a level must always offer a choice');
    const [a, b] = [...options].sort((p, q) => p.x - q.x);

    assert.ok(a.x - a.w / 2 >= 0 && b.x + b.w / 2 <= game.width, 'ledges stay inside the world');
    assert.ok(a.x + a.w / 2 < b.x - b.w / 2, 'the two ledges must not touch');

    const nearWall =
      game.player.x < PLAYER_EDGE + 40 || game.player.x > game.width - PLAYER_EDGE - 40;
    if (nearWall) counts.wall++;

    // Pick a side at random and check the jump ends on that side's ledge.
    const dir = Math.random() < 0.5 ? -1 : 1;
    const expected = dir < 0 ? a : b;
    game.jump(dir);
    land(game);
    if (game.phase !== 'playing') return;
    assert.equal(game.player.onGround?.id, expected.id, `jumping ${dir < 0 ? 'left' : 'right'} missed its ledge`);
    counts[dir < 0 ? 'left' : 'right']++;
  });

  assert.ok(seen >= 3000, `expected 3000 levels, got ${seen}`);
  assert.ok(counts.wall > 100, `the walls were barely tested (${counts.wall} levels)`);
  assert.ok(counts.left > 1000 && counts.right > 1000, 'both sides must be exercised');
});

test('the safe side is never guarded', () => {
  let guarded = 0;

  eachLevel(4000, (game, options) => {
    const safe = options.find((o) => !o.gold) ?? options[0];
    const hadAuditor = game.auditors.length > 0;
    game.jump(sideOf(safe, options));
    land(game);
    if (!hadAuditor) return;
    guarded++;
    assert.notEqual(game.cause, 'auditor', 'the auditor caught a player on the safe side');
  });

  assert.ok(guarded >= 100, `expected 100 guarded levels, saw ${guarded}`);
});

test('no auditor before the fifth level', () => {
  eachLevel(2000, (game, options) => {
    if (game.level < 5) assert.equal(game.auditors.length, 0, `auditor at level ${game.level}`);
    jumpAndLand(game, Math.random() < 0.5);
    void options;
  });
});

test('a level is counted once per new ledge', () => {
  const game = newGame();
  assert.equal(game.level, 0);
  for (let n = 1; n <= 20; n++) {
    assert.ok(jumpAndLand(game, false), 'the bot failed to land');
    assert.equal(game.level, n);
  }
});

test('landing back on the same ledge does not reroll the level', () => {
  const game = newGame();
  for (let n = 0; n < 6; n++) jumpAndLand(game, false);

  const footing = game.player.onGround;
  assert.ok(footing);
  // Nothing above to reach, and a ledge as wide as the world: the jump has
  // to come back down where it started.
  // The auditor guarding the old level would still patrol where its ledge was
  // and catch the jump: that failed about one run in twenty.
  game.platforms = [footing];
  game.auditors = [];
  footing.x = game.width / 2;
  footing.w = game.width;
  footing.type = 'solid';
  const level = game.level;

  game.jump(1);
  land(game);

  assert.equal(game.player.onGround, footing);
  assert.equal(game.level, level, 'the level count moved');
  assert.deepEqual(
    game.platforms.map((p) => p.id),
    [footing.id],
    'new ledges were generated without climbing',
  );
});

test('the run ends where the audit band is drawn', () => {
  const game = newGame();
  let lastFeet = 0;
  for (let i = 0; i < 120 * 120 && game.phase === 'playing'; i++) {
    lastFeet = game.player.y - game.camY;
    game.step(STEP);
  }

  assert.equal(game.phase, 'over');
  const feet = game.player.y - game.camY;
  assert.ok(lastFeet <= game.auditLine, 'the run should have ended earlier');
  assert.ok(feet > game.auditLine, 'the run ended before the feet reached the band');
  assert.equal(game.auditLine, game.height - PARAMS.bandHeight);
});

test('resizing mid-run keeps the world and its ledges', () => {
  const game = newGame();
  for (let n = 0; n < 5; n++) jumpAndLand(game, false);
  const before = game.platforms.map((p) => `${p.id}:${p.x}`);

  game.setViewport(400);
  game.setViewport(1200);

  assert.equal(game.width, WORLD_WIDTH);
  assert.deepEqual(game.platforms.map((p) => `${p.id}:${p.x}`), before);
  assert.ok(jumpAndLand(game, false), 'the level is still playable after a resize');
});

test('a paused run does not move and its time does not count', () => {
  const game = newGame();
  advance(game, 1);
  const elapsed = game.elapsed;
  const camY = game.camY;

  game.pause();
  assert.equal(game.phase, 'paused');
  for (let i = 0; i < 600; i++) game.step(STEP);
  assert.equal(game.camY, camY);
  assert.equal(game.elapsed, elapsed);

  game.resume();
  assert.equal(game.phase, 'playing');
  advance(game, 0.5);
  assert.ok(Math.abs(game.elapsed - elapsed - 0.5) < 0.01);
});

test('standing still ends the run on its own', () => {
  const game = newGame();
  advance(game, 120);

  assert.equal(game.phase, 'over');
  assert.ok(['band', 'fall'].includes(game.cause), `unexpected cause: ${game.cause}`);
});

test('a glance keeps the run, a departure ends it', () => {
  const game = newGame();
  game.pause();
  game.handleAway(AWAY_LIMIT_MS - 1);
  assert.equal(game.phase, 'paused');

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
