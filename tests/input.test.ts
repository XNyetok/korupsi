import assert from 'node:assert/strict';
import test from 'node:test';

import type { Phase } from '../src/config.ts';
import { Controls, keyAction } from '../src/input.ts';

function setup(phase: Phase = 'playing', dir = 1) {
  let clock = 0;
  const calls: string[] = [];
  const target = {
    phase,
    player: { dir },
    jump(d: number) {
      calls.push(`jump ${d}`);
      target.player.dir = d;
    },
  };
  const controls = new Controls(
    target,
    {
      start: () => calls.push('start'),
      resume: () => calls.push('resume'),
    },
    () => clock,
  );
  return { controls, target, calls, tick: (ms: number) => (clock += ms) };
}

test('space repeats the last direction, both ways', () => {
  const { controls, calls } = setup('playing', 1);
  controls.repeat();
  controls.press(-1);
  controls.repeat();
  assert.deepEqual(calls, ['jump 1', 'jump -1', 'jump -1']);
});

test('a tap is judged against the element, not the window', () => {
  // A 360 px canvas centred in a 1000 px window starts at x = 320.
  const { controls, calls } = setup();
  controls.pointer(340, 320, 360);
  controls.pointer(600, 320, 360);
  assert.deepEqual(calls, ['jump -1', 'jump 1']);
});

test('the result screen survives the tap that ended the run', () => {
  const { controls, target, calls, tick } = setup('over');
  controls.block(700);
  controls.press(1);
  tick(699);
  controls.press(1);
  assert.deepEqual(calls, [], 'a press during the lock restarted the run');

  tick(1);
  controls.press(1);
  assert.deepEqual(calls, ['start']);
  void target;
});

test('a press on a paused run resumes it without jumping', () => {
  const { controls, calls } = setup('paused');
  controls.press(-1);
  assert.deepEqual(calls, ['resume']);
});

test('keys map to actions', () => {
  assert.equal(keyAction('ArrowLeft'), 'left');
  assert.equal(keyAction('a'), 'left');
  assert.equal(keyAction('D'), 'right');
  assert.equal(keyAction(' '), 'repeat');
  assert.equal(keyAction('Enter'), 'repeat');
  assert.equal(keyAction('Tab'), null);
});
