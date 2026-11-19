import assert from 'node:assert/strict';
import test from 'node:test';

import { Atrium, LIFT, type LiftPhase } from '../src/core/atrium.ts';
import { idle, run, STEP } from './helpers.ts';

const right = { ...idle, move: 1 } as const;

function board(game: Atrium): void {
  game.start();
  run(game, 1.4, right);
  assert.equal(game.liftPhase, 'rising');
  assert.equal(game.player.ground, LIFT.ledge);
  assert.equal(game.player.y, game.ledgeHeight(LIFT.ledge));
}

test('the lift is idle until boarded and carries the player without a button', () => {
  const game = new Atrium();
  game.start();
  run(game, 4);
  assert.equal(game.liftPhase, 'ready');
  assert.equal(game.ledgeHeight(LIFT.ledge), 0);

  board(game);
  run(game, 4);
  assert.equal(game.liftPhase, 'arrived');
  assert.equal(game.player.y, LIFT.top);
  assert.equal(game.player.ground, LIFT.ledge);
  assert.equal(game.deaths, 0);
});

test('players can jump to verification and replay from the lobby', () => {
  const game = new Atrium();
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
  assert.equal(game.ledgeHeight(LIFT.ledge), 0);
  assert.equal(game.liftPhase, 'ready');
});

test('if the rider falls, the lift returns and they can board again', () => {
  const game = new Atrium();
  board(game);
  run(game, 2.3, right);
  assert.equal(game.player.ground, 0);
  assert.notEqual(game.phase, 'won');
  run(game, 2);
  assert.equal(game.liftPhase, 'ready');
  run(game, 1.6, { ...idle, move: -1 });
  assert.ok(game.ledgeHeight(LIFT.ledge) > 0);
  assert.equal(game.player.ground, LIFT.ledge);
});

test('the lift pauses with the world and its motion is deterministic', () => {
  const game = new Atrium();
  board(game);
  const y = game.ledgeHeight(LIFT.ledge);
  game.pause();
  run(game, 5);
  assert.equal(game.ledgeHeight(LIFT.ledge), y);
  assert.equal(game.player.y, y);
  game.resume();
  run(game, 1);
  assert.equal(game.player.y, LIFT.top);

  function ride(): (number | LiftPhase)[][] {
    const fresh = new Atrium();
    fresh.start();
    return Array.from({ length: 320 }, (_, i) => {
      fresh.step(STEP, i < 160 ? right : idle);
      return [fresh.ledgeHeight(LIFT.ledge), fresh.player.y, fresh.liftPhase];
    });
  }
  assert.deepEqual(ride(), ride());
});
