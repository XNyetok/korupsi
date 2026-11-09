/**
 * How the world maps onto the screen beyond the scale: the shake after a
 * death, and which ledges are in view and how far behind the player they are.
 */

import type { Game } from '../core/game.ts';
import { clamp } from '../core/physics.ts';
import type { Platform } from '../core/types.ts';

/** Ledges this far outside the view are skipped. */
const CULL_MARGIN = 60;

/** Shakes the frame after a death. Cosmetic, so it does not use the run's seed. */
export function applyShake(ctx: CanvasRenderingContext2D, game: Game, reducedMotion: boolean): void {
  if (game.shake > 0 && !reducedMotion) {
    const s = game.shake * 7;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
}

export function inView(plat: Platform, game: Game): boolean {
  const top = plat.y - game.camY;
  return !(top < -CULL_MARGIN || top > game.height + CULL_MARGIN);
}

/**
 * Ledges behind the player stay visible, just dimmer with distance: the
 * route taken is part of the scenery, not something that vanished.
 */
export function ledgeAlpha(plat: Platform, game: Game): number {
  const H = game.height;
  let alpha = 1;
  if (plat !== game.player.onGround && plat.y > game.player.y) {
    alpha = clamp(1 - (plat.y - game.player.y) / (H * 0.95), 0.34, 1);
  }
  return alpha;
}
