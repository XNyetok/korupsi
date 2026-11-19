/**
 * The tower: each floor is placed by hand. Hazards are pure functions of the
 * world clock, so the simulation, the tests and the view all agree on where an
 * auditor or a stamp is without sharing any state.
 *
 * Kelurahan's next ledge is about 28 px up and the one after it at least 54 px
 * up, so every jump works empty and full without skipping the route. In
 * Kecamatan, lifts bridge taller gaps and connect broader landings.
 */

import type { AuditorDef, FloorDef, LedgeDef, PrinterDef, StampDef } from './types.ts';

/** The stamp head's size, how high it rests above its ledge, and its timing. */
export const STAMP = { w: 28, h: 10, lift: 34, warn: 0.45, slam: 0.1, hold: 0.45, rise: 0.5 } as const;

export const AUDITOR = { half: 4, height: 24 } as const;
export const PAPER = { warn: 0.6, speed: 90, half: 6, height: 8 } as const;

export const KELURAHAN: FloorDef = {
  id: 'kelurahan',
  name: 'Kelurahan',
  // Four storeys of 140, and a strip of the floor above so the door has headroom.
  height: 596,
  ledges: [
    /*  0 */ { x: 0, y: 0, w: 384, skin: 'lantai' },
    // The lobby: nothing here can end a life, only cost a few seconds.
    /*  1 */ { x: 36, y: 26, w: 68, skin: 'meja' },
    /*  2 */ { x: 130, y: 54, w: 64, skin: 'rak' },
    /*  3 */ { x: 220, y: 84, w: 46, skin: 'lemari' },
    /*  4 */ { x: 292, y: 114, w: 52, skin: 'ac' },
    /*  5 */ { x: 204, y: 142, w: 40, kind: 'troli', travel: 34, period: 4.5 },
    /*  6 */ { x: 96, y: 170, w: 50, skin: 'ac' },
    /*  7 */ { x: 18, y: 198, w: 34, skin: 'rak' },
    // Projects that only exist on paper, then the first auditor.
    /*  8 */ { x: 164, y: 198, w: 40, kind: 'fiktif' },
    /*  9 */ { x: 228, y: 226, w: 36, kind: 'fiktif' },
    /* 10 */ { x: 286, y: 254, w: 84, skin: 'meja' },
    /* 11 */ { x: 204, y: 284, w: 56, skin: 'lemari' },
    // The stamp, a gap that needs a dash, and an auditor in the way.
    // The desk reaches to the machine's cabinet, so a jump from the machine
    // that falls short lands on it rather than below the tape.
    /* 12 */ { x: 96, y: 312, w: 104, skin: 'meja' },
    /* 13 */ { x: 24, y: 340, w: 62, skin: 'rak' },
    // Clear of the stamp below: its knob rises past this shelf.
    /* 14 */ { x: 150, y: 366, w: 40, skin: 'rak' },
    /* 15 */ { x: 226, y: 394, w: 40, kind: 'troli', travel: 36, period: 4.2, phase: 1.3 },
    /* 16 */ { x: 322, y: 402, w: 34, kind: 'fiktif' },
    /* 17 */ { x: 92, y: 422, w: 112, skin: 'meja' },
    /* 18 */ { x: 26, y: 450, w: 42, skin: 'lemari' },
    // The last desk before the door.
    /* 19 */ { x: 96, y: 478, w: 76, skin: 'meja' },
    /* 20 */ { x: 204, y: 506, w: 180, skin: 'balkon' },
  ],
  // A running jump onto a hazard's desk lands out of its reach: the first
  // auditor turns short of where the jump from the fiktif ledge comes down,
  // and the first stamp hangs short of where the jump from the machine does.
  auditors: [
    { ledge: 10, from: 326, to: 362, speed: 26 },
    { ledge: 17, from: 106, to: 172, speed: 32 },
  ],
  stamps: [
    { ledge: 12, x: 130, period: 2.8, offset: 0 },
    { ledge: 19, x: 134, period: 2.4, offset: 0.9 },
  ],
  amplop: [
    { x: 340, y: 12 },
    { x: 35, y: 210 },
    { x: 184, y: 250 },
    { x: 360, y: 266 },
    { x: 339, y: 414 },
    { x: 134, y: 488 },
  ],
  checkpoints: [
    { ledge: 0, x: 190 },
    { ledge: 11, x: 232 },
    { ledge: 18, x: 47 },
  ],
  exit: { ledge: 20, x: 348, label: 'KECAMATAN' },
};

// The opening was tested on its own before building the rooms above it.
export const ATRIUM_LEDGES: LedgeDef[] = [
  /* 0 */ { x: 0, y: 0, w: 384 },
  /* 1 */ { x: 150, y: 0, w: 100, kind: 'lift', liftTo: 114 },
  /* 2 */ { x: 270, y: 114, w: 114 },
];
export const ATRIUM_SPAWN = { ledge: 0, x: 42 };
export const VERIFICATION = { ledge: 2, x: 350, label: 'VERIFIKASI' };

