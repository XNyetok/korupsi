import type { LiftPhase } from '../core/game.ts';
import { WORLD_WIDTH as W } from '../core/params.ts';
import { VERIFICATION } from '../core/tower.ts';
import type { FloorDef, LedgeDef } from '../core/types.ts';
import { CELLAR, type Backdrop } from './backdrop.ts';
import { type Ctx, layer, rect, seeded, text, textCentred } from './pixel.ts';
import type { Scene } from './renderer.ts';

// Warm concrete in daylight, desaturated glass behind the player, cool steel
// in the shaft. The lift and balcony share a bright edge nothing else uses.
const C = {
  ink: '#142a36',
  deep: '#233b48',
  steelDark: '#3d5969',
  steel: '#66828f',
  steelLight: '#9bb4bb',
  stoneDark: '#aaa48f',
  stone: '#ccc5ae',
  plaster: '#dad5bd',
  ivory: '#e9e4ce',
  glass: '#9ebfc6',
  glassDark: '#7c9faa',
  reflection: '#c5d9db',
  sign: '#24536c',
  rim: '#edfbef',
  mint: '#9af1d4',
  leaf: '#52746f',
  leafLight: '#7b9782',
  terracotta: '#a37160',
} as const;

type Box = (x: number, top: number, w: number, h: number, fill: string) => void;
const LIFT_LABEL: Record<LiftPhase, string> = { ready: 'SIAP', rising: 'NAIK', arrived: 'TIBA', returning: 'TURUN' };

/** Roofs and leaves beyond the glass. No detail here should look like a ledge. */
function windows(ctx: Ctx, x: number, y: number, w: number, h: number, bays: number): void {
  rect(ctx, x - 4, y - 4, w + 8, h + 8, C.stoneDark);
  rect(ctx, x - 2, y - 2, w + 4, h + 4, C.steel);
  rect(ctx, x, y, w, h, C.glass);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (h > 100) {
    rect(ctx, x, y + 30, w, h - 30, '#aac8ce');
    for (const [dx, dy, span] of [
      [14, 126, 76],
      [138, 98, 53],
      [229, 137, 87],
      [323, 80, 32],
    ]) {
      rect(ctx, x + dx, y + dy, span, 3, '#bfd3d2');
      rect(ctx, x + dx + 12, y + dy - 4, span - 20, 4, '#c4d7d6');
      rect(ctx, x + dx + 19, y + dy - 7, Math.floor(span / 3), 3, '#c9dcda');
    }
  }
  const base = y + h;
  rect(ctx, x, base - 49, w, 49, '#b5ccca');

  // Haze, treetops and tile roofs at different depths behind the mullions.
  const random = seeded(x + w);
  for (let dx = -4; dx < w; dx += 12 + Math.floor(random() * 9)) {
    const height = 12 + Math.floor(random() * 19);
    rect(ctx, x + dx, base - height, 23, height, '#a3b9ad');
    rect(ctx, x + dx + 4, base - height - 3, 14, 3, '#a3b9ad');
  }
  for (let dx = 4; dx < w; ) {
    const tx = x + dx;
    const half = 11 + Math.floor(random() * 9);
    const roof = base - 10 - Math.floor(random() * 10);
    const front = random() > 0.4 ? '#b0ae9d' : '#c0b8a6';
    rect(ctx, tx + 2, roof, 2 * half - 4, base - roof, front);
    rect(ctx, tx + 5, roof + 4, 4, 6, '#879890');
    rect(ctx, tx + half + 2, roof + 3, 5, 7, '#879890');
    for (let i = 0; i < Math.floor(half / 2); i++) {
      const row = roof - i;
      rect(ctx, tx + i * 2, row, half - 2 * i, 1, i % 3 === 0 ? '#ad9387' : '#b59a8a');
      rect(ctx, tx + half, row, half - 2 * i, 1, '#9d8b83');
    }
    rect(ctx, tx + 1, roof + 1, 2 * half - 2, 1, '#998d81');
    dx += half * 2 + 5 + Math.floor(random() * 14);
  }
  for (let dx = 30; dx < w; dx += 70 + Math.floor(random() * 20)) {
    const px = x + dx;
    rect(ctx, px, base - 29, 2, 28, '#829b90');
    for (let i = 0; i < 4; i++) {
      rect(ctx, px - 2 - i * 3, base - 31 + Math.max(0, i - 1), 6, 2, '#8aa59b');
      rect(ctx, px + 1 + i * 3, base - 34 + Math.abs(i - 1), 6, 2, '#8aa59b');
    }
    rect(ctx, px - 4, base - 30, 5, 4, '#8aa59b');
  }
  // Broad reflections, with a secondary sheen offset inside each pane.
  const stride = w / bays;
  for (let i = 0; i < bays; i++) {
    const left = x + Math.round(i * stride);
    const paneEnd = x + Math.round((i + 1) * stride);
    for (let k = 5; k < paneEnd - left - 7; k += 2) {
      const top = y + 8 + (paneEnd - left - k) * 2;
      rect(ctx, left + k, top, 2, 12, '#c5d9db88');
      rect(ctx, left + k, top + 17, 2, 3, '#c5d9db66');
    }
    rect(ctx, left, y, 2, h, C.steel);
    rect(ctx, left + 2, y, 1, h, C.reflection);
  }
  for (let dy = 48; dy < h - 6; dy += 58) {
    rect(ctx, x, y + dy, w, 2, C.glassDark);
    rect(ctx, x, y + dy + 2, w, 1, C.reflection);
  }
  ctx.restore();
  rect(ctx, x - 5, y + h, w + 10, 2, C.stoneDark);
}

