/** The shapes the simulation works with. No behaviour here. */

export type Phase = 'ready' | 'playing' | 'paused' | 'won';

/** What ended a life. `jatuh` is a fall past the audit line. */
export type Cause = 'auditor' | 'stempel' | 'jatuh';

/** `fiktif` crumbles after it is touched; `troli` rolls from side to side. */
export type LedgeKind = 'solid' | 'fiktif' | 'troli';

/** What a ledge looks like. Only the view reads it. */
export type Skin = 'lantai' | 'meja' | 'rak' | 'lemari' | 'ac' | 'balkon';

/**
 * A ledge is a one-way platform: it is landed on from above and passed
 * through from below. `x` is its left edge, `y` the height of its surface
 * above the ground floor.
 */
export interface LedgeDef {
  x: number;
  y: number;
  w: number;
  kind?: LedgeKind;
  skin?: Skin;
  /** troli: how far it rolls each side of `x`, and how long a round trip takes. */
  travel?: number;
  period?: number;
  phase?: number;
}

/** An auditor walks a ledge between `from` and `to`. */
export interface AuditorDef {
  ledge: number;
  from: number;
  to: number;
  speed: number;
}

/** A stamp comes down on a ledge, centred on `x`, once every `period` seconds. */
export interface StampDef {
  ledge: number;
  x: number;
  period: number;
  offset: number;
}

export interface Point {
  x: number;
  y: number;
}

/** A spot on a ledge: the spawn, a checkpoint, the exit. */
export interface Spot {
  ledge: number;
  x: number;
}

export interface FloorDef {
  name: string;
  height: number;
  ledges: LedgeDef[];
  auditors: AuditorDef[];
  stamps: StampDef[];
  amplop: Point[];
  /** The first checkpoint is the spawn. */
  checkpoints: Spot[];
  exit: Spot;
}

export interface Player {
  /** Centre. */
  x: number;
  /** Feet, above the ground floor. */
  y: number;
  vx: number;
  vy: number;
  facing: -1 | 1;
  /** Index of the ledge underfoot, or -1 in the air. */
  ground: number;
  coyote: number;
  buffer: number;
  /** True from a jump until the button is released or the apex is passed. */
  rising: boolean;
  dashT: number;
  dashDir: -1 | 1;
  dashCool: number;
  /** One dash per time in the air; landing gives it back. */
  dashReady: boolean;
}

/** What the player is holding down this step. */
export interface Input {
  move: -1 | 0 | 1;
  jump: boolean;
  dash: boolean;
}

export type GameEventType =
  | 'jump'
  | 'land'
  | 'dash'
  | 'collect'
  | 'caught'
  | 'respawn'
  | 'checkpoint'
  | 'crumble'
  | 'stamp'
  | 'win';

/** Something the view and the sound may want to react to. */
export interface GameEvent {
  type: GameEventType;
  x: number;
  y: number;
  cause?: Cause;
}

export interface Best {
  /** Fastest finish in seconds, or 0 when the floor was never finished. */
  time: number;
  /** Most money carried out. */
  money: number;
}

export interface BestStore {
  read(): Best;
  write(best: Best): void;
}
