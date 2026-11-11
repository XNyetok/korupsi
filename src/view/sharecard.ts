/**
 * The picture a player shares after a floor: a tall card, the shape of a
 * story, with the moment at the door, the time, and what was carried out. It
 * is painted like everything else, a pixel at a time, then scaled up by a
 * whole number so it stays crisp wherever it is posted.
 *
 * Apps that show stories cover the top and bottom of the picture with their
 * own buttons, so everything that matters sits in the middle.
 */

import { clock, type Game, rupiah } from '../core/game.ts';
import { C } from './palette.ts';
import { type Ctx, layer, paintLogo, rect, text, textHeight, textWidth } from './pixel.ts';
import { Renderer } from './renderer.ts';

/** The card in game pixels, and how far it is scaled up: 1080 x 1920. */
export const CARD = { width: 216, height: 384, scale: 5 } as const;

/** Rows of the tower the picture of the door shows. */
const SCENE_ROWS = 112;

/** Text drawn `scale` times its size, centred on `cx`. */
function sign(ctx: Ctx, value: string, cx: number, top: number, color: string, big: boolean, scale: number): void {
  const w = textWidth(value, big);
  const h = textHeight(big);
  const glyphs = layer(Math.max(1, w), h);
  text(glyphs.ctx, value, 0, 0, color, big);
  ctx.drawImage(glyphs.canvas, Math.round(cx - (w * scale) / 2), top, w * scale, h * scale);
}

export function paintShareCard(game: Game): HTMLCanvasElement {
  const { width: W, height: H, scale } = CARD;
  const { canvas, ctx } = layer(W, H);
  const mid = W / 2;
  const total = game.floor.amplop.length;

  // The wall, with a strip light where a story's header will sit.
  rect(ctx, 0, 0, W, H, C.card);
  rect(ctx, 0, 0, W, 50, C.wallDark);
  rect(ctx, mid - 18, 28, 36, 2, C.metalDark);
  rect(ctx, mid - 16, 30, 32, 2, C.lamp);
  rect(ctx, 0, 50, W, 1, C.trim);
  rect(ctx, 0, 51, W, 1, C.ink);

  const logo = document.createElement('canvas');
  paintLogo(logo, C.gold, C.redDark);
  ctx.drawImage(logo, Math.round(mid - logo.width * 2), 58, logo.width * 4, logo.height * 4);

  // The moment itself: the player at the door, drawn by the game's own renderer.
  const scene = layer(W, SCENE_ROWS);
  const renderer = new Renderer(scene.ctx, game, true);
  renderer.resize(W, SCENE_ROWS);
  renderer.snap(game);
  renderer.draw(game, 0);
  rect(ctx, 0, 98, W, SCENE_ROWS + 4, C.ink);
  rect(ctx, 0, 99, W, 1, C.gold);
  ctx.drawImage(scene.canvas, 0, 100);
  rect(ctx, 0, 100 + SCENE_ROWS, W, 1, C.gold);

  // LOLOS, stamped.
  rect(ctx, mid - 38, 221, 76, 22, C.green);
  rect(ctx, mid - 36, 223, 72, 18, C.card);
  sign(ctx, 'LOLOS', mid, 225, C.green, true, 2);

  sign(ctx, clock(game.time), mid, 250, C.paper, true, 4);
  sign(ctx, rupiah(game.money), mid, 286, C.gold, true, 2);
  sign(ctx, `OTT ${game.deaths} - AMPLOP ${game.weight}/${total}`, mid, 307, C.paperDark, false, 2);
  sign(ctx, 'KORUPSI.WEB.ID', mid, 322, C.gold, true, 1);

  // The lobby floor, and a dare, where a story's reply bar will sit.
  rect(ctx, 0, 336, W, H - 336, C.tile);
  for (let x = 0; x < W; x += 16) {
    for (let y = 0; y < H - 336; y += 8) {
      if ((x / 16) % 2 === (y / 8) % 2) rect(ctx, x, 336 + y, 16, 8, C.tileDark);
    }
  }
  rect(ctx, 0, 336, W, 1, C.paper);
  rect(ctx, 0, 337, W, 1, C.tileLine);
  const dare = 'BISA LEBIH CEPAT?';
  rect(ctx, mid - textWidth(dare, true) / 2 - 5, 347, textWidth(dare, true) + 10, 15, C.ink);
  sign(ctx, dare, mid, 351, C.paper, true, 1);

  const out = layer(W * scale, H * scale);
  out.ctx.drawImage(canvas, 0, 0, W * scale, H * scale);
  return out.canvas;
}
