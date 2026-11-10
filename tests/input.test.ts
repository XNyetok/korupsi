import assert from 'node:assert/strict';
import test from 'node:test';

import { keyAction, Pad } from '../src/platform/input.ts';
import { fitView } from '../src/platform/viewport.ts';
import { VIEW, WORLD_WIDTH } from '../src/core/params.ts';

test('keys map to actions, whatever the case', () => {
  assert.equal(keyAction('ArrowLeft'), 'left');
  assert.equal(keyAction('a'), 'left');
  assert.equal(keyAction('D'), 'right');
  assert.equal(keyAction(' '), 'jump');
  assert.equal(keyAction('ArrowUp'), 'jump');
  assert.equal(keyAction('Shift'), 'dash');
  assert.equal(keyAction('X'), 'dash');
  assert.equal(keyAction('Escape'), 'pause');
  assert.equal(keyAction('Enter'), 'confirm');
  assert.equal(keyAction('Tab'), null);
});

test('the pad reports what is held', () => {
  const pad = new Pad();
  assert.deepEqual(pad.read(), { move: 0, jump: false, dash: false });
  pad.press('key:d', 'right');
  pad.press('key: ', 'jump');
  assert.deepEqual(pad.read(), { move: 1, jump: true, dash: false });
  pad.release('key:d');
  pad.release('key: ');
  assert.deepEqual(pad.read(), { move: 0, jump: false, dash: false });
});

test('with both directions held, the one pressed last wins', () => {
  const pad = new Pad();
  pad.press('key:a', 'left');
  pad.press('key:d', 'right');
  assert.equal(pad.read().move, 1);
  pad.release('key:d');
  assert.equal(pad.read().move, -1, 'and letting go falls back to the other');
  pad.press('key:d', 'right');
  pad.press('key:arrowleft', 'left');
  assert.equal(pad.read().move, -1);
});

test('a tap that ends before the next step is still seen once', () => {
  const pad = new Pad();
  pad.press('touch:jump', 'jump');
  pad.release('touch:jump');
  assert.equal(pad.read().jump, true, 'the simulation sees the tap');
  assert.equal(pad.read().jump, false, 'and only once');

  // A press the simulation has already seen ends the moment it is released.
  pad.press('key:x', 'dash');
  assert.equal(pad.read().dash, true);
  pad.release('key:x');
  assert.equal(pad.read().dash, false);
});

test('two keys for one action do not cancel each other', () => {
  const pad = new Pad();
  pad.press('key: ', 'jump');
  pad.press('key:w', 'jump');
  pad.read();
  pad.release('key:w');
  assert.equal(pad.read().jump, true);
  pad.release('key: ');
  assert.equal(pad.read().jump, false);
});

test('the touch zone changes direction without a release', () => {
  const pad = new Pad();
  pad.press('touch:move', 'left');
  assert.equal(pad.read().move, -1);
  pad.press('touch:move', 'right');
  assert.equal(pad.read().move, 1);
  pad.release('touch:move');
  assert.equal(pad.read().move, 0);
});

test('clearing lets go of everything', () => {
  const pad = new Pad();
  pad.press('key:d', 'right');
  pad.press('touch:jump', 'jump');
  pad.clear();
  assert.deepEqual(pad.read(), { move: 0, jump: false, dash: false });
});

test('a desktop window gets whole game pixels', () => {
  const view = fitView(1280, 720, 1, false);
  assert.equal(view.unit, 3);
  assert.equal(view.cssW, WORLD_WIDTH * 3);
  assert.equal(view.viewH, 240);
  assert.ok(view.cssH <= 720);
  assert.equal(view.portrait, false);
});

test('a phone on its side gets whole device pixels', () => {
  const view = fitView(844, 390, 3, true);
  assert.equal(view.unit * 3, 5);
  assert.ok(view.cssW <= 844 && view.cssH <= 390);
  assert.ok(view.viewH >= VIEW.minHeight && view.viewH <= VIEW.maxHeight);
});

test('an upright phone uses its full width and keeps room for the thumbs', () => {
  const view = fitView(412, 915, 2.625, true);
  assert.equal(view.portrait, true);
  assert.ok(view.cssW > 412 * 0.98 && view.cssW <= 412, `width ${view.cssW}`);
  assert.equal(view.viewH, VIEW.maxHeight);
  assert.ok(view.cssH <= 915 - 190);
});

test('the view never shows less than a 16:9 screen of the tower', () => {
  for (const [w, h, dpr] of [
    [320, 480, 2],
    [2560, 600, 1],
    [300, 200, 1],
    [1024, 1366, 2],
  ] as const) {
    const view = fitView(w, h, dpr, true);
    assert.ok(view.viewH >= VIEW.minHeight && view.viewH <= VIEW.maxHeight, `${w}x${h}`);
    assert.ok(view.cssW <= w + 0.01, `${w}x${h} fits the width`);
  }
});