function plant(box: Box, x: number, floor: number): void {
  // A potted snake plant, enough contrast to read without competing with the rider.
  box(x - 8, floor + 2, 18, 2, C.stoneDark);
  box(x - 5, floor + 9, 12, 9, C.terracotta);
  box(x - 7, floor + 11, 16, 3, '#b9886c');
  box(x + 4, floor + 8, 2, 7, '#835e58');
  for (const [dx, top, shift] of [
    [-7, 21, 1],
    [-3, 29, 1],
    [1, 32, 0],
    [5, 25, -1],
    [9, 20, -1],
  ]) {
    box(x + dx, floor + top, 2, top - 14, C.leaf);
    box(x + dx + shift, floor + top - 7, 3, top - 17, C.leafLight);
    box(x + dx + shift * 2, floor + top - 13, 2, Math.max(2, top - 22), C.leaf);
  }
}

function reception(ctx: Ctx, box: Box, row: (height: number) => number): void {
  // A continuous counter with glass dividers, pass-through slots and monitors.
  box(6, 76, 128, 76, C.stoneDark);
  box(8, 74, 124, 47, C.steelDark);
  for (const [i, x] of [11, 51, 91].entries()) {
    box(x, 70, 37, 41, C.glassDark);
    box(x + 1, 68, 35, 23, '#a6c3c7');
    box(x + 2, 67, 27, 1, '#bcd1d0');
    if (i < 2) {
      box(x + 2, 60, 14, 11, C.steelDark);
      box(x + 3, 59, 12, 8, '#687e82');
      box(x + 5, 57, 7, 1, '#b6c7be');
      if (i === 1) box(x + 5, 54, 9, 1, '#b6c7be');
      box(x + 8, 49, 2, 5, C.steelDark);
      box(x + 6, 45, 7, 1, C.steelDark);
    } else {
      // Clipboards on the form counter instead of a third identical screen.
      for (const dx of [3, 12]) {
        box(x + dx, 59, 8, 13, '#8d9181');
        box(x + dx + 1, 57, 6, 8, '#d6cfb5');
        box(x + dx + 2, 55, 4, 1, '#a39b84');
      }
    }
    box(x + 24, 48, 10, 9, '#ab9f84');
    box(x + 25, 47, 8, 2, '#d6cfb5');
    box(x + 23, 43, 11, 5, C.steelDark);
    box(x + 22, 43, 11, 1, C.steelLight);
    box(x + 18, 62, 1, 26, '#c3d6d688');
    box(x, 33, 37, 2, C.steel);
    box(x + 4, 24, 29, 17, '#c2b89e');
    box(x + 5, 22, 1, 13, '#d5cbb0');
    box(x + 29, 21, 2, 13, C.stoneDark);
    box(x + 8, 78, 21, 10, C.sign);
    textCentred(ctx, `0${i + 1}`, x + 18, row(76), i === 1 ? C.mint : C.ivory);
  }
  box(5, 30, 130, 3, '#bbb69e');
  box(8, 28, 124, 3, C.stoneDark);
  box(12, 4, 116, 4, '#847e70');

  // Mounted queue display with a bezel, a divider and a lit status LED.
  box(31, 141, 3, 19, C.stoneDark);
  box(104, 141, 3, 19, C.stoneDark);
  box(12, 125, 122, 36, C.steelDark);
  box(13, 125, 120, 2, C.steel);
  box(16, 121, 114, 27, C.ink);
  text(ctx, 'NOMOR BERIKUTNYA', 22, row(117), C.steelLight);
  box(22, 108, 102, 1, C.steelDark);
  text(ctx, 'A-023', 22, row(104), C.mint, true);
  text(ctx, 'LOKET 02', 65, row(103), C.ivory);
  box(125, 92, 2, 1, C.mint);

  // A take-a-number kiosk on a pedestal next to the lift entrance.
  box(120, 21, 17, 4, C.stoneDark);
  box(125, 26, 9, 26, C.steelDark);
  box(123, 43, 16, 27, C.deep);
  box(124, 42, 14, 22, C.steel);
  box(126, 39, 10, 7, C.ink);
  box(128, 37, 6, 2, C.mint);
  box(127, 30, 8, 2, C.deep);
  box(130, 29, 4, 3, C.ivory);
  box(122, 3, 16, 2, C.steelDark);

  const posts = [11, 48, 86, 112];
  for (const [i, x] of posts.entries()) {
    const next = posts[i + 1];
    if (next != null) {
      box(x + 2, 10, next - x - 2, 2, '#628292');
      box(x + 6, 8, next - x - 10, 1, '#7698a2');
    }
    box(x, 13, 2, 12, C.steelDark);
    box(x - 1, 14, 4, 2, C.steelLight);
    box(x - 2, 2, 6, 2, C.steelDark);
  }
}

