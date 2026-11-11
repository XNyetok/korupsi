/**
 * The picture a player shares after a floor: a surat keputusan, the decree an
 * office issues when it appoints someone. It lies on a desk, letterhead,
 * number, stamp, signature and duty stamp all in place, and it appoints the
 * player to whatever the climb earned (core/gelar.ts). The portrait, the
 * number and the envelopes on the desk change with the result too, so two
 * players rarely share the same sheet.
 *
 * It is painted like everything else, a pixel at a time, then scaled up by a
 * whole number so it stays crisp wherever it is posted. Apps that show
 * stories cover the top and bottom of the picture with their own buttons, so
 * the paper sits in the middle and only the desk is under them.
 *
 * Nothing on it is real: no emblem, no agency, no town, no name.
 */

import { clock, type Game, rupiah } from '../core/game.ts';
import { gelarFor, VEST_FROM } from '../core/gelar.ts';
import { C } from './palette.ts';
import { type Ctx, layer, paintLogo, rect, text, textHeight, textWidth } from './pixel.ts';
import { drawAmplop, drawPlayer } from './sprites.ts';

/** The card in game pixels, and how far it is scaled up: 1080 x 1920. */
export const CARD = { width: 216, height: 384, scale: 5 } as const;

/** The sheet of paper on the desk. */
const PAPER = { x: 12, y: 56, w: 192, h: 276 } as const;

/** Characters of the sentence under the title that fit on one line of the paper. */
export const LINE_CHARS = 29;

/** Text drawn `scale` times its size, centred on `cx`. */
function sign(ctx: Ctx, value: string, cx: number, top: number, color: string, big: boolean, scale = 1): void {
  const w = textWidth(value, big);
  const h = textHeight(big);
  const glyphs = layer(Math.max(1, w), h);
  text(glyphs.ctx, value, 0, 0, color, big);
  ctx.drawImage(glyphs.canvas, Math.round(cx - (w * scale) / 2), top, w * scale, h * scale);
}

/** Breaks a sentence into lines of at most `width` characters, at the spaces. */
export function wrap(sentence: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of sentence.split(' ')) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The outline of a circle, a pixel thick. */
function ring(ctx: Ctx, cx: number, cy: number, radius: number, color: string): void {
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    rect(ctx, Math.round(cx + Math.cos(rad) * radius), Math.round(cy + Math.sin(rad) * radius), 1, 1, color);
  }
}

/** The portrait in the corner: a pas foto, or a mugshot for the often caught. */
function portrait(ctx: Ctx, x: number, y: number, game: Game): void {
  const w = 36;
  const h = 48;
  const vest = game.deaths >= VEST_FROM;
  rect(ctx, x - 1, y - 1, w + 2, h + 2, C.ink);
  rect(ctx, x, y, w, h, vest ? C.plasticDark : C.red);
  if (vest) {
    // The height chart behind someone who has been here before.
    for (let line = y + 6; line < y + h; line += 8) rect(ctx, x, line, w, 1, C.metalDark);
  }

  // The player, head and shoulders, at twice the size.
  const sitter = layer(24, 32);
  drawPlayer(sitter.ctx, {
    x: 11,
    sy: 30,
    facing: 1,
    pose: vest ? 'caught' : 'idle',
    time: 0.3,
    stride: 0,
    weight: game.weight,
  });
  ctx.drawImage(sitter.canvas, 2, 1, 18, 24, x, y, w, h);
}

