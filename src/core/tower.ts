/**
 * The tower: each floor is placed by hand. Hazards are pure functions of the
 * world clock, so the simulation, the tests and the view all agree on where an
 * auditor or a stamp is without sharing any state.
 *
 * Spacing rules the floor is built on (checked in tests/tower.test.ts):
 * - the next ledge on the route is about 28 px up, which a full load of
 *   envelopes still clears;
 * - the ledge after that is at least 54 px up, which nobody clears, so the
 *   route cannot be skipped.
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

export const KECAMATAN: FloorDef = {
  id: 'kecamatan',
  name: 'Kecamatan',
  height: 514,
  ledges: [
    /*  0 */ { x: 0, y: 0, w: 384, skin: 'lantai' },
    // The reception desks turn back towards the legalisation counter.
    /*  1 */ { x: 94, y: 28, w: 60, skin: 'meja' },
    /*  2 */ { x: 176, y: 56, w: 54, skin: 'lemari' },
    /*  3 */ { x: 254, y: 84, w: 54, skin: 'meja' },
    /*  4 */ { x: 322, y: 112, w: 48, skin: 'rak' },
    /*  5 */ { x: 257, y: 140, w: 58, skin: 'lemari' },
    // The copier stops short of the landing. Cross its desk to reach the archive.
    /*  6 */ { x: 127, y: 168, w: 122, skin: 'meja' },
    /*  7 */ { x: 62, y: 196, w: 50, skin: 'rak' },
    /*  8 */ { x: 10, y: 224, w: 36, skin: 'lemari' },
    /*  9 */ { x: 64, y: 252, w: 42, kind: 'troli', travel: 22, period: 3.6 },
    /* 10 */ { x: 148, y: 280, w: 42, kind: 'fiktif' },
    /* 11 */ { x: 205, y: 308, w: 92, skin: 'meja' },
    /* 12 */ { x: 311, y: 336, w: 54, skin: 'lemari' },
    // A shorter copier cycle, then the stamp below the Camat's balcony.
    /* 13 */ { x: 201, y: 364, w: 90, skin: 'meja' },
    /* 14 */ { x: 125, y: 392, w: 50, skin: 'rak' },
    /* 15 */ { x: 42, y: 420, w: 55, skin: 'meja' },
    /* 16 */ { x: 108, y: 448, w: 212, skin: 'balkon' },
  ],
  auditors: [{ ledge: 11, from: 251, to: 283, speed: 30 }],
  stamps: [{ ledge: 15, x: 63, period: 2.9, offset: 0.4 }],
  printers: [
    { ledge: 6, x: 142, to: 204, period: 3.4 },
    { ledge: 13, x: 215, to: 246, period: 2.7, offset: 0.8 },
  ],
  amplop: [
    { x: 138, y: 40 },
    { x: 355, y: 124 },
    { x: 167, y: 180 },
    { x: 24, y: 236 },
    { x: 280, y: 320 },
    { x: 229, y: 376 },
    { x: 62, y: 432 },
  ],
  checkpoints: [
    { ledge: 0, x: 68 },
    { ledge: 5, x: 280 },
    { ledge: 12, x: 321 },
  ],
  exit: { ledge: 16, x: 222, label: 'DINAS' },
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