function waitingArea(ctx: Ctx, box: Box, row: (height: number) => number): void {
  box(281, 44, 73, 14, C.sign);
  textCentred(ctx, 'RUANG TUNGGU', 317, row(39), C.ivory);
  box(276, 3, 79, 3, C.stoneDark);
  box(279, 9, 73, 3, C.steelDark);
  for (const x of [280, 305, 330]) {
    box(x + 2, 22, 19, 12, '#4f7d8a');
    box(x + 4, 24, 15, 2, '#86a8ad');
    box(x + 17, 21, 3, 10, '#3e6575');
    box(x, 13, 23, 4, C.deep);
    box(x + 1, 14, 21, 2, '#73939e');
    for (const leg of [x + 3, x + 18]) box(leg, 9, 2, 8, C.steelDark);
  }
  plant(box, 369, 0);
}

function shaft(def: LedgeDef, ctx: Ctx, box: Box, row: (height: number) => number): void {
  const { x, w, y } = def;
  const top = def.liftTo ?? y;
  const span = top - y;
  const mid = x + w / 2;
  box(x - 9, top + 83, w + 18, span + 83, C.stoneDark);
  box(x - 7, top + 78, w + 14, span + 78, C.deep);
  box(x, top + 56, w, span + 56, '#34515c');
  // Recessed wall, guide rails and the cab's central cable channel.
  box(x + 5, top + 56, w - 10, span + 56, '#45616a');
  box(mid - 11, top + 54, 22, span + 54, '#304951');
  for (const dx of [-5, -1, 4]) box(mid + dx, top + 50, 1, span + 50, C.steel);
  for (const tx of [x + 1, x + w - 6]) {
    box(tx, top + 60, 5, span + 60, C.steelDark);
    box(tx, top + 60, 2, span + 60, C.steelLight);
    for (let h = y + 9; h < top + 57; h += 14) {
      box(tx - 1, h, 7, 2, C.steel);
      box(tx + 2, h, 1, 1, C.deep);
    }
  }
  box(mid - 16, top + 59, 32, 10, C.deep);
  box(mid - 11, top + 58, 22, 7, C.steel);
  for (let dx = -9; dx < 10; dx += 4) box(mid + dx, top + 57, 1, 6, C.steelDark);
  box(x - 9, top + 80, w + 18, 22, C.ink);
  box(x - 6, top + 78, w + 12, 18, C.sign);
  textCentred(ctx, y === 0 ? 'LIFT BERKAS' : 'LIFT ARSIP', mid, row(top + 73), C.ivory, true);

  [y + 13, top + 13].forEach((h, i) => {
    const tx = x + w + 4;
    box(tx, h + 12, 14, 14, C.deep);
    box(tx + 1, h + 11, 12, 8, C.ink);
    text(ctx, String(i + (y === 0 ? 1 : 2)).padStart(2, '0'), tx + 3, row(h + 9), C.mint);
    box(tx + 6, h + 1, 2, 2, C.steelLight);
  });
  box(x - 7, y + 2, w + 14, 2, C.steelLight);
}

