/**
 * Numbers and colours in one place. Everything that a designer would want to
 * move lives here, not inside the simulation.
 */

export const PARAMS = {
  // movement
  gravity: 1900,
  jumpV: 700,
  moveVX: 115,
  weightPenalty: 0.03,
  minFactor: 0.45,

  // level shape
  gapMin: 0.42,
  gapMax: 0.62,
  minLedgeOffset: 58,
  goldChance: 0.45,
  doubleGoldChance: 0,

  // pressure
  cameraBase: 26,
  cameraAccel: 1.3,

  // things
  crumbleDelay: 0.45,
  moneyValue: 500000,

  // score
  pixelsPerMetre: 6,
};

export type Params = typeof PARAMS;

export const PALETTE = {
  ink: '#0A0E14',
  inkDeep: '#070A0E',
  paper: '#F0E9DB',
  paperMid: '#C9C0AF',
  paperDark: '#8F8674',
  crate: '#8A6A4B',
  crateDark: '#664C33',
  gold: '#E3B04B',
  goldLight: '#F4D58D',
  goldDark: '#986D1D',
  red: '#D9483B',
  slate: '#7C8896',
  suit: '#1F2A37',
  skin: '#E8D3B8',
} as const;

export type PlatformType = 'solid' | 'krat' | 'fiktif';
export type Phase = 'ready' | 'playing' | 'over';
export type Cause = 'auditor' | 'band' | 'fall' | '';

export interface Platform {
  id: number;
  x: number;
  y: number;
  w: number;
  gold: boolean;
  type: PlatformType;
  crumble: number;
  alive: boolean;
  taken: boolean;
}

export interface Auditor {
  upper: Platform;
  x: number;
  y: number;
  dir: number;
  speed: number;
  w: number;
  h: number;
  minX: number;
  maxX: number;
}

export interface Floater {
  x: number;
  y: number;
  t: number;
  text: string;
}

export interface Dust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  t: number;
  r: number;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: Platform | null;
  dir: number;
}

export interface Best {
  money: number;
  height: number;
}
