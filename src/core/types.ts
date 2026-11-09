/** The shapes the simulation works with. No behaviour here. */

export type PlatformType = 'solid' | 'krat' | 'fiktif';
export type Phase = 'ready' | 'playing' | 'paused' | 'over';
export type Cause = 'auditor' | 'band' | 'fall' | 'abandoned' | '';

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
