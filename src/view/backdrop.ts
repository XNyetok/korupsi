/**
 * The scenery, painted once into two canvases: the dusk outside, and the
 * office wall with holes where its windows are. The renderer scrolls the sky
 * slower than the wall, so the town sinks away as the player climbs.
 *
 * Nothing here can be stood on, so it is kept darker and flatter than the
 * ledges: the last step tints the whole wall towards its own colour.
 */

import { WORLD_WIDTH as W } from '../core/params.ts';
import type { FloorDef } from '../core/types.ts';
import { C } from './palette.ts';
import { type Ctx, layer, rect, seeded, text, textCentred, textHeight, textWidth } from './pixel.ts';

/** Pixels of floor drawn below the ground line. */
export const BASE = 20;
/** Height of one storey of the building. */
export const STOREY = 140;
/** How much of the camera's travel the sky follows. */
export const PARALLAX = 0.35;

export interface Backdrop {
  sky: HTMLCanvasElement;
  wall: HTMLCanvasElement;
}

export function paintBackdrop(floor: FloorDef, maxView: number): Backdrop {
  const skyHeight = Math.ceil(maxView + (floor.height + BASE) * PARALLAX) + 8;
  return { sky: paintSky(skyHeight), wall: paintWall(floor) };
}

// ---------- the dusk ----------

function paintSky(height: number): HTMLCanvasElement {
  const { canvas, ctx } = layer(W, height);
  const random = seeded(1945);

  // Bands of colour from night at the top to the glow at the horizon, with a
  // dithered row or two where they meet.
  const horizon = height - 70;
  const band = horizon / (C.sky.length - 1);
  for (let i = 0; i < C.sky.length; i++) {
    const top = Math.round(i * band - band / 2);
    rect(ctx, 0, Math.max(0, top), W, Math.ceil(band) + 1, C.sky[i] as string);
    if (i > 0) {
      for (let x = 0; x < W; x += 2) {
        rect(ctx, x, top - 1, 1, 1, C.sky[i] as string);
        rect(ctx, x + 1, top, 1, 1, C.sky[i - 1] as string);
      }
    }
  }
  rect(ctx, 0, horizon, W, height - horizon, C.sky[C.sky.length - 1] as string);

  // The sun, low and wide.
  const sunX = 250;
  const sunY = horizon - 18;
  for (let dy = -20; dy <= 20; dy++) {
    const half = Math.round(Math.sqrt(400 - dy * dy));
    rect(ctx, sunX - half, sunY + dy, half * 2, 1, C.sun);
  }

  // Clouds are flat strips that cut across it.
  for (let i = 0; i < 16; i++) {
    const cy = Math.round(horizon - 150 * random() - 4);
    const cx = Math.round(random() * W) - 30;
    const cw = 30 + Math.round(random() * 60);
    rect(ctx, cx, cy, cw, 2, C.cloud);
    rect(ctx, cx + 6, cy - 1, cw - 18, 1, C.cloud);
    rect(ctx, cx + 10, cy + 2, cw - 14, 1, C.cloud);
  }

  // A kite, because it is that time of day.
  const kx = 96;
  const ky = Math.round(horizon - 190);
  for (let i = 0; i < 4; i++) rect(ctx, kx - i, ky + i, 1 + i * 2, 1, C.gold);
  for (let i = 0; i < 4; i++) rect(ctx, kx - 3 + i, ky + 4 + i, 7 - i * 2, 1, C.red);
  for (let i = 0; i < 12; i++) rect(ctx, kx + (i % 4 < 2 ? 0 : 1), ky + 8 + i, 1, 1, C.cityNear);

  // Far towers, then the roofs next door with their water tanks and aerials.
  let x = -6;
  while (x < W) {
    const w = 14 + Math.round(random() * 22);
    const h = 30 + Math.round(random() * 80);
    rect(ctx, x, height - 40 - h, w, h + 40, C.cityFar);
    for (let wy = height - 36 - h; wy < height - 44; wy += 6) {
      for (let wx = x + 3; wx < x + w - 3; wx += 5) {
        if (random() > 0.72) rect(ctx, wx, wy, 2, 2, C.cityLight);
      }
    }
    x += w + Math.round(random() * 10);
  }

  x = -4;
  while (x < W) {
    const w = 26 + Math.round(random() * 30);
    const h = 16 + Math.round(random() * 26);
    const top = height - h;
    rect(ctx, x, top, w, h, C.cityNear);
    if (random() > 0.45) {
      // a pitched tile roof
      for (let i = 0; i < 7; i++) rect(ctx, x - 2 + i * 2, top - 1 - i, w + 4 - i * 4, 1, C.cityNear);
    } else if (random() > 0.3) {
      // toren air: the orange tank on its stand
      const tx = x + 4 + Math.round(random() * (w - 16));
      rect(ctx, tx, top - 5, 1, 5, C.cityNear);
      rect(ctx, tx + 7, top - 5, 1, 5, C.cityNear);
      rect(ctx, tx - 1, top - 13, 10, 8, C.toren);
      rect(ctx, tx, top - 14, 8, 1, C.toren);
      rect(ctx, tx - 1, top - 10, 10, 1, C.cityNear);
    }
    if (random() > 0.5) {
      const ax = x + 3 + Math.round(random() * (w - 6));
      rect(ctx, ax, top - 18, 1, 18, C.cityNear);
      rect(ctx, ax - 3, top - 16, 7, 1, C.cityNear);
      rect(ctx, ax - 2, top - 13, 5, 1, C.cityNear);
    }
    for (let wy = top + 5; wy < height - 4; wy += 7) {
      for (let wx = x + 4; wx < x + w - 4; wx += 6) {
        if (random() > 0.6) rect(ctx, wx, wy, 3, 3, C.cityLight);
      }
    }
    x += w + 1;
  }

  // One sagging power line across the lot.
  for (let px = 0; px < W; px++) {
    const sag = Math.round(Math.sin((px / W) * Math.PI) * 9);
    rect(ctx, px, height - 58 + sag, 1, 1, C.cityNear);
  }

  return canvas;
}

