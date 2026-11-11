import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BPM,
  LOOP_SECONDS,
  noteFreq,
  parseTrack,
  SCALE,
  SONG,
  STEP_SECONDS,
  STEPS_PER_BAR,
  stepEvents,
} from '../src/platform/music.ts';

test('note names are equal temperament around A4', () => {
  assert.equal(noteFreq('A4'), 440);
  assert.ok(Math.abs(noteFreq('E4') - 329.63) < 0.01);
  assert.ok(Math.abs(noteFreq('C5') - 523.25) < 0.01);
  assert.equal(noteFreq('E5'), noteFreq('E4') * 2);
  assert.throws(() => noteFreq('H4'));
});

test('a hold extends the note before it, and a rest ends it', () => {
  const notes = parseTrack(['E4 - - . G4 . . . . . . . . . . B4', '- - . . . . . . . . . . . . . .']);
  assert.deepEqual(
    notes.map((n) => [n.name, n.step, n.length]),
    [
      ['E4', 0, 3],
      ['G4', 4, 1],
      // A note may be held across the bar line.
      ['B4', 15, 3],
    ],
  );
  assert.throws(() => parseTrack(['E4 . .']), /bar 1 has 3 steps/);
});

test('the tune is sixteen bars and loops in about half a minute', () => {
  assert.equal(SONG.bars, 16);
  assert.equal(SONG.steps, 16 * STEPS_PER_BAR);
  assert.equal(SONG.drums.length, SONG.steps);
  assert.equal(STEP_SECONDS, 60 / BPM / 4);
  assert.ok(LOOP_SECONDS > 25 && LOOP_SECONDS < 40, `loop ${LOOP_SECONDS} s`);
});

test('every note is in the scale, and in a range a phone speaker can play', () => {
  const allowed = new Set<string>(SCALE);
  for (const [track, notes] of Object.entries({ lead: SONG.lead, bass: SONG.bass, arp: SONG.arp })) {
    assert.ok(notes.length > 0, `${track} has notes`);
    for (const note of notes) {
      assert.ok(allowed.has(note.name[0] ?? ''), `${track} plays ${note.name}, outside the scale`);
      assert.ok(note.freq >= 55 && note.freq <= 1700, `${track} plays ${note.name}`);
    }
  }
});

test('each voice plays one note at a time and stays inside the loop', () => {
  for (const [track, notes] of Object.entries({ lead: SONG.lead, bass: SONG.bass, arp: SONG.arp })) {
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const next = notes[i + 1];
      assert.ok(note);
      assert.ok(note.step + note.length <= SONG.steps, `${track} runs past the end of the loop`);
      if (next) assert.ok(note.step + note.length <= next.step, `${track} overlaps at step ${next.step}`);
    }
  }
});

test('the first half is sparse and the second half adds the second voice', () => {
  const half = SONG.steps / 2;
  assert.equal(SONG.arp.filter((n) => n.step < half).length, 0);
  assert.equal(SONG.arp.filter((n) => n.step >= half).length, half);
  const leadA = SONG.lead.filter((n) => n.step < half).length;
  const leadB = SONG.lead.filter((n) => n.step >= half).length;
  assert.ok(leadB > leadA, 'the melody is busier in the second half');
});

test('every bar starts on a kick and a bass note, and the loop wraps', () => {
  for (let bar = 0; bar < SONG.bars; bar++) {
    const events = stepEvents(bar * STEPS_PER_BAR);
    assert.equal(events.drum, 'k', `bar ${bar + 1}`);
    assert.ok(events.bass, `bar ${bar + 1} has a bass note on the downbeat`);
  }
  assert.deepEqual(stepEvents(SONG.steps), stepEvents(0));
  assert.deepEqual(stepEvents(-1), stepEvents(SONG.steps - 1));
});
