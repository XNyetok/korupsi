/**
 * The things in the world: ledges, the player, auditors, stamps, envelopes,
 * the clock-in machine and the door. All drawn in code, a pixel at a time; no
 * image files. Coordinates are screen pixels: `sy` is the row of a surface,
 * and whatever stands on it is drawn upwards from there.
 */

import { STAMP, type StampState } from '../core/tower.ts';
import type { LedgeDef } from '../core/types.ts';
import { C } from './palette.ts';
import { type Ctx, layer, rect, stamp as stampRows, text, textCentred, textWidth } from './pixel.ts';

// ---------- ledges ----------

export interface LedgeLook {
  /** Left edge now (a troli moves). */
  x: number;
  sy: number;
  /** Rows between this ledge and the ground floor, for a desk's legs. */
  toGround: number;
  /** A fiktif ledge that has been touched. */
  shaking: boolean;
  time: number;
}

export function drawLedge(ctx: Ctx, def: LedgeDef, look: LedgeLook): void {
  const { sy } = look;
  const w = def.w;
  let x = Math.round(look.x);

  if (def.kind === 'fiktif') {
    if (look.shaking) x += Math.floor(look.time * 30) % 2 === 0 ? 1 : -1;
    // A barricade plank on bamboo that goes nowhere.
    rect(ctx, x + 2, sy + 7, w, 2, 'rgba(0, 0, 0, 0.25)');
    for (const px of [x + 5, x + w - 7]) {
      for (let k = 0; k < 13; k++) rect(ctx, px, sy + 6 + k, 2, 1, k % 5 === 4 ? C.bambooDark : C.bamboo);
    }
    for (let k = 0; k < 8; k++) rect(ctx, x + 8 + k * 2, sy + 8 + k, 2, 1, C.bambooDark);
    rect(ctx, x - 1, sy, w + 2, 7, C.ink);
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < w; c++) {
        rect(ctx, x + c, sy + r, 1, 1, ((c + r) >> 2) % 2 === 0 ? C.red : C.white);
      }
    }
    rect(ctx, x, sy, w, 1, C.white);
    return;
  }

  if (def.kind === 'troli') {
    // A filing cart; its rail is drawn by the renderer, which knows the track.
    rect(ctx, x + 2, sy + 12, w, 2, 'rgba(0, 0, 0, 0.25)');
    rect(ctx, x - 1, sy, w + 2, 4, C.ink);
    rect(ctx, x, sy, w, 3, C.steel);
    rect(ctx, x, sy, w, 1, C.steelLight);
    rect(ctx, x + 1, sy + 4, w - 2, 7, C.ink);
    rect(ctx, x + 2, sy + 4, w - 4, 6, C.steelDark);
    rect(ctx, x + 4, sy + 4, w - 9, 2, C.paper);
    rect(ctx, x + 6, sy + 6, w - 10, 1, C.paperDark);
    rect(ctx, x + 4, sy + 8, w - 8, 1, C.paper);
    for (const wx of [x + 4, x + w - 8]) {
      rect(ctx, wx, sy + 10, 4, 3, C.ink);
      rect(ctx, wx + 1, sy + 11, 2, 1, C.steelLight);
    }
    return;
  }

  switch (def.skin) {
    case 'lemari': {
      // a steel filing cabinet
      rect(ctx, x + 2, sy + 23, w, 2, 'rgba(0, 0, 0, 0.25)');
      rect(ctx, x - 1, sy, w + 2, 23, C.ink);
      rect(ctx, x, sy, w, 22, C.metal);
      rect(ctx, x, sy, w, 2, C.metalLight);
      rect(ctx, x + w - 2, sy + 2, 2, 20, C.metalDark);
      rect(ctx, x, sy + 12, w, 1, C.metalDark);
      const columns = Math.max(1, Math.round(w / 22));
      for (let i = 0; i < columns; i++) {
        const left = x + Math.round((i * w) / columns);
        const mid = left + Math.round(w / columns / 2);
        if (i > 0) rect(ctx, left, sy + 2, 1, 20, C.metalDark);
        for (const dy of [3, 14]) {
          rect(ctx, mid - 3, sy + dy, 6, 3, C.paper);
          rect(ctx, mid - 3, sy + dy + 5, 6, 1, C.metalDark);
        }
      }
      return;
    }
    case 'ac': {
      // an indoor air-conditioner unit
      rect(ctx, x + 2, sy + 13, w, 2, 'rgba(0, 0, 0, 0.25)');
      rect(ctx, x - 1, sy + 1, w + 2, 11, C.ink);
      rect(ctx, x, sy, w, 13, C.ink);
      rect(ctx, x, sy, w, 12, C.plastic);
      rect(ctx, x + 1, sy, w - 2, 1, C.white);
      rect(ctx, x + 4, sy + 4, 9, 1, C.plasticDark);
      rect(ctx, x + 1, sy + 8, w - 2, 4, C.plasticDark);
      rect(ctx, x + 3, sy + 9, w - 6, 1, C.ink);
      rect(ctx, x + 3, sy + 11, w - 6, 1, C.metalDark);
      rect(ctx, x + w - 7, sy + 5, 2, 1, C.green);
      rect(ctx, x + w - 4, sy + 13, 2, 9, C.plasticDark);
      return;
    }
    case 'meja': {
      // a service desk; near the ground it stands on legs
      const legs = look.toGround <= 40;
      rect(ctx, x + 4, sy + 17, w - 4, 2, 'rgba(0, 0, 0, 0.25)');
      if (legs) {
        rect(ctx, x + 3, sy + 4, 3, look.toGround - 4, C.woodDeep);
        rect(ctx, x + w - 6, sy + 4, 3, look.toGround - 4, C.woodDeep);
      }
      rect(ctx, x + 1, sy + 4, w - 2, 13, C.ink);
      rect(ctx, x + 2, sy + 4, w - 4, 12, C.woodDark);
      rect(ctx, x + 4, sy + 6, w - 8, 8, C.woodDeep);
      rect(ctx, x + 5, sy + 7, w - 10, 6, C.woodDark);
      rect(ctx, x + Math.round(w / 2) - 7, sy + 8, 14, 4, C.paper);
      rect(ctx, x + Math.round(w / 2) - 5, sy + 9, 8, 1, C.ink);
      rect(ctx, x - 2, sy, w + 4, 5, C.ink);
      rect(ctx, x - 1, sy, w + 2, 4, C.wood);
      rect(ctx, x - 1, sy, w + 2, 1, C.woodLight);
      rect(ctx, x - 1, sy + 3, w + 2, 1, C.woodDark);
      return;
    }
    case 'balkon': {
      // the landing outside the lurah's room, red carpet and all
      rect(ctx, x + 2, sy + 9, w, 2, 'rgba(0, 0, 0, 0.25)');
      rect(ctx, x - 1, sy, w + 1, 9, C.ink);
      rect(ctx, x, sy, w, 8, C.concrete);
      rect(ctx, x, sy + 6, w, 2, C.concreteDark);
      rect(ctx, x, sy, w, 2, C.red);
      rect(ctx, x, sy + 2, w, 1, C.redDark);
      for (let cx = x + 2; cx < x + w; cx += 6) rect(ctx, cx, sy, 2, 1, C.gold);
      for (let cx = x + 14; cx < x + w - 8; cx += 44) {
        for (let k = 0; k < 5; k++) rect(ctx, cx, sy + 9 + k, 6 - k, 1, C.concreteDark);
      }
      return;
    }
    case 'lantai':
      return;
    default: {
      // a wall shelf on brackets
      rect(ctx, x + 2, sy + 6, w, 2, 'rgba(0, 0, 0, 0.25)');
      for (const bx of [x + 5, x + w - 8]) {
        rect(ctx, bx, sy + 5, 2, 8, C.metalDark);
        rect(ctx, bx + 2, sy + 6, 3, 1, C.metalDark);
        rect(ctx, bx + 2, sy + 7, 2, 1, C.metalDark);
        rect(ctx, bx + 2, sy + 8, 1, 1, C.metalDark);
      }
      rect(ctx, x - 1, sy, w + 2, 6, C.ink);
      rect(ctx, x, sy, w, 5, C.wood);
      rect(ctx, x, sy, w, 1, C.woodLight);
      rect(ctx, x, sy + 4, w, 1, C.woodDark);
    }
  }
}

