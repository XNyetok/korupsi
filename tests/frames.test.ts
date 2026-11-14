import assert from 'node:assert/strict';
import test from 'node:test';

import { FrameMeter, SLOW_FRAME } from '../src/platform/frames.ts';

test('a run says how many frames a second it was drawn at, and how many stuttered', () => {
  const meter = new FrameMeter();
  assert.equal(meter.report(), null, 'nothing drawn, nothing to say');

  // A second and a half at 60 a second, then five stalls of 50 ms (the loop's cut).
  for (let i = 0; i < 90; i++) meter.add(1 / 60);
  for (let i = 0; i < 5; i++) meter.add(0.05);
  assert.deepEqual(meter.report(), { fps: 54, slow: 5 });

  // A frame exactly at the limit is not a stutter; nonsense is not a frame.
  meter.reset();
  meter.add(SLOW_FRAME);
  meter.add(0);
  meter.add(Number.NaN);
  meter.add(-1);
  assert.deepEqual(meter.report(), { fps: 30, slow: 0 });

  meter.reset();
  for (let i = 0; i < 240; i++) meter.add(1 / 120);
  assert.deepEqual(meter.report(), { fps: 120, slow: 0 }, 'a fast screen reads as fast');
});
