import assert from 'node:assert/strict';
import test from 'node:test';

import { ATRIUM } from '../src/core/atrium.ts';
import { Game } from '../src/core/game.ts';
import { KECAMATAN } from '../src/core/tower.ts';
import { idle, run, STEP } from './helpers.ts';

const right = { ...idle, move: 1 } as const;
const LIFT = 1;
const TOP = ATRIUM.ledges[LIFT].liftTo;
const atrium = () => new Game({ floor: ATRIUM });

function board(game: Game): void {
  game.start();
  run(game, 1.4, right);
  assert.equal(game.liftPhase(LIFT), 'rising');
  assert.equal(game.player.ground, LIFT);
  assert.equal(game.player.y, game.ledgeHeight(LIFT));
}

test('the lift is idle until boarded and carries the player without a button', () => {
  const game = atrium();
  game.start();
  run(game, 4);
  assert.equal(game.liftPhase(LIFT), 'ready');
  assert.equal(game.ledgeHeight(LIFT), 0);

  board(game);
  run(game, 4);
  assert.equal(game.liftPhase(LIFT), 'arrived');
  assert.equal(game.player.y, TOP);
  assert.equal(game.player.ground, LIFT);
  assert.equal(game.deaths, 0);
  assert.deepEqual(
    game
      .drain()
      .filter((event) => event.type.startsWith('lift_'))
      .map((event) => event.type),
    ['lift_up', 'lift_at'],
  );
});

test('players can jump to verification and replay from the lobby', () => {
  const game = atrium();
  board(game);
  run(game, 1);
  run(game, 0.59, right);
  run(game, 0.12, { ...right, jump: true });
  run(game, 2, right);
  assert.equal(game.phase, 'won');
  assert.equal(game.player.ground, game.floor.exit.ledge);
  assert.equal(game.log.jumps, 1);

  game.start();
  assert.equal(game.phase, 'playing');
  assert.equal(game.player.ground, 0);
  assert.equal(game.ledgeHeight(LIFT), 0);
  assert.equal(game.liftPhase(LIFT), 'ready');
});

test('if the rider falls, the lift returns and they can board again', () => {
  const game = atrium();
  board(game);
  run(game, 2.3, right);
  assert.equal(game.player.ground, 0);
  assert.notEqual(game.phase, 'won');
  run(game, 2);
  assert.equal(game.liftPhase(LIFT), 'ready');
  run(game, 1.6, { ...idle, move: -1 });
  assert.ok(game.ledgeHeight(LIFT) > 0);
  assert.equal(game.player.ground, LIFT);
});

test('the lift pauses with the world and its motion is deterministic', () => {
  const game = atrium();
  board(game);
  const y = game.ledgeHeight(LIFT);
  game.pause();
  run(game, 5);
  assert.equal(game.ledgeHeight(LIFT), y);
  assert.equal(game.player.y, y);
  game.resume();
  run(game, 1);
  assert.equal(game.player.y, TOP);

  function ride() {
    const fresh = atrium();
    fresh.start();
    return Array.from({ length: 320 }, (_, i) => {
      fresh.step(STEP, i < 160 ? right : idle);
      return [fresh.ledgeHeight(LIFT), fresh.player.y, fresh.liftPhase(LIFT)];
    });
  }
  assert.deepEqual(ride(), ride());
});

test('the second lift stays dormant until the player reaches its dock', () => {
  const game = new Game({ floor: KECAMATAN });
  board(game);
  run(game, 2);
  assert.equal(game.liftPhase(6), 'ready');
  assert.equal(game.ledgeHeight(6), KECAMATAN.ledges[6].y);
  assert.equal(game.player.y, TOP);
});
