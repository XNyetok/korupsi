import { Atrium, LIFT, type LiftPhase } from '../core/atrium.ts';
import { WORLD_WIDTH as W } from '../core/params.ts';
import type { FloorDef } from '../core/types.ts';
import { CELLAR, type Backdrop } from './backdrop.ts';
import { type Ctx, layer, rect, text, textCentred } from './pixel.ts';
import type { Scene } from './renderer.ts';

const ink = '#122532';
const navy = '#183646';
const blue = '#1e5276';
const trim = '#5b7f8c';
const pane = '#9fbac4';
const wall = '#c3d5d5';
const light = '#e4f2ed';
const active = '#91f4de';

export const LIFT_LABEL: Record<LiftPhase, string> = {
  ready: 'SIAP',
  rising: 'NAIK',
  arrived: 'TIBA',
  returning: 'TURUN',
};

/** Big panes, tiled floor and one tall opening rather than rows of offices. */
function backdrop(floor: FloorDef, maxView: number): Backdrop {
  const H = floor.height;
  const { canvas: sky, ctx: s } = layer(W, maxView);
  rect(s, 0, 0, W, maxView, navy);
  const { canvas, ctx } = layer(W, H + CELLAR);
  const y = (height: number) => H - height;
  const box = (x: number, top: number, w: number, h: number, fill: string) => rect(ctx, x, y(top), w, h, fill);

  box(0, H, W, H, wall);
  box(13, 418, 358, 370, '#7595a4');
  for (let x = 17; x < 364; x += 43) {
    box(x, 414, 39, 361, pane);
    box(x + 1, 413, 37, 112, '#b5d1d6');
    box(x + 4, 292, 2, 220, '#c6dfe1');
    for (const h of [155, 260, 366]) box(x, h, 39, 2, '#7e9eac');
  }
  // Reflections belong behind the route; the actual floors have bright rims.
  for (let x = 26; x < 358; x += 2) box(x, 336 + ((x * 2) % 127), 2, 14, '#becfd2');
  for (const h of [218, 402]) {
    box(0, h, W, 14, '#93a8b0');
    box(0, h, W, 2, light);
    box(29, h - 8, 112, 3, light);
    box(275, h - 8, 79, 3, light);
  }
  box(0, 58, W, 58, '#8da5ae');
  box(0, 54, W, 3, '#6b8994');

  // Service glass, the ticket machine, and the pale blue queue rails.
  box(8, 73, 133, 47, navy);
  for (const [i, x] of [12, 55, 98].entries()) {
    box(x, 69, 39, 35, '#84acba');
    box(x + 3, 67, 15, 2, '#c6dfe1');
    box(x + 11, 43, 17, 7, trim);
    box(x + 8, 77, 24, 9, blue);
    textCentred(ctx, `0${i + 1}`, x + 20, y(75), light);
  }
  box(7, 27, 135, 5, light);
  box(9, 22, 131, 19, trim);
  box(19, 109, 120, 25, navy);
  text(ctx, 'NOMOR BERIKUTNYA', 25, y(104), '#d4e7ea');
  text(ctx, 'A-023', 25, y(94), active, true);
  text(ctx, 'LOKET 02', 70, y(94), light, true);
  for (const x of [16, 50, 82, 118]) {
    box(x, 13, 2, 12, ink);
    box(x - 2, 2, 6, 2, ink);
  }
  box(16, 10, 103, 2, '#456e86');
  for (const x of [275, 300, 325]) {
    box(x, 20, 21, 10, trim);
    box(x + 2, 12, 20, 4, blue);
    box(x + 2, 8, 2, 8, ink);
    box(x + 17, 8, 2, 8, ink);
  }
  text(ctx, 'RUANG TUNGGU', 281, y(34), navy);

  const deck = floor.ledges[LIFT.ledge];
  box(deck.x - 4, 186, deck.w + 8, 186, navy);
  box(deck.x, 162, deck.w, 162, '#2d4c5f');
  for (const x of [deck.x + 4, deck.x + deck.w - 7]) {
    box(x, 162, 3, 162, '#799eac');
    for (let h = 6; h < 160; h += 12) box(x - 2, h, 7, 1, '#406777');
  }
  box(deck.x - 3, 186, deck.w + 6, 17, blue);
  textCentred(ctx, 'LIFT BERKAS', deck.x + deck.w / 2, y(181), light, true);
  for (const [h, label] of [
    [11, '01'],
    [LIFT.top + 11, '02'],
  ] as const) {
    box(deck.x + 12, h + 10, 14, 9, ink);
    text(ctx, label, deck.x + 15, y(h + 8), light);
  }
  // Glass along the verification landing; the solid strip is drawn below it.
  box(270, LIFT.top + 17, 114, 17, '#84a6b3');
  for (const x of [271, 305, 377]) box(x, LIFT.top + 17, 2, 17, navy);
  box(270, LIFT.top + 17, 114, 2, trim);

  box(0, 0, W, CELLAR, '#6e838c');
  box(0, 0, W, 24, trim);
  for (let x = 0; x < W; x += 32) {
    box(x + 1, -2, 29, 8, '#a7bec3');
    box(x + 12, -12, 29, 8, '#8da7b1');
  }
  box(0, 0, W, 2, light);
  box(24, -20, 124, 3, blue);
  for (const x of [44, 87, 130]) text(ctx, '>', x, y(-19), light);
  for (let x = 7; x < W; x += 48) box(x, -38, 1, CELLAR - 38, '#617984');

  return { sky, wall: canvas };
}

export const ATRIUM_SCENE: Scene = {
  backdrop,
  ledge(ctx, def, { x, sy }, game, index) {
    if (index === 0) return;
    const { w } = def;
    if (index === LIFT.ledge && game instanceof Atrium) {
      // The cabin back and position marker ride with the feet, not the wall.
      rect(ctx, x + 6, sy - 31, w - 12, 30, '#365d72');
      rect(ctx, x + 6, sy - 31, w - 12, 2, trim);
      rect(ctx, x + 15, sy - 50, 69, 16, ink);
      const phase = game.liftPhase;
      if (phase === 'arrived') {
        text(ctx, 'LOMPAT', x + 25, sy - 46, active, true);
        text(ctx, '>', x + 67, sy - 45, active);
      } else {
        textCentred(ctx, LIFT_LABEL[phase], x + w / 2, sy - 46, active, true);
      }
      if (phase === 'ready') textCentred(ctx, 'INJAK LIFT >', x + w / 2, sy - 25, light);
      if (phase === 'rising') textCentred(ctx, '^', x + w / 2, sy - 25, active);
      rect(ctx, x + 4, sy + 6, w - 8, 6, navy);
    }
    rect(ctx, x, sy, w, 8, ink);
    rect(ctx, x, sy, w, 2, light);
    rect(ctx, x + 1, sy + 3, w - 2, 3, blue);
  },
  exit(ctx: Ctx, x, sy, label) {
    rect(ctx, x - 18, sy - 39, 36, 39, ink);
    rect(ctx, x - 15, sy - 37, 30, 37, '#77a7b7');
    rect(ctx, x - 13, sy - 34, 26, 5, '#a9ccd4');
    rect(ctx, x - 1, sy - 37, 2, 37, navy);
    rect(ctx, x - 7, sy - 19, 4, 2, light);
    rect(ctx, x + 3, sy - 19, 4, 2, light);
    rect(ctx, x - 33, sy - 54, 66, 13, blue);
    textCentred(ctx, label, x, sy - 51, light, true);
  },
};