export const KECAMATAN: FloorDef = {
  id: 'kecamatan',
  name: 'Kecamatan',
  height: 492,
  ledges: [
    ...ATRIUM_LEDGES,
    // The glass balcony turns back through the counters to the mail lift.
    /*  3 */ { x: 321, y: 142, w: 58 },
    /*  4 */ { x: 223, y: 170, w: 75 },
    /*  5 */ { x: 82, y: 198, w: 121 },
    /*  6 */ { x: 10, y: 198, w: 78, kind: 'lift', liftTo: 306 },
    // A safe landing and a clock-in machine before the papers reach the walk.
    /*  7 */ { x: 106, y: 306, w: 183 },
    /*  8 */ { x: 304, y: 334, w: 67 },
    /*  9 */ { x: 217, y: 362, w: 72 },
    /* 10 */ { x: 91, y: 389, w: 113 },
  ],
  auditors: [],
  stamps: [],
  printers: [{ ledge: 7, x: 191, to: 264, period: 3.9 }],
  amplop: [
    { x: 21, y: 12 },
    { x: 371, y: 120 },
    { x: 360, y: 154 },
    { x: 174, y: 210 },
    { x: 242, y: 317 },
    { x: 358, y: 346 },
    { x: 189, y: 417 },
  ],
  checkpoints: [ATRIUM_SPAWN, { ledge: 2, x: 306 }, { ledge: 7, x: 144 }],
  exit: { ledge: 10, x: 151, label: 'DINAS' },
};

export const FLOORS: readonly [FloorDef, ...FloorDef[]] = [KELURAHAN, KECAMATAN];

export interface PrinterState {
  warning: boolean;
  /** Centre of the flying bundle, or null when the desk is clear. */
  paper: number | null;
}

export function printerAt(def: PrinterDef, t: number): PrinterState {
  const flight = Math.abs(def.to - def.x) / PAPER.speed;
  const elapsed = (t + (def.offset ?? 0)) % def.period;
  const sinceLaunch = elapsed - (def.period - flight);
  return {
    warning: sinceLaunch < 0 && sinceLaunch >= -PAPER.warn,
    paper: sinceLaunch < 0 ? null : def.x + Math.sign(def.to - def.x) * sinceLaunch * PAPER.speed,
  };
}

/** The left edge of a ledge at world time `t`. Only a troli moves. */
export function ledgeX(def: LedgeDef, t: number): number {
  if (def.kind !== 'troli' || !def.travel) return def.x;
  const period = def.period ?? 4;
  return def.x + def.travel * Math.sin((t / period) * Math.PI * 2 + (def.phase ?? 0));
}

export interface AuditorState {
  x: number;
  dir: -1 | 1;
}

/** Back and forth at a constant pace. */
export function auditorAt(def: AuditorDef, t: number): AuditorState {
  const span = def.to - def.from;
  const u = (t * def.speed) % (span * 2);
  return u < span ? { x: def.from + u, dir: 1 } : { x: def.to - (u - span), dir: -1 };
}

export type StampPhase = 'rest' | 'warn' | 'slam' | 'hold' | 'rise';

export interface StampState {
  phase: StampPhase;
  /** 1 fully raised, 0 down on the desk. */
  lift: number;
  /** Progress through the current phase, 0 to 1. */
  progress: number;
}

/**
 * One cycle: rest raised, shake as a warning, slam, hold on the desk, rise.
 * Only the slam and the hold can catch the player.
 */
export function stampAt(def: StampDef, t: number): StampState {
  const busy = STAMP.warn + STAMP.slam + STAMP.hold + STAMP.rise;
  const rest = Math.max(0.2, def.period - busy);
  let u = (t + def.offset) % (rest + busy);

  if (u < rest) return { phase: 'rest', lift: 1, progress: u / rest };
  u -= rest;
  if (u < STAMP.warn) return { phase: 'warn', lift: 1, progress: u / STAMP.warn };
  u -= STAMP.warn;
  if (u < STAMP.slam) {
    const k = u / STAMP.slam;
    return { phase: 'slam', lift: 1 - k * k, progress: k };
  }
  u -= STAMP.slam;
  if (u < STAMP.hold) return { phase: 'hold', lift: 0, progress: u / STAMP.hold };
  u -= STAMP.hold;
  const k = u / STAMP.rise;
  return { phase: 'rise', lift: k, progress: k };
}

/** True while the stamp is coming down or resting on the desk. */
export function stampBites(state: StampState): boolean {
  return state.phase === 'slam' || state.phase === 'hold';
}