/** A rubber stamp in the violet ink offices use: a ring, and the word across it. */
function rubberStamp(ctx: Ctx, cx: number, cy: number, word: string): void {
  const stamp = layer(48, 48);
  const mid = 24;
  ring(stamp.ctx, mid, mid, 22, C.stampInk);
  ring(stamp.ctx, mid, mid, 21, C.stampInk);
  ring(stamp.ctx, mid, mid, 17, C.stampInk);
  // The band across the middle is cleared so the word is not crossed by the rings.
  stamp.ctx.clearRect(0, mid - 7, 48, 14);
  rect(stamp.ctx, 1, mid - 7, 46, 1, C.stampInk);
  rect(stamp.ctx, 1, mid + 6, 46, 1, C.stampInk);
  sign(stamp.ctx, word, mid, mid - 3, C.stampInk, true);
  for (const dy of [-13, 12]) {
    rect(stamp.ctx, mid - 1, mid + dy, 3, 1, C.stampInk);
    rect(stamp.ctx, mid, mid + dy - 1, 1, 3, C.stampInk);
  }

  // Stamp ink is never quite solid.
  ctx.globalAlpha = 0.85;
  ctx.drawImage(stamp.canvas, Math.round(cx - mid), Math.round(cy - mid));
  ctx.globalAlpha = 1;
}

/** The duty stamp every paper that matters has stuck in its corner. */
function meterai(ctx: Ctx, x: number, y: number): void {
  const w = 35;
  const h = 38;
  rect(ctx, x, y, w, h, C.meterai);
  // perforations
  for (let i = 1; i < w; i += 3) {
    rect(ctx, x + i, y, 1, 1, C.paper);
    rect(ctx, x + i, y + h - 1, 1, 1, C.paper);
  }
  for (let i = 1; i < h; i += 3) {
    rect(ctx, x, y + i, 1, 1, C.paper);
    rect(ctx, x + w - 1, y + i, 1, 1, C.paper);
  }
  rect(ctx, x + 2, y + 2, w - 4, h - 4, C.meteraiDark);
  rect(ctx, x + 3, y + 3, w - 6, h - 6, C.meterai);
  sign(ctx, 'METERAI', x + w / 2, y + 6, C.stampInk, false);
  // a plain ornament where a real one has an emblem
  for (let i = 0; i < 5; i++) rect(ctx, Math.round(x + w / 2) - 5 + i, y + 14 + i, 10 - i * 2, 1, C.meteraiDark);
  sign(ctx, '10000', x + w / 2, y + 25, C.stampInk, true);
}

/** A signature nobody can read, which is the point of a signature. */
function signature(ctx: Ctx, x: number, y: number): void {
  const strokes = [
    [0, 8, 3, 2],
    [3, 2, 6, 10],
    [6, 10, 10, 0],
    [10, 0, 13, 9],
    [13, 9, 18, 4],
    [18, 4, 22, 8],
    [22, 8, 28, 3],
    [28, 3, 30, 7],
    [30, 7, 44, 5],
  ] as const;
  for (const [x1, y1, x2, y2] of strokes) {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let i = 0; i <= steps; i++) {
      rect(
        ctx,
        x + Math.round(x1 + ((x2 - x1) * i) / steps),
        y + Math.round(y1 + ((y2 - y1) * i) / steps),
        1,
        1,
        C.navy,
      );
    }
  }
}

