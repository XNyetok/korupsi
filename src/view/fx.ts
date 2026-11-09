/**
 * Everything drawn that is not a thing in the world: the backdrop, the shelf
 * lines that show the climb, dust, the floating amounts, the vignette.
 */

import type { Game } from '../core/game.ts';
import { clamp } from '../core/physics.ts';
import { PALETTE as C } from './palette.ts';

export function drawBackdrop(ctx: CanvasRenderingContext2D, game: Game): void {
  const { width: W, height: H } = game;
  ctx.fillStyle = C.inkDeep;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, H * 0.04, 20, W / 2, H * 0.2, H * 0.85);
  glow.addColorStop(0, 'rgba(227, 176, 75, 0.09)');
  glow.addColorStop(0.5, 'rgba(227, 176, 75, 0.025)');
  glow.addColorStop(1, 'rgba(227, 176, 75, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

export function drawShelves(ctx: CanvasRenderingContext2D, game: Game): void {
  const { width: W, height: H } = game;
  // shelf lines: the only thing telling you how far you have climbed
  const gap = 88;
  const first = Math.ceil(game.camY / gap) * gap;
  for (let wy = first; wy < game.camY + H + gap; wy += gap) {
    const sy = wy - game.camY;
    ctx.fillStyle = 'rgba(240, 233, 219, 0.035)';
    ctx.fillRect(0, sy, W, 1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(0, sy + 1, W, 6);
  }

  ctx.fillStyle = 'rgba(240, 233, 219, 0.03)';
  ctx.fillRect(0, 0, 3, H);
  ctx.fillRect(W - 3, 0, 3, H);
}

export function drawDust(ctx: CanvasRenderingContext2D, game: Game): void {
  for (const d of game.dust) {
    const a = clamp(1 - d.t / d.life, 0, 1);
    ctx.fillStyle = `rgba(201, 192, 175, ${a * 0.5})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y - game.camY, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawFloaters(ctx: CanvasRenderingContext2D, game: Game): void {
  const W = game.width;
  ctx.textAlign = 'center';
  for (const f of game.floaters) {
    const life = clamp(1 - f.t / 1.2, 0, 1);
    const pop = 1 + Math.max(0, 0.22 - f.t) * 1.6;
    ctx.save();
    // Keep the text on screen when the ledge it belongs to is against a wall.
    ctx.translate(clamp(f.x, 44, W - 44), f.y - game.camY);
    ctx.scale(pop, pop);
    ctx.font = '700 10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = `rgba(227, 176, 75, ${life})`;
    ctx.fillText(f.text, 0, 0);
    ctx.restore();
  }
}

export function drawVignette(ctx: CanvasRenderingContext2D, game: Game): void {
  const { width: W, height: H } = game;
  const vig = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.22, W / 2, H * 0.55, H * 0.85);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}
