/**
 * How a body moves: the jump arc, the walls, and where a fall meets a ledge.
 * Pure functions over plain data, so the arithmetic can be checked on its own.
 */

import { PARAMS } from './params.ts';
import type { Platform, Player } from './types.ts';

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** The player's feet never get closer to a wall than this. */
export const PLAYER_EDGE = 12;

/** How far past a ledge's end a foot still counts as on it. */
const LANDING_SLACK = 6;

export interface Envelope {
  jv: number;
  h: number;
  air: number;
  dxAt(dy: number): number;
}

/** The arc of a jump at this fraction of full strength. */
export function envelope(factor: number): Envelope {
  const jv = PARAMS.jumpV * factor;
  const g = PARAMS.gravity;
  const h = (jv * jv) / (2 * g);
  const air = (2 * jv) / g;
  return {
    jv,
    h,
    air,
    dxAt(dy: number) {
      const inner = Math.max(0, jv * jv - 2 * g * dy);
      const t = (jv + Math.sqrt(inner)) / g;
      return PARAMS.moveVX * t;
    },
  };
}

/** Where a jump in this direction comes down: horizontal speed is constant, walls stop it. */
export function landingX(anchorX: number, dir: number, travel: number, width: number): number {
  return clamp(anchorX + dir * travel, PLAYER_EDGE, width - PLAYER_EDGE);
}

/** Starts a jump from the ground. */
export function launch(p: Player, dir: number, factor: number): void {
  p.vy = -PARAMS.jumpV * factor;
  p.vx = dir * PARAMS.moveVX;
  p.dir = dir;
  p.onGround = null;
}

/** Keeps a standing player on their ledge and inside the walls. */
export function stand(p: Player, ground: Platform, width: number): void {
  p.x = clamp(p.x, PLAYER_EDGE, width - PLAYER_EDGE);
  p.y = ground.y;
  p.vx = 0;
  p.vy = 0;
}

/** One step of flight: gravity, then movement, then the walls stop sideways motion. */
export function fly(p: Player, dt: number, width: number): void {
  p.vy += PARAMS.gravity * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  if (p.x < PLAYER_EDGE) {
    p.x = PLAYER_EDGE;
    p.vx = 0;
  } else if (p.x > width - PLAYER_EDGE) {
    p.x = width - PLAYER_EDGE;
    p.vx = 0;
  }
}

/** The first ledge, in scene order, that a falling player crossed during this step. */
export function findLanding(platforms: readonly Platform[], p: Player, prevY: number): Platform | null {
  if (p.vy <= 0) return null;
  for (const plat of platforms) {
    if (!plat.alive) continue;
    if (prevY <= plat.y && p.y >= plat.y && Math.abs(p.x - plat.x) <= plat.w / 2 + LANDING_SLACK) return plat;
  }
  return null;
}