// ---------- the office wall ----------

function paintWall(floor: FloorDef): HTMLCanvasElement {
  const H = floor.height;
  const { canvas, ctx } = layer(W, H + BASE);
  const random = seeded(17);
  const storeys = Math.ceil(H / STOREY);

  /** Canvas row of a height above the ground floor. */
  const row = (alt: number) => H - alt;
  /** A rectangle given by its left edge and the height of its top. */
  const box = (x: number, top: number, w: number, h: number, color: string) => rect(ctx, x, row(top), w, h, color);

  rect(ctx, 0, 0, W, H + BASE, C.wall);

  // Plaster: specks, and the odd damp streak nobody has budgeted to fix.
  for (let i = 0; i < 2600; i++) {
    const px = Math.floor(random() * W);
    const py = Math.floor(random() * H);
    rect(ctx, px, py, random() > 0.7 ? 2 : 1, 1, random() > 0.5 ? C.wallLight : C.wallDark);
  }
  for (let i = 0; i < 9; i++) {
    const px = 10 + Math.floor(random() * (W - 20));
    const py = Math.floor(random() * H);
    const len = 12 + Math.floor(random() * 30);
    for (let k = 0; k < len; k++) rect(ctx, px + (k % 7 === 6 ? 1 : 0), py + k, 1, 1, C.wallDark);
  }

  const windows: [number, number][] = [];

  for (let s = 0; s < storeys; s++) {
    const b = s * STOREY;
    const lurah = s === 3;
    const next = s > 3;

    // The floor above belongs to the kecamatan: another office, another colour.
    if (next) box(0, b + STOREY, W, STOREY, C.kecamatan);

    // dado: the darker lower band every office wall has
    box(0, b + 46, W, 46, lurah ? C.woodDeep : next ? C.kecamatanDark : C.dado);
    for (let px = 12; px < W; px += 24) box(px, b + 44, 1, 44, lurah ? C.woodDark : next ? C.kecamatan : C.dadoLine);
    box(0, b + 48, W, 1, C.trim);
    box(0, b + 47, W, 1, C.dadoDark);
    box(0, b + 3, W, 3, C.dadoDark);

    // the slab between storeys: clearly part of the building, not a ledge
    if (s > 0) {
      box(0, b + 4, W, 7, C.slab);
      box(0, b + 4, W, 1, C.slabLight);
    }

    // strip lights under the ceiling
    for (const lx of [64, 192, 320]) {
      box(lx - 16, b + STOREY - 5, 32, 2, C.metalDark);
      box(lx - 14, b + STOREY - 7, 28, 2, C.lamp);
    }
  }

  // ----- storey 0: the lobby -----
  windows.push([22, 68], [328, 68]);
  board(ctx, 192, row(126), 'KANTOR KELURAHAN', C.paper, C.ink, true);
  for (const [i, lx] of [112, 170, 228].entries()) {
    loket(ctx, lx, row(52), i + 1, i === 2);
  }
  // queue display
  box(284, 76, 30, 12, C.ink);
  text(ctx, 'A012', 291, row(76) + 4, C.red);
  poster(ctx, 64, row(112), ['STOP', 'PUNGLI'], C.red, C.white);
  // suggestion box, never opened
  box(302, 44, 16, 13, C.woodDark);
  box(302, 44, 16, 2, C.wood);
  box(306, 40, 8, 1, C.ink);
  text(ctx, 'SARAN', 301, row(52) - 3, C.paperDark);
  plant(ctx, 10, row(0));
  plant(ctx, 368, row(0));
  // waiting bench
  box(266, 12, 50, 3, C.steel);
  box(266, 20, 50, 3, C.steelDark);
  for (const bx of [270, 310]) box(bx, 9, 2, 9, C.steelDark);

  // ----- storey 1: the archive -----
  {
    const b = STOREY;
    windows.push([60, b + 66], [292, b + 66]);
    banner(ctx, 192, row(b + 128), 'ZONA INTEGRITAS');
    shelf(ctx, 124, row(b + 100), 110, 3, random);
    clock(ctx, 348, row(b + 116));
    fan(ctx, 22, row(b + 112));
    poster(ctx, 250, row(b + 96), ['BEBAS', 'KORUPSI'], C.greenDark, C.white);
  }

  // ----- storey 2: the staff room -----
  if (storeys > 2) {
    const b = STOREY * 2;
    windows.push([22, b + 66], [175, b + 66], [328, b + 66]);
    portrait(ctx, 84, row(b + 128));
    clock(ctx, 106, row(b + 124));
    portrait(ctx, 126, row(b + 128));
    corkboard(ctx, 238, row(b + 102), 62, 40, random);
    textCentred(ctx, 'PENGUMUMAN', 269, row(b + 110), C.paperDark);
    poster(ctx, 232, row(b + 132), ['JAM ISTIRAHAT', '10.00 - 14.00'], C.paper, C.ink);
    calendar(ctx, 62, row(b + 122));
  }

  // ----- storey 3: the lurah's floor -----
  if (storeys > 3) {
    const b = STOREY * 3;
    windows.push([60, b + 66], [150, b + 66]);
    board(ctx, 122, row(b + 132), 'RUANG LURAH', C.woodDark, C.goldLight, true);
    trophies(ctx, 226, row(b + 124));
    portrait(ctx, 286, row(b + 128));
    portrait(ctx, 306, row(b + 128));
  }

  // The world's edges are pillars, so the walls read as walls.
  rect(ctx, 0, 0, 5, H, C.pillar);
  rect(ctx, W - 5, 0, 5, H, C.pillar);
  rect(ctx, 5, 0, 1, H, C.wallDark);
  rect(ctx, W - 6, 0, 1, H, C.wallDark);

  // Push everything painted so far back, before cutting the windows.
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(27, 42, 47, 0.58)';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';

  for (const [wx, sill] of windows) nako(ctx, wx, row(sill + 44));

  // Light pools under the strip lights.
  for (let s = 0; s < storeys; s++) {
    for (const lx of [64, 192, 320]) {
      const ly = row(s * STOREY + STOREY - 7);
      rect(ctx, lx - 14, ly, 28, 2, C.lamp);
      const glow = ctx.createRadialGradient(lx, ly + 2, 2, lx, ly + 2, 52);
      glow.addColorStop(0, 'rgba(238, 245, 221, 0.16)');
      glow.addColorStop(1, 'rgba(238, 245, 221, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(lx - 52, ly, 104, 54);
    }
  }

  // The ground floor: tegel, with a bright edge where it meets the wall.
  rect(ctx, 0, H, W, BASE, C.tile);
  for (let tx = 0; tx < W; tx += 16) {
    for (let ty = 0; ty < BASE; ty += 8) {
      if (((tx / 16) | 0) % 2 === ((ty / 8) | 0) % 2) rect(ctx, tx, H + ty, 16, 8, C.tileDark);
    }
  }
  rect(ctx, 0, H, W, 1, C.paper);
  rect(ctx, 0, H + 1, W, 1, C.tileLine);

  return canvas;
}

// ---------- props ----------

/** A louvred window: the hole shows the sky layer behind the wall. */
function nako(ctx: Ctx, x: number, top: number): void {
  const w = 34;
  const h = 44;
  rect(ctx, x - 3, top - 3, w + 6, h + 6, C.woodDeep);
  rect(ctx, x - 2, top - 2, w + 4, h + 4, C.woodDark);
  ctx.clearRect(x, top, w, h);
  ctx.fillStyle = 'rgba(190, 228, 226, 0.2)';
  for (let y = top + 3; y < top + h; y += 6) ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = 'rgba(13, 20, 24, 0.35)';
  for (let y = top + 4; y < top + h; y += 6) ctx.fillRect(x, y, w, 1);
  rect(ctx, x + w / 2 - 1, top, 2, h, C.woodDark);
  rect(ctx, x - 5, top + h + 2, w + 10, 3, C.trim);
  rect(ctx, x - 5, top + h + 5, w + 10, 1, C.wallDark);
}

/** A signboard with centred text; `top` is its upper edge. */
function board(ctx: Ctx, cx: number, top: number, label: string, bg: string, fg: string, big = false): void {
  const w = textWidth(label, big) + 8;
  const h = textHeight(big) + 6;
  const x = Math.round(cx - w / 2);
  rect(ctx, x - 1, top - 1, w + 2, h + 2, C.ink);
  rect(ctx, x, top, w, h, bg);
  text(ctx, label, x + 4, top + 3, fg, big);
}

function poster(ctx: Ctx, x: number, top: number, lines: string[], bg: string, fg: string): void {
  const w = Math.max(...lines.map((line) => textWidth(line))) + 8;
  const h = lines.length * 7 + 5;
  rect(ctx, x - 1, top - 1, w + 2, h + 2, C.ink);
  rect(ctx, x, top, w, h, bg);
  for (const [i, line] of lines.entries()) textCentred(ctx, line, x + w / 2, top + 3 + i * 7, fg);
}

function banner(ctx: Ctx, cx: number, top: number, label: string): void {
  const w = textWidth(label, true) + 14;
  const x = Math.round(cx - w / 2);
  rect(ctx, x + 2, top - 6, 1, 6, C.paperDark);
  rect(ctx, x + w - 3, top - 6, 1, 6, C.paperDark);
  rect(ctx, x, top, w, 15, C.paper);
  rect(ctx, x, top, w, 2, C.red);
  rect(ctx, x, top + 13, w, 2, C.red);
  text(ctx, label, x + 7, top + 4, C.redDark, true);
}

/** A service window, numbered; the last one is always closed. */
function loket(ctx: Ctx, x: number, top: number, n: number, closed: boolean): void {
  const w = 46;
  rect(ctx, x - 1, top - 1, w + 2, 48, C.ink);
  rect(ctx, x, top, w, 46, C.woodDark);
  rect(ctx, x + 3, top + 3, w - 6, 28, closed ? C.slab : C.wallDark);
  if (!closed) {
    rect(ctx, x + 5, top + 5, 8, 2, C.glass);
    rect(ctx, x + 5, top + 8, 4, 1, C.glass);
    // the gap documents go through
    rect(ctx, x + 16, top + 25, 14, 6, C.ink);
  } else {
    rect(ctx, x + 10, top + 12, 26, 9, C.red);
    text(ctx, 'TUTUP', x + 13, top + 14, C.white);
  }
  rect(ctx, x - 2, top + 31, w + 4, 3, C.wood);
  rect(ctx, x + 8, top - 11, 30, 9, C.paper);
  text(ctx, 'LOKET ' + n, x + 10, top - 9, C.ink);
}

function plant(ctx: Ctx, x: number, ground: number): void {
  rect(ctx, x - 4, ground - 8, 9, 8, C.pot);
  rect(ctx, x - 5, ground - 9, 11, 2, C.pot);
  for (const [dx, h] of [
    [-3, 16],
    [-1, 22],
    [1, 19],
    [3, 13],
  ] as const) {
    rect(ctx, x + dx, ground - 9 - h, 1, h, C.leaf);
    rect(ctx, x + dx + 1, ground - 7 - h, 1, h - 4, C.greenDark);
  }
}

/** Rows of ring binders. */
function shelf(ctx: Ctx, x: number, top: number, w: number, rows: number, random: () => number): void {
  const tones = [C.metalDark, C.steelDark, C.woodDark, C.redDark, C.greenDark, C.paperDark];
  for (let r = 0; r < rows; r++) {
    const y = top + r * 15;
    let bx = x + 1;
    while (bx < x + w - 4) {
      const bw = 3 + Math.floor(random() * 2);
      const bh = 9 + Math.floor(random() * 3);
      rect(ctx, bx, y + 12 - bh, bw, bh, tones[Math.floor(random() * tones.length)] as string);
      rect(ctx, bx + 1, y + 15 - bh, 1, 3, C.paper);
      bx += bw + (random() > 0.85 ? 3 : 1);
    }
    rect(ctx, x, y + 12, w, 2, C.woodDark);
  }
}

function clock(ctx: Ctx, cx: number, top: number): void {
  rect(ctx, cx - 4, top, 9, 11, C.ink);
  rect(ctx, cx - 5, top + 1, 11, 9, C.ink);
  rect(ctx, cx - 3, top + 1, 7, 9, C.paper);
  rect(ctx, cx - 4, top + 2, 9, 7, C.paper);
  rect(ctx, cx, top + 3, 1, 3, C.ink);
  rect(ctx, cx, top + 5, 3, 1, C.red);
}

function fan(ctx: Ctx, cx: number, top: number): void {
  rect(ctx, cx - 1, top + 12, 3, 8, C.metalDark);
  rect(ctx, cx - 6, top, 13, 13, C.metalDark);
  rect(ctx, cx - 5, top + 1, 11, 11, C.wallDark);
  rect(ctx, cx - 4, top + 5, 9, 2, C.metal);
  rect(ctx, cx - 1, top + 2, 2, 9, C.metal);
  rect(ctx, cx - 1, top + 5, 2, 2, C.ink);
}

/** A framed official portrait. Nobody in particular: a silhouette. */
function portrait(ctx: Ctx, x: number, top: number): void {
  rect(ctx, x - 1, top - 1, 16, 20, C.ink);
  rect(ctx, x, top, 14, 18, C.goldDark);
  rect(ctx, x + 2, top + 2, 10, 14, C.navy);
  rect(ctx, x + 5, top + 4, 4, 5, C.metalDark);
  rect(ctx, x + 5, top + 3, 4, 2, C.ink);
  rect(ctx, x + 3, top + 10, 8, 6, C.metalDark);
}

function calendar(ctx: Ctx, x: number, top: number): void {
  rect(ctx, x - 1, top - 1, 15, 19, C.ink);
  rect(ctx, x, top, 13, 17, C.paper);
  rect(ctx, x, top, 13, 5, C.red);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) rect(ctx, x + 2 + c * 2, top + 7 + r * 2, 1, 1, c === 4 ? C.red : C.ink);
  }
}