/** The rail a troli rolls on, with its end stops. */
export function drawRail(ctx: Ctx, from: number, to: number, sy: number): void {
  rect(ctx, from - 2, sy + 13, to - from + 4, 1, C.metalDark);
  rect(ctx, from - 3, sy + 10, 2, 5, C.metalDark);
  rect(ctx, to + 1, sy + 10, 2, 5, C.metalDark);
  for (let x = from + 6; x < to; x += 22) rect(ctx, x, sy + 14, 1, 3, C.slab);
}

// ---------- people ----------

export type Pose = 'idle' | 'run' | 'jump' | 'fall' | 'dash' | 'caught';

export interface PersonLook {
  x: number;
  sy: number;
  facing: -1 | 1;
  pose: Pose;
  /** Seconds, for breathing and blinking. */
  time: number;
  /** Advances by one for every stride. */
  stride: number;
  /** Envelopes carried: the belly and the bag grow with it. */
  weight: number;
}

/** People are drawn here first, so they can be given a dark outline. */
const SCRATCH_W = 40;
const SCRATCH_H = 44;
const FEET_X = 20;
const FEET_Y = 40;
let scratch: { canvas: HTMLCanvasElement; ctx: Ctx } | null = null;
let shadow: { canvas: HTMLCanvasElement; ctx: Ctx } | null = null;

