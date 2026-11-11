/**
 * The background tune, written down as notes. No audio API here: this is the
 * score, and synth.ts is the band.
 *
 * It is a 16-bar loop at 120 beats a minute, in a five-note pelog-like scale
 * on E (E F G B C), which is what makes a chip tune sound like it comes from
 * here. Bars 1 to 8 are sparse and sneaky; bars 9 to 16 add an interlocking
 * second voice, the way two sarons share a line.
 *
 * A track is one string per bar, sixteen tokens to the bar: a note name, `.`
 * for silence, or `-` to hold the note before it.
 */

export const BPM = 120;
export const STEPS_PER_BAR = 16;
/** Seconds one step (a sixteenth note) lasts. */
export const STEP_SECONDS = 60 / BPM / 4;

/** The pitch classes the tune may use. */
export const SCALE = ['E', 'F', 'G', 'B', 'C'] as const;

const LEAD = [
  'E4 . . G4 . . B4 . C5 - B4 . G4 . . .',
  'F4 . E4 . . . . . . . B3 . C4 . E4 .',
  'G4 . . E4 . . C4 . E4 - G4 . C5 . . .',
  'B4 . C5 . B4 . G4 . F4 - - - . . . .',
  'E4 . . G4 . . B4 . C5 - B4 . E5 . . .',
  'C5 . B4 . . . . . . . G4 . B4 . C5 .',
  'F4 . . C5 . . B4 . G4 - F4 . G4 . . .',
  'B4 . G4 . F4 . E4 . F4 - - - . . B3 .',
  'E5 . E5 . C5 . B4 . C5 . B4 . G4 . B4 .',
  'C5 - - . G4 . E4 . G4 . C5 . E5 - . .',
  'F5 . E5 . C5 . F4 . G4 . C5 . B4 . C5 .',
  'B4 - - . F4 . G4 . B4 - - - . . . .',
  'E5 . E5 . C5 . B4 . C5 . B4 . G4 . B4 .',
  'C5 - - . E5 . G5 . E5 . C5 . B4 - . .',
  'B4 . C5 . B4 . G4 . F4 . G4 . B4 . C5 .',
  'E5 - - - . . B4 . E4 - - - . . . .',
];

const BASS_E = 'E2 . . E2 . . E3 . E2 . . E2 . B2 E3 .';
const BASS_C = 'C2 . . C2 . . C3 . C2 . . C2 . G2 C3 .';
const BASS_B = 'B1 . . B1 . . B2 . B1 . . B1 . E2 B2 .';
const BASS_F = 'F2 . . F2 . . F3 . F2 . . F2 . C3 F3 .';

const BASS = [
  BASS_E,
  BASS_E,
  BASS_C,
  BASS_B,
  BASS_E,
  BASS_E,
  BASS_F,
  BASS_B,
  BASS_E,
  BASS_C,
  BASS_F,
  BASS_B,
  BASS_E,
  BASS_C,
  BASS_B,
  BASS_E,
];

const REST = '. . . . . . . . . . . . . . . .';
const ARP_E = 'E4 B4 G4 B4 E4 B4 G4 B4 E4 B4 G4 B4 E4 B4 G4 B4';
const ARP_C = 'C4 G4 E4 G4 C4 G4 E4 G4 C4 G4 E4 G4 C4 G4 E4 G4';
const ARP_F = 'F4 C5 G4 C5 F4 C5 G4 C5 F4 C5 G4 C5 F4 C5 G4 C5';
const ARP_B = 'B3 G4 E4 G4 B3 G4 E4 G4 B3 G4 E4 G4 B3 G4 E4 G4';

const ARP = [REST, REST, REST, REST, REST, REST, REST, REST, ARP_E, ARP_C, ARP_F, ARP_B, ARP_E, ARP_C, ARP_B, ARP_E];

/** Drums: `k` kick, `s` snare, `h` hat, `t` tom, `.` nothing. One character per step. */
const DRUM_A = 'k.h.s.h.k.h.s.h.';
const DRUM_B = 'k.hhs.hkk.h.s.hh';
const FILL = 'k.h.s.h.k.h.tttt';

const DRUMS = [
  DRUM_A,
  DRUM_A,
  DRUM_A,
  DRUM_A,
  DRUM_A,
  DRUM_A,
  DRUM_A,
  FILL,
  DRUM_B,
  DRUM_B,
  DRUM_B,
  DRUM_B,
  DRUM_B,
  DRUM_B,
  DRUM_B,
  FILL,
];

export interface Note {
  /** Step in the loop at which the note starts. */
  step: number;
  freq: number;
  /** How many steps it lasts. */
  length: number;
  name: string;
}

export type Drum = 'k' | 's' | 'h' | 't';

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "A4" is 440 Hz; everything else follows in equal temperament. */
export function noteFreq(name: string): number {
  const letter = name[0] ?? '';
  const octave = Number(name.slice(1));
  const semitone = SEMITONES[letter];
  if (semitone === undefined || !Number.isInteger(octave)) throw new Error(`not a note: ${name}`);
  return 440 * 2 ** ((semitone - 9) / 12 + (octave - 4));
}

/** Turns bars of tokens into notes, with every hold folded into the note it extends. */
export function parseTrack(bars: readonly string[]): Note[] {
  const notes: Note[] = [];
  let last: Note | null = null;
  bars.forEach((bar, b) => {
    const tokens = bar.split(' ');
    if (tokens.length !== STEPS_PER_BAR) throw new Error(`bar ${b + 1} has ${tokens.length} steps`);
    tokens.forEach((token, i) => {
      if (token === '-') {
        if (last) last.length += 1;
      } else if (token === '.') {
        last = null;
      } else {
        last = { step: b * STEPS_PER_BAR + i, freq: noteFreq(token), length: 1, name: token };
        notes.push(last);
      }
    });
  });
  return notes;
}

export const SONG = {
  bars: LEAD.length,
  steps: LEAD.length * STEPS_PER_BAR,
  lead: parseTrack(LEAD),
  bass: parseTrack(BASS),
  arp: parseTrack(ARP),
  drums: DRUMS.join(''),
} as const;

/** Seconds one pass of the loop lasts. */
export const LOOP_SECONDS = SONG.steps * STEP_SECONDS;

function index(notes: readonly Note[]): Map<number, Note> {
  return new Map(notes.map((note) => [note.step, note]));
}

const leadAt = index(SONG.lead);
const bassAt = index(SONG.bass);
const arpAt = index(SONG.arp);

export interface StepEvents {
  lead?: Note;
  bass?: Note;
  arp?: Note;
  drum?: Drum;
}

/** Everything that starts on one step of the loop. */
export function stepEvents(step: number): StepEvents {
  const at = ((step % SONG.steps) + SONG.steps) % SONG.steps;
  const drum = SONG.drums[at];
  const events: StepEvents = {};
  const lead = leadAt.get(at);
  const bass = bassAt.get(at);
  const arp = arpAt.get(at);
  if (lead) events.lead = lead;
  if (bass) events.bass = bass;
  if (arp) events.arp = arp;
  if (drum === 'k' || drum === 's' || drum === 'h' || drum === 't') events.drum = drum;
  return events;
}
