import assert from 'node:assert/strict';
import test from 'node:test';

import { type Climb, gelarFor, QUICK, SLOW, TITLES } from '../src/core/gelar.ts';
import { LINE_CHARS, wrap } from '../src/view/sharecard.ts';

const climb = (over: Partial<Climb>): Climb => ({ time: 90, deaths: 2, weight: 3, total: 6, ...over });
const id = (over: Partial<Climb>) => gelarFor(climb(over)).id;

test('every way of climbing earns its own title', () => {
  assert.equal(id({ weight: 6, deaths: 0 }), 'raja');
  assert.equal(id({ deaths: 0, time: QUICK - 1 }), 'belut');
  assert.equal(id({ weight: 0, deaths: 0 }), 'teladan');
  assert.equal(id({ deaths: 10 }), 'langganan');
  assert.equal(id({ weight: 6 }), 'kolektor');
  assert.equal(id({ weight: 0 }), 'kosong');
  assert.equal(id({ deaths: 0 }), 'emas');
  assert.equal(id({ time: SLOW }), 'lembur');
  assert.equal(id({ deaths: 5 }), 'kebal');
  assert.equal(id({}), 'oknum');
});

test('the harder title wins when two fit', () => {
  // Everything carried, never caught, and quick: the bag outranks the speed.
  assert.equal(id({ weight: 6, deaths: 0, time: 20 }), 'raja');
  // Clean and quick with an empty bag is still quick first.
  assert.equal(id({ weight: 0, deaths: 0, time: 20 }), 'belut');
  // Caught ten times with a full bag: the ten times are the story.
  assert.equal(id({ weight: 6, deaths: 12 }), 'langganan');
  // Slow and often caught: slow is the rarer thing to admit to.
  assert.equal(id({ time: 400, deaths: 7 }), 'lembur');
});

test('the edges fall where the rules say', () => {
  assert.equal(id({ deaths: 0, time: QUICK }), 'emas');
  assert.equal(id({ time: SLOW - 1 }), 'oknum');
  assert.equal(id({ deaths: 4 }), 'oknum');
  assert.equal(id({ deaths: 9 }), 'kebal');
});

test('the line tells the numbers that earned the title', () => {
  assert.equal(gelarFor(climb({ deaths: 12 })).line, '12 kali OTT, dan tetap naik jabatan.');
  assert.equal(gelarFor(climb({ weight: 6, deaths: 3 })).line, 'Semua amplop terbawa. Ongkosnya 3 kali OTT.');
  assert.equal(gelarFor(climb({})).line, '3 amplop, 2 kali OTT. Namanya juga oknum.');
});

test('every title can be reached, and every one fits the decree', () => {
  const reached = new Set<string>();
  for (const time of [10, 60, 200, 500]) {
    for (const deaths of [0, 1, 5, 10, 25]) {
      for (const weight of [0, 1, 3, 6]) {
        const gelar = gelarFor({ time, deaths, weight, total: 6 });
        reached.add(gelar.title);
        // The decree prints the title two game pixels to the pixel, and the line in the small font.
        assert.ok(gelar.title.length <= 15, `${gelar.title} is too long for the decree`);
        const lines = wrap(gelar.line, LINE_CHARS);
        assert.ok(lines.length <= 2, `"${gelar.line}" needs ${lines.length} lines`);
        assert.ok(
          lines.every((line) => line.length <= LINE_CHARS),
          `"${gelar.line}" has a line too long for the paper`,
        );
      }
    }
  }
  assert.deepEqual([...reached].sort(), [...TITLES].sort());
});

test('a sentence is broken at its spaces, never inside a word', () => {
  assert.deepEqual(wrap('satu dua tiga empat', 9), ['satu dua', 'tiga', 'empat']);
  assert.deepEqual(wrap('pendek', 29), ['pendek']);
  assert.deepEqual(wrap('', 29), []);
});