function outlined(ctx: Ctx, x: number, sy: number, facing: -1 | 1, alpha: number, paint: (c: Ctx) => void): void {
  scratch ??= layer(SCRATCH_W, SCRATCH_H);
  shadow ??= layer(SCRATCH_W, SCRATCH_H);

  const s = scratch.ctx;
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.clearRect(0, 0, SCRATCH_W, SCRATCH_H);
  s.setTransform(facing, 0, 0, 1, FEET_X, FEET_Y);
  paint(s);

  const o = shadow.ctx;
  o.globalCompositeOperation = 'source-over';
  o.clearRect(0, 0, SCRATCH_W, SCRATCH_H);
  o.drawImage(scratch.canvas, 0, 0);
  o.globalCompositeOperation = 'source-in';
  o.fillStyle = C.ink;
  o.fillRect(0, 0, SCRATCH_W, SCRATCH_H);

  const left = Math.round(x) - FEET_X;
  const top = Math.round(sy) - FEET_Y;
  ctx.globalAlpha = alpha;
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const) {
    ctx.drawImage(shadow.canvas, left + dx, top + dy);
  }
  ctx.drawImage(scratch.canvas, left, top);
  ctx.globalAlpha = 1;
}

/** A rectangle in a person's own space: x forward, `up` above the feet. */
function part(ctx: Ctx, x: number, up: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, -up - h, w, h);
}

interface Legs {
  /** Far leg, then near leg: x, how far the foot is off the ground, length. */
  far: [number, number, number];
  near: [number, number, number];
  bob: number;
}

function legsFor(pose: Pose, stride: number): Legs {
  if (pose === 'run') {
    const frame = Math.floor(stride) % 4;
    if (frame === 0) return { far: [-5, 1, 5], near: [1, 0, 6], bob: 0 };
    if (frame === 1) return { far: [-2, 0, 6], near: [-1, 1, 5], bob: 1 };
    if (frame === 2) return { far: [1, 0, 6], near: [-5, 1, 5], bob: 0 };
    return { far: [-1, 1, 5], near: [-2, 0, 6], bob: 1 };
  }
  if (pose === 'jump') return { far: [-4, 2, 4], near: [0, 3, 4], bob: 0 };
  if (pose === 'fall') return { far: [-5, 0, 6], near: [1, 1, 6], bob: 0 };
  if (pose === 'dash') return { far: [-6, 1, 5], near: [-2, 2, 5], bob: -1 };
  return { far: [-4, 0, 6], near: [0, 0, 6], bob: 0 };
}

function paintLegs(ctx: Ctx, legs: Legs, cloth: string, clothDark: string): void {
  const [fx, flift, flen] = legs.far;
  part(ctx, fx, flift + 2, 3, flen, clothDark);
  part(ctx, fx, flift, 4, 2, C.shoe);
  const [nx, nlift, nlen] = legs.near;
  part(ctx, nx, nlift + 2, 3, nlen, cloth);
  part(ctx, nx, nlift, 4, 2, C.shoe);
}