function corkboard(ctx: Ctx, x: number, top: number, w: number, h: number, random: () => number): void {
  rect(ctx, x - 2, top - 2, w + 4, h + 4, C.woodDark);
  rect(ctx, x, top, w, h, C.cork);
  const tones = [C.paper, C.goldLight, C.paperDark, C.white];
  for (let i = 0; i < 9; i++) {
    const nx = x + 2 + Math.floor(random() * (w - 14));
    const ny = top + 2 + Math.floor(random() * (h - 14));
    const nw = 7 + Math.floor(random() * 5);
    const nh = 8 + Math.floor(random() * 4);
    rect(ctx, nx, ny, nw, nh, tones[i % tones.length] as string);
    rect(ctx, nx + 1, ny + 3, nw - 2, 1, C.paperDark);
    rect(ctx, nx + 1, ny + 5, nw - 3, 1, C.paperDark);
    rect(ctx, nx + Math.floor(nw / 2), ny, 1, 1, C.red);
  }
}

/** The cabinet of cups every head of office keeps. */
function trophies(ctx: Ctx, x: number, top: number): void {
  rect(ctx, x - 1, top - 1, 40, 40, C.ink);
  rect(ctx, x, top, 38, 38, C.woodDark);
  rect(ctx, x + 2, top + 2, 34, 16, C.navy);
  rect(ctx, x + 2, top + 20, 34, 16, C.navy);
  for (const [tx, ty] of [
    [6, 8],
    [17, 5],
    [28, 9],
    [10, 25],
    [24, 24],
  ] as const) {
    rect(ctx, x + tx, top + ty, 5, 4, C.gold);
    rect(ctx, x + tx + 2, top + ty + 4, 1, 3, C.gold);
    rect(ctx, x + tx + 1, top + ty + 7, 3, 1, C.goldDark);
  }
}