function offices(ctx: Ctx, box: Box, row: (height: number) => number): void {
  // Back-office shelving and paper stacks are inset into the walls. They
  // stay darker than the routes marked by the pale mint rims.
  box(128, 475, 242, 263, C.stone);
  box(128, 418, 242, 1, C.stoneDark);
  for (const [x, h, w, label] of [
    [116, 281, 100, 'ARSIP'],
    [241, 427, 130, 'PENGESAHAN'],
  ] as const) {
    box(x, h, w, 63, C.stoneDark);
    box(x + 2, h - 2, w - 4, 58, '#b7b49e');
    for (let level = h - 25; level > h - 57; level -= 27) {
      box(x + 4, level, w - 8, 2, C.stoneDark);
      const folders = [C.steel, '#999986', '#909d95', '#a79782'];
      for (let dx = 8; dx < w - 14; dx += 12) {
        const color = folders[(Math.floor(dx / 12) + level) % folders.length];
        box(x + dx, level + 15 + (dx % 5), 8, 15 + (dx % 5), color);
        box(x + dx + 1, level + 2, 1, 1, C.stoneDark);
        box(x + dx + 2, level + 12, 4, 2, C.plaster);
      }
    }
    box(x + 6, h + 15, w - 12, 14, C.sign);
    textCentred(ctx, label, x + w / 2, row(h + 11), C.ivory, true);
  }
  box(215, 227, 150, 18, C.sign);
  text(ctx, '<', 230, row(221), C.ivory);
  textCentred(ctx, 'LIFT ARSIP', 290, row(221), C.ivory, true);
  box(318, 181, 55, 11, C.steelDark);
  textCentred(ctx, 'LOMPAT ^', 345, row(178), C.ivory);
  box(164, 352, 100, 14, C.sign);
  textCentred(ctx, 'LOMPATI BERKAS', 214, row(347), C.ivory, true);
}