/** The player: an official in a safari suit and a peci, with a bag that fills up. */
export function drawPlayer(ctx: Ctx, look: PersonLook, alpha = 1): void {
  outlined(ctx, look.x, look.sy, look.facing, alpha, (c) => {
    const { pose, weight } = look;
    const legs = legsFor(pose, look.stride);
    const caught = pose === 'caught';
    const breathe = pose === 'idle' && Math.floor(look.time * 2) % 2 === 0 ? 1 : 0;
    const bob = legs.bob + breathe;
    const swing = pose === 'run' ? (Math.floor(look.stride) % 4 < 2 ? 1 : -1) : 0;
    const belly = Math.min(3, Math.ceil(weight / 2));
    const jacket = caught ? C.orange : C.safari;
    const jacketDark = caught ? C.redDark : C.safariDark;
    const jacketLight = caught ? C.goldLight : C.safariLight;

    // the bag, in the far hand: fatter with every envelope
    if (!caught) {
      const bagW = 6 + Math.min(3, weight >> 1);
      const bx = -5 - bagW - swing;
      part(c, bx + 2, 9 + bob, 2, 1, C.bag);
      part(c, bx, 4 + bob, bagW, 5, C.bag);
      part(c, bx, 8 + bob, bagW, 1, C.bagLight);
      if (weight > 0) part(c, bx + 1, 9 + bob, Math.min(bagW - 2, 1 + weight), 1, C.gold);
      part(c, -6 - swing, 9 + bob, 2, 6, jacketDark);
    }

    paintLegs(c, legs, C.trousers, C.safariDark);

    // jacket: four pockets, a row of buttons, and room for lunch
    part(c, -5, 8 + bob, 10, 9, jacket);
    part(c, -5, 8 + bob, 2, 9, jacketDark);
    if (belly > 0) {
      part(c, 5, 9 + bob, belly, 6, jacket);
      part(c, 5, 9 + bob, belly, 1, jacketDark);
    }
    part(c, -2, 13 + bob, 3, 2, jacketDark);
    part(c, -2, 9 + bob, 3, 2, jacketDark);
    for (const up of [10, 12, 14]) part(c, 3, up + bob, 1, 1, caught ? C.white : C.goldDark);
    part(c, 1, 16 + bob, 4, 1, jacketLight);

    // near arm
    if (caught) {
      part(c, 3, 10 + bob, 5, 2, C.skin);
      part(c, 6, 9 + bob, 2, 4, C.metal);
    } else if (pose === 'jump') {
      part(c, 3, 13 + bob, 2, 3, jacketLight);
      part(c, 4, 16 + bob, 2, 5, C.skin);
    } else if (pose === 'fall') {
      part(c, 3, 14 + bob, 3, 2, jacketLight);
      part(c, 6, 14 + bob, 4, 2, C.skin);
    } else if (pose === 'dash') {
      part(c, -1, 12 + bob, 4, 2, jacketLight);
      part(c, -5, 12 + bob, 4, 2, C.skin);
    } else {
      part(c, 1 + swing, 12 + bob, 2, 4, jacketLight);
      part(c, 1 + swing, 9 + bob, 2, 3, C.skin);
    }

    // head
    part(c, -1, 17 + bob, 3, 1, C.skinDark);
    part(c, -3, 18 + bob, 7, 6, C.skin);
    part(c, -3, 18 + bob, 2, 6, C.skinDark);
    part(c, -3, 21 + bob, 1, 3, C.hair);
    part(c, 4, 20 + bob, 1, 1, C.skin);
    const blink = Math.floor(look.time * 10) % 31 === 0;
    part(c, 2, 21 + bob, 1, blink ? 0 : 1, C.ink);
    part(c, 2, 19 + bob, 3, 1, C.hair);

    // peci: it lifts a little on the way down
    const lift = pose === 'fall' ? 1 : 0;
    part(c, -3, 24 + bob + lift, 7, 3, C.peci);
    part(c, -2, 26 + bob + lift, 5, 1, C.peciLight);
  });
}