export function paintShareCard(game: Game): HTMLCanvasElement {
  const { width: W, height: H, scale } = CARD;
  const { canvas, ctx } = layer(W, H);
  const mid = W / 2;
  const total = game.floor.amplop.length;
  const gelar = gelarFor({ time: game.time, deaths: game.deaths, weight: game.weight, total });

  // ----- the desk -----
  rect(ctx, 0, 0, W, H, C.woodDark);
  for (let y = 5; y < H; y += 9) {
    rect(ctx, 0, y, W, 1, C.woodDeep);
    rect(ctx, (y * 37) % W, y - 3, 46, 1, C.wood);
  }

  const logo = document.createElement('canvas');
  paintLogo(logo, C.gold, C.ink);
  ctx.drawImage(logo, Math.round(mid - (logo.width * 3) / 2), 16, logo.width * 3, logo.height * 3);

  // ----- the paper -----
  const { x: px, y: py, w: pw, h: ph } = PAPER;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.fillRect(px + 3, py + 3, pw, ph);
  rect(ctx, px, py, pw, ph, C.paper);
  // a dog-eared corner
  for (let i = 0; i < 9; i++) {
    rect(ctx, px + pw - 9 + i, py, 9 - i, 1 + i, C.woodDark);
    rect(ctx, px + pw - 9 + i, py + i, 1, 9 - i, C.paperDark);
  }

  // letterhead
  sign(ctx, 'PEMKOT ANTAH BERANTAH', mid, py + 8, C.metalDark, true);
  sign(ctx, 'KANTOR KELURAHAN', mid, py + 18, C.ink, true);
  sign(ctx, 'JL. JALAN DI TEMPAT NO. 1', mid, py + 28, C.metalDark, true);
  rect(ctx, px + 8, py + 38, pw - 16, 2, C.ink);
  rect(ctx, px + 8, py + 41, pw - 16, 1, C.ink);

  // The number of the decree is the result, the way an office files things.
  const filed = clock(game.time).replace(':', '');
  sign(ctx, 'SURAT KEPUTUSAN', mid, py + 48, C.ink, true);
  sign(ctx, `NOMOR: ${filed}/KEL/OTT-${game.deaths}/AMP-${game.weight}`, mid, py + 58, C.metalDark, true);

  // what it decides
  sign(ctx, 'MENETAPKAN SAUDARA SEBAGAI', mid, py + 72, C.metalDark, true);
  sign(ctx, gelar.title, mid, py + 83, C.redDark, true, 2);
  const titleWidth = textWidth(gelar.title, true) * 2;
  rect(ctx, Math.round(mid - titleWidth / 2), py + 99, titleWidth, 1, C.redDark);
  wrap(gelar.line.toUpperCase(), LINE_CHARS).forEach((line, i) => {
    sign(ctx, line, mid, py + 105 + i * 10, C.ink, true);
  });
  rect(ctx, px + 8, py + 127, pw - 16, 1, C.paperDark);

  // the portrait, and the figures beside it
  portrait(ctx, px + 12, py + 134, game);
  const rows: [string, string][] = [
    ['WAKTU', clock(game.time)],
    ['OTT', String(game.deaths)],
    ['AMPLOP', `${game.weight}/${total}`],
    ['UANG', rupiah(game.money)],
  ];
  rows.forEach(([label, value], i) => {
    const top = py + 138 + i * 11;
    text(ctx, label, px + 58, top, C.metalDark, true);
    text(ctx, value, px + 102, top, C.ink, true);
  });

  // signed, stamped and paid for
  meterai(ctx, px + 12, py + 192);
  text(ctx, 'DITETAPKAN OLEH', px + 98, py + 192, C.ink, true);
  text(ctx, 'LURAH,', px + 98, py + 202, C.ink, true);
  signature(ctx, px + 92, py + 213);
  rect(ctx, px + 98, py + 228, 84, 1, C.ink);
  text(ctx, 'NIP. 0000 0000', px + 98, py + 232, C.metalDark, true);
  rubberStamp(ctx, px + 74, py + 216, 'LOLOS');

  // copies to
  rect(ctx, px + 8, py + 246, pw - 16, 1, C.paperDark);
  text(ctx, 'TEMBUSAN:', px + 12, py + 252, C.metalDark, true);
  text(ctx, 'TIM AUDIT (MASIH DI LOBI)', px + 12, py + 262, C.ink, true);

  // ----- what was carried out, left on the desk -----
  const spacing = 18;
  const first = mid - ((game.weight - 1) * spacing) / 2;
  for (let i = 0; i < game.weight; i++) drawAmplop(ctx, Math.round(first + i * spacing), 347, i * 0.9);

  const site = 'KORUPSI.WEB.ID';
  rect(ctx, Math.round(mid - textWidth(site, true) / 2) - 5, 359, textWidth(site, true) + 10, 15, C.ink);
  sign(ctx, site, mid, 363, C.gold, true);

  const out = layer(W * scale, H * scale);
  out.ctx.drawImage(canvas, 0, 0, W * scale, H * scale);
  return out.canvas;
}