/** An office atrium: light from a clerestory, warm tile, and deep equipment bays. */
function backdrop(floor: FloorDef, maxView: number): Backdrop {
  const H = floor.height;
  const { canvas: sky, ctx: s } = layer(W, maxView);
  rect(s, 0, 0, W, maxView, C.deep);
  const { canvas, ctx } = layer(W, H + CELLAR);
  const row = (height: number) => H - height;
  const box: Box = (x, top, w, h, fill) => rect(ctx, x, row(top), w, h, fill);

  box(0, H, W, H + CELLAR, C.plaster);
  box(0, 452, W, 452, C.stone);
  box(0, 241, W, 60, '#d2cbb4');
  for (const h of [51, 92, 138, 182, 228, 282, 332, 382, 433]) {
    box(0, h, W, 1, '#b8b19e');
    for (let x = Math.floor(h / 42) % 2 ? 22 : 66; x < W; x += 92) box(x, h + 38, 1, 38, '#bab49f');
  }
  windows(ctx, 15, row(462), 354, 246, 7);
  windows(ctx, 277, row(95), 89, 54, 2);
  box(0, 465, W, 13, C.stoneDark);
  box(0, 467, W, 8, C.ivory);
  box(0, 221, W, 13, C.stoneDark);
  box(0, 222, W, 4, C.ivory);
  for (const x of [33, 278]) {
    box(x - 5, 216, 78, 5, C.steel);
    box(x, 215, 66, 2, '#f7edcf');
  }
  for (const x of [0, 372]) {
    box(x, 491, 12, 491, C.stoneDark);
    box(x + 2, 491, 3, 491, C.ivory);
  }
  box(20, 179, 114, 22, C.sign);
  box(21, 179, 112, 2, C.steel);
  textCentred(ctx, 'PUSAT LAYANAN', 77, row(174), C.ivory, true);
  textCentred(ctx, 'PENDAFTARAN', 77, row(163), C.steelLight);

  // The glass balustrade sits behind the actual balcony surface.
  const { x: balcony, y: h, w: width } = floor.ledges[VERIFICATION.ledge];
  box(balcony, h + 22, width, 22, '#89aab0');
  box(balcony, h + 22, width, 2, C.steel);
  box(balcony, h + 19, width, 1, C.reflection);
  for (const dx of [1, 35, width - 33, width - 3]) box(balcony + dx, h + 22, 2, 22, C.steelDark);
  box(balcony + 8, h + 43, 19, 14, C.sign);
  textCentred(ctx, '02', balcony + 17, row(h + 40), C.ivory, true);

  // Floor plane with grout, warm window bounce, and a blue queue stripe.
  box(0, 0, W, CELLAR, '#555f61');
  box(0, 0, W, 31, '#b4b19f');
  for (let y = 0; y < 31; y += 8) {
    box(0, -y, W, 1, '#827f72');
    for (let x = -24 + y; x < W; x += 31 + Math.floor(y * 0.4)) {
      box(x + 1, -y - 1, 21, 1, '#d1c9ad');
      for (let k = 0; k < Math.min(8, 31 - y); k++) box(x - Math.floor(k * 0.65), -y - k, 1, 1, '#8a887b');
    }
  }
  box(0, -31, W, 2, '#767c76');
  box(0, -33, W, 6, '#686e69');
  for (let x = 10; x < W; x += 4) box(x, -38, 1, 1, '#758080');
  box(20, -14, 124, 3, '#698d98');
  for (const x of [41, 83, 125]) text(ctx, '>', x, row(-13), C.ivory);

  reception(ctx, box, row);
  waitingArea(ctx, box, row);
  if (floor.id === 'kecamatan') {
    offices(ctx, box, row);
    // The prototype's door was the end of the slice. In the full floor,
    // this sign marks the balcony and points to the next step of the route.
    box(320, h + 19, 62, 13, C.sign);
    textCentred(ctx, VERIFICATION.label, 351, row(h + 16), C.ivory, true);
  }
  for (const def of floor.ledges) if (def.kind === 'lift') shaft(def, ctx, box, row);
  return { sky, wall: canvas };
}