/** An auditor: white shirt, lanyard, glasses, and a clipboard that is never empty. */
export function drawAuditor(ctx: Ctx, look: PersonLook): void {
  outlined(ctx, look.x, look.sy, look.facing, 1, (c) => {
    const legs = legsFor('run', look.stride);
    const bob = legs.bob;
    paintLegs(c, legs, C.navy, C.ink);

    part(c, -4, 8 + bob, 9, 9, C.shirt);
    part(c, -4, 8 + bob, 2, 9, C.shirtDark);
    part(c, -4, 8 + bob, 9, 1, C.ink);
    // lanyard and badge: the red that means trouble
    part(c, 0, 15 + bob, 1, 2, C.red);
    part(c, 1, 13 + bob, 1, 2, C.red);
    part(c, 0, 10 + bob, 3, 3, C.red);
    part(c, 1, 11 + bob, 1, 1, C.white);

    // clipboard held out in front
    part(c, 3, 11 + bob, 2, 3, C.shirt);
    part(c, 5, 9 + bob, 5, 7, C.woodDark);
    part(c, 6, 10 + bob, 3, 5, C.paper);
    part(c, 6, 13 + bob, 2, 1, C.ink);
    part(c, 6, 11 + bob, 3, 1, C.red);

    part(c, -1, 17 + bob, 3, 1, C.skinDark);
    part(c, -3, 18 + bob, 7, 6, C.skin);
    part(c, -3, 18 + bob, 2, 6, C.skinDark);
    part(c, 4, 20 + bob, 1, 1, C.skin);
    // neat hair, and glasses that catch the light
    part(c, -3, 23 + bob, 7, 2, C.hair);
    part(c, -3, 20 + bob, 1, 3, C.hair);
    part(c, 0, 21 + bob, 4, 1, C.ink);
    part(c, 2, 21 + bob, 1, 1, C.lens);
    part(c, 2, 19 + bob, 2, 1, C.skinDark);
  });
}

// ---------- hazards and pickups ----------

/** The stamp over a desk: a mount, a rod, and a head that comes down hard. */
export function drawStamp(ctx: Ctx, cx: number, sy: number, state: StampState, time: number): void {
  const jitter = state.phase === 'warn' ? (Math.floor(time * 40) % 2 === 0 ? 1 : -1) : 0;
  const x = Math.round(cx) + jitter;
  const bottom = sy - Math.round(state.lift * STAMP.lift);
  const mount = sy - STAMP.lift - 46;
  const half = STAMP.w / 2;

  // the form waiting on the desk, and the mark left on it
  rect(ctx, cx - half + 3, sy - 1, STAMP.w - 6, 1, C.paper);
  if (state.phase === 'rise' || (state.phase === 'rest' && state.progress < 0.5)) {
    rect(ctx, cx - 7, sy - 1, 14, 1, C.red);
  }

  rect(ctx, cx - 9, mount, 18, 5, C.ink);
  rect(ctx, cx - 8, mount + 1, 16, 3, C.metalDark);
  rect(ctx, x - 1, mount + 5, 3, bottom - 26 - (mount + 5), C.metalDark);
  rect(ctx, x, mount + 5, 1, bottom - 26 - (mount + 5), C.metal);

  // knob and neck
  rect(ctx, x - 7, bottom - 27, 14, 8, C.ink);
  rect(ctx, x - 6, bottom - 26, 12, 6, C.wood);
  rect(ctx, x - 6, bottom - 26, 12, 2, C.woodLight);
  rect(ctx, x - 4, bottom - 20, 8, 9, C.ink);
  rect(ctx, x - 3, bottom - 20, 6, 9, C.woodDark);
  rect(ctx, x - 3, bottom - 20, 2, 9, C.wood);

  // the head: a block, and the red rubber that does the damage
  rect(ctx, x - half - 1, bottom - STAMP.h - 1, STAMP.w + 2, STAMP.h + 1, C.ink);
  rect(ctx, x - half, bottom - STAMP.h, STAMP.w, STAMP.h - 3, C.woodDark);
  rect(ctx, x - half, bottom - STAMP.h, STAMP.w, 1, C.wood);
  rect(ctx, x - half, bottom - 3, STAMP.w, 3, state.phase === 'warn' ? C.orange : C.red);
  rect(ctx, x - half, bottom - 1, STAMP.w, 1, C.redDark);
}

