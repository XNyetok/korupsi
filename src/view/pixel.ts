/**
 * Pixel helpers: whole-pixel rectangles, two small fonts for signs, sprites written
 * as rows of characters, and a small seeded generator for scenery. Everything
 * the canvas shows is drawn through these, so nothing lands between pixels.
 */

export type Ctx = CanvasRenderingContext2D;

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** mulberry32. Scenery only: the simulation has no randomness in it. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A blank canvas the size asked for, with its context. */
export function layer(w: number, h: number): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

// ---------- 3x5 font ----------

/** Each glyph is five rows of three pixels, top to bottom. */
const GLYPHS: Record<string, string> = {
  A: '010101111101101',
  B: '110101110101110',
  C: '011100100100011',
  D: '110101101101110',
  E: '111100110100111',
  F: '111100110100100',
  G: '011100101101011',
  H: '101101111101101',
  I: '111010010010111',
  J: '001001001101010',
  K: '101101110101101',
  L: '100100100100111',
  M: '101111111101101',
  N: '110101101101101',
  O: '010101101101010',
  P: '110101110100100',
  Q: '010101101110011',
  R: '110101110101101',
  S: '011100010001110',
  T: '111010010010010',
  U: '101101101101111',
  V: '101101101101010',
  W: '101101111111101',
  X: '101101010101101',
  Y: '101101010010010',
  Z: '111001010100111',
  '0': '111101101101111',
  '1': '010110010010111',
  '2': '110001010100111',
  '3': '110001010001110',
  '4': '101101111001001',
  '5': '111100110001110',
  '6': '011100111101111',
  '7': '111001010010010',
  '8': '111101111101111',
  '9': '111101111001110',
  '.': '000000000000010',
  '!': '010010010000010',
  '-': '000000111000000',
  ':': '000010000010000',
  '+': '000010111010000',
  '^': '010111010010010',
  '/': '001001010100100',
};

/** Each glyph is seven rows of five pixels: for the signs that have to be read. */
const BIG: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '/': ['00001', '00001', '00010', '00100', '01000', '10000', '10000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
};

/** Rows a line of text takes. */
export const textHeight = (big = false) => (big ? 7 : 5);

/** Width in pixels of `value`, in the small font or the big one. */
export function textWidth(value: string, big = false): number {
  return Math.max(0, value.length * (big ? 6 : 4) - 1);
}

/** Draws upper-case `value` with its top-left corner at x, y. */
export function text(ctx: Ctx, value: string, x: number, y: number, color: string, big = false): void {
  ctx.fillStyle = color;
  let cx = Math.round(x);
  const top = Math.round(y);
  for (const ch of value.toUpperCase()) {
    if (big) {
      (BIG[ch] ?? []).forEach((row, r) => {
        for (let c = 0; c < row.length; c++) if (row[c] === '1') ctx.fillRect(cx + c, top + r, 1, 1);
      });
      cx += 6;
      continue;
    }
    const glyph = GLYPHS[ch];
    if (glyph) {
      for (let i = 0; i < 15; i++) {
        if (glyph[i] === '1') ctx.fillRect(cx + (i % 3), top + Math.floor(i / 3), 1, 1);
      }
    }
    cx += 4;
  }
}

export function textCentred(ctx: Ctx, value: string, cx: number, y: number, color: string, big = false): void {
  text(ctx, value, Math.round(cx - textWidth(value, big) / 2), y, color, big);
}

// ---------- sprites from rows of characters ----------

/**
 * Draws a sprite written as rows of characters, each character a key into
 * `colors`; anything not in the map is left clear. `flip` mirrors it.
 */
export function stamp(
  ctx: Ctx,
  rows: readonly string[],
  colors: Record<string, string>,
  x: number,
  y: number,
  flip = false,
): void {
  const left = Math.round(x);
  const top = Math.round(y);
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? '';
    for (let c = 0; c < row.length; c++) {
      const color = colors[row[c] ?? ''];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(left + (flip ? row.length - 1 - c : c), top + r, 1, 1);
    }
  }
}

// ---------- the title ----------

/** Paints the word KORUPSI into `canvas` (43 x 9), with a one-pixel shadow. */
export function paintLogo(canvas: HTMLCanvasElement, color: string, shadow: string): void {
  const word = 'KORUPSI';
  canvas.width = word.length * 6 + 1;
  canvas.height = 9;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  for (const [dx, dy, fill] of [
    [1, 1, shadow],
    [0, 0, color],
  ] as const) {
    ctx.fillStyle = fill;
    [...word].forEach((ch, i) => {
      (BIG[ch] ?? []).forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
          if (row[c] === '1') ctx.fillRect(i * 6 + c + dx, r + dy, 1, 1);
        }
      });
    });
  }
}