function cabin(ctx: Ctx, x: number, sy: number, w: number, phase: LiftPhase, fromRight: boolean): void {
  // The stainless back is part of the sprite, so its depth moves with the deck.
  rect(ctx, x + 4, sy - 34, w - 8, 34, C.deep);
  rect(ctx, x + 7, sy - 32, w - 14, 31, '#78949c');
  rect(ctx, x + 8, sy - 31, w - 17, 3, '#a4b6b8');
  for (let dy = 25; dy >= 9; dy -= 4) rect(ctx, x + 8, sy - dy, w - 16, 1, '#829da3');
  rect(ctx, x + 7, sy - 4, w - 14, 3, '#4e6873');
  rect(ctx, x + 10, sy - 28, 1, 26, '#a1b7bc');
  rect(ctx, x + w - 11, sy - 27, 2, 26, C.steelDark);
  // A low mail tray and a pile of copy paper, firmly inside the cabin.
  rect(ctx, x + 12, sy - 13, 22, 11, C.steelDark);
  rect(ctx, x + 15, sy - 11, 16, 6, '#b3aa92');
  rect(ctx, x + 17, sy - 12, 12, 2, '#c6c1a9');
  rect(ctx, x + 16, sy - 8, 13, 1, '#a9a28e');
  rect(ctx, x + 11, sy - 4, 24, 3, C.deep);
  rect(ctx, x + w - 19, sy - 25, 6, 13, C.deep);
  rect(ctx, x + w - 17, sy - 22, 2, 2, C.mint);
  rect(ctx, x + w - 17, sy - 17, 2, 2, C.steelLight);

  rect(ctx, x + 13, sy - 51, w - 26, 17, C.steelDark);
  rect(ctx, x + 15, sy - 49, w - 30, 13, C.ink);
  rect(ctx, x + 17, sy - 47, 2, 1, C.mint);
  if (phase === 'arrived') {
    text(ctx, 'LOMPAT', x + w / 2 - 22, sy - 46, C.mint, true);
    text(ctx, '>', x + w / 2 + 17, sy - 45, C.mint);
  } else {
    textCentred(ctx, LIFT_LABEL[phase], x + w / 2, sy - 46, C.mint, true);
  }
  if (phase === 'ready') {
    rect(ctx, x + w / 2 - 30, sy - 28, 60, 11, C.sign);
    textCentred(ctx, fromRight ? '< INJAK LIFT' : 'INJAK LIFT >', x + w / 2, sy - 25, C.ivory);
  }
  if (phase === 'rising') {
    rect(ctx, x + w / 2 - 5, sy - 27, 11, 9, C.sign);
    textCentred(ctx, '^', x + w / 2, sy - 25, C.mint);
  }

  for (const dx of [4, w - 16]) {
    rect(ctx, x + dx, sy + 6, 12, 9, C.deep);
    rect(ctx, x + dx + 2, sy + 8, 8, 5, C.steelDark);
    rect(ctx, x + dx + 4, sy + 13, 4, 1, C.steel);
  }
}

export const ATRIUM_SCENE: Scene = {
  backdrop,
  ledge(ctx, def, { x, sy }, game, index) {
    if (index === 0) return;
    const { w } = def;
    const phase = game.liftPhase(index);
    if (phase) cabin(ctx, x, sy, w, phase, def.y > 0);
    rect(ctx, x, sy, w, 9, C.ink);
    rect(ctx, x, sy, w, 2, C.rim);
    rect(ctx, x + 1, sy + 2, w - 2, 1, C.mint);
    rect(ctx, x + 2, sy + 4, w - 4, 3, C.steelDark);
    for (let dx = 5; dx < w - 2; dx += 16) rect(ctx, x + dx, sy + 5, 1, 1, C.steelLight);
  },
  exit(ctx, x, sy, label) {
    rect(ctx, x - 22, sy - 43, 44, 43, C.stoneDark);
    rect(ctx, x - 20, sy - 43, 40, 43, C.ivory);
    rect(ctx, x - 18, sy - 39, 36, 39, C.ink);
    for (const dx of [-15, 2]) {
      rect(ctx, x + dx, sy - 36, 13, 34, C.glassDark);
      rect(ctx, x + dx, sy - 36, 13, 2, C.reflection);
      rect(ctx, x + dx + 1, sy - 10, 11, 6, '#638895');
      for (let i = 0; i < 5; i++) rect(ctx, x + dx + i * 2, sy - 24 - i * 2, 2, 5, '#bed7d866');
    }
    for (const dx of [-7, 4]) {
      rect(ctx, x + dx, sy - 22, 3, 10, C.steelDark);
      rect(ctx, x + dx, sy - 23, 2, 9, C.ivory);
    }
    rect(ctx, x - 17, sy - 2, 34, 2, C.steelLight);
    rect(ctx, x - 33, sy - 55, 66, 14, C.ink);
    rect(ctx, x - 32, sy - 54, 64, 11, C.sign);
    textCentred(ctx, label, x, sy - 52, C.ivory, true);
  },
};