const AMPLOP = [
  '.ooooooooo.',
  'oyyyyyyyyyo',
  'odyyyyyyydo',
  'oyddyryddyo',
  'oyyydrdyyyo',
  'oyyyyyyyyyo',
  '.ooooooooo.',
];
const AMPLOP_COLORS = { o: C.goldDark, y: C.gold, d: C.goldDark, r: C.red };

/** A brown envelope, bobbing; `sy` is the row of its middle. */
export function drawAmplop(ctx: Ctx, x: number, sy: number, time: number): void {
  const bob = Math.round(Math.sin(time * 3 + x) * 1.5);
  stampRows(ctx, AMPLOP, AMPLOP_COLORS, x - 5, sy - 3 + bob);
  if (Math.floor(time * 4 + x) % 9 === 0) {
    rect(ctx, x + 5, sy - 6 + bob, 1, 3, C.white);
    rect(ctx, x + 4, sy - 5 + bob, 3, 1, C.white);
  }
}

/** The clock-in machine: a checkpoint. Red until it has been touched. */
export function drawCheckpoint(ctx: Ctx, x: number, sy: number, active: boolean, time: number): void {
  rect(ctx, x, sy - 12, 1, 12, C.metalDark);
  rect(ctx, x - 5, sy - 25, 11, 14, C.ink);
  rect(ctx, x - 4, sy - 24, 9, 12, C.steelDark);
  rect(ctx, x - 4, sy - 24, 9, 1, C.steel);
  rect(ctx, x - 2, sy - 22, 5, 4, active ? C.glass : C.slab);
  if (active) {
    rect(ctx, x - 1, sy - 20, 1, 1, C.greenDark);
    rect(ctx, x, sy - 19, 1, 1, C.greenDark);
    rect(ctx, x + 1, sy - 21, 1, 2, C.greenDark);
  }
  const lit = active || Math.floor(time * 3) % 2 === 0;
  rect(ctx, x - 1, sy - 16, 3, 2, active ? C.green : lit ? C.red : C.redDark);
  const label = 'ABSEN';
  rect(ctx, x - Math.ceil(textWidth(label) / 2) - 2, sy - 35, textWidth(label) + 4, 9, C.ink);
  textCentred(ctx, label, x + 1, sy - 33, active ? C.green : C.paper);
}

/** The way out of the floor. */
export function drawExit(ctx: Ctx, x: number, sy: number, label: string): void {
  rect(ctx, x - 12, sy - 34, 24, 34, C.ink);
  rect(ctx, x - 11, sy - 33, 22, 33, C.woodDeep);
  rect(ctx, x - 9, sy - 31, 18, 31, C.wood);
  rect(ctx, x - 9, sy - 31, 18, 1, C.woodLight);
  rect(ctx, x - 7, sy - 28, 14, 11, C.woodDark);
  rect(ctx, x - 7, sy - 14, 14, 11, C.woodDark);
  rect(ctx, x + 5, sy - 17, 2, 3, C.gold);

  const w = textWidth(label) + 14;
  const left = x - Math.round(w / 2);
  rect(ctx, left - 1, sy - 47, w + 2, 11, C.ink);
  rect(ctx, left, sy - 46, w, 9, C.greenDark);
  text(ctx, label, left + 3, sy - 44, C.white);
  text(ctx, '^', left + w - 7, sy - 44, C.goldLight);
}

/**
 * The tape the audit team leaves behind: fall below it and they have you.
 * `left` and `width` are the part of the tower the view shows.
 */
export function drawAuditLine(ctx: Ctx, sy: number, left: number, width: number, viewH: number): void {
  if (sy > viewH) return;
  ctx.fillStyle = 'rgba(143, 42, 38, 0.32)';
  ctx.fillRect(left, sy + 3, width, Math.max(0, viewH - sy - 3));
  for (let x = left - (left % 12) - 8; x < left + width; x += 12) {
    rect(ctx, x, sy, 7, 3, C.red);
    rect(ctx, x + 7, sy, 5, 3, C.white);
  }
  rect(ctx, left, sy + 3, width, 1, C.redDark);
  const label = 'TIM AUDIT';
  rect(ctx, left + 10, sy + 6, textWidth(label) + 6, 9, C.red);
  text(ctx, label, left + 13, sy + 8, C.white);
}
