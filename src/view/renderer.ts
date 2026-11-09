/**
 * Draws one frame of the run. Composes the camera, the backdrop, the sprites
 * and the effects, in back-to-front order.
 */

import type { Game } from '../core/game.ts';
import { applyShake, inView, ledgeAlpha } from './camera.ts';
import { drawBackdrop, drawDust, drawFloaters, drawShelves, drawVignette } from './fx.ts';
import { drawAuditor, drawBand, drawPlatform, drawPlayer } from './sprites.ts';

export function draw(ctx: CanvasRenderingContext2D, game: Game, reducedMotion: boolean): void {
  const { width: W, height: H } = game;

  // Everything below may translate (screen shake); without save/restore the
  // offset from one frame carried into the next and the scene drifted.
  ctx.save();
  ctx.clearRect(0, 0, W, H);

  drawBackdrop(ctx, game);
  applyShake(ctx, game, reducedMotion);
  drawShelves(ctx, game);

  for (const plat of game.platforms) {
    if (!inView(plat, game)) continue;
    ctx.globalAlpha = ledgeAlpha(plat, game);
    drawPlatform(ctx, plat, game.camY);
    ctx.globalAlpha = 1;
  }

  for (const a of game.auditors) drawAuditor(ctx, a, game.camY);
  drawDust(ctx, game);
  if (game.phase !== 'over') drawPlayer(ctx, game);
  drawFloaters(ctx, game);
  drawVignette(ctx, game);
  drawBand(ctx, game);

  ctx.restore();
}
