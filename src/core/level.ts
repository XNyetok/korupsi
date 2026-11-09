/**
 * Builds the next level: two ledges at one height above where the player
 * stands, and sometimes an auditor on the money. Every random number comes
 * from the run's stream, in a fixed order, so a seed always builds the same
 * level for the same position.
 */

import { clamp, envelope, landingX } from './physics.ts';
import { PARAMS } from './params.ts';
import type { Rng } from './rng.ts';
import { AUDITOR_REACH } from './rules.ts';
import type { Auditor, Platform, PlatformType } from './types.ts';

/** Ledges may reach this close to the wall, so a ledge can sit under a player pinned to it. */
const WALL_PAD = 6;
/** Empty space between the two ledges of a level. */
const LEDGE_GAP = 12;
/** A landing spot is at least this far inside the ledge it belongs to. */
const HOLD = 6;

export interface LevelContext {
  rng: Rng;
  width: number;
  /** Levels climbed so far this run. */
  level: number;
  /** The player's current jump strength, from their weight. */
  factor: number;
  /** Hands out platform ids, in order. */
  nextId(): number;
}

export interface Level {
  left: Platform;
  right: Platform;
  auditor: Auditor | null;
}

export function groundLedge(width: number, id: number): Platform {
  return {
    id,
    x: width / 2,
    y: 0,
    w: Math.min(width - 56, 220),
    gold: false,
    type: 'solid',
    crumble: 0,
    alive: true,
    taken: false,
  };
}

/** The level above a player standing at (anchorX, anchorY). */
export function generateLevel(ctx: LevelContext, anchorX: number, anchorY: number): Level {
  const rand = (a: number, b: number) => a + ctx.rng() * (b - a);

  const env = envelope(ctx.factor);
  const dy = rand(env.h * PARAMS.gapMin, env.h * PARAMS.gapMax);
  const travel = env.dxAt(dy);

  const roll = ctx.rng();
  let goldLeft = false;
  let goldRight = false;
  if (roll < PARAMS.goldChance) {
    if (ctx.rng() < 0.5) goldLeft = true;
    else goldRight = true;
  } else if (roll < PARAMS.goldChance + PARAMS.doubleGoldChance) {
    goldLeft = true;
    goldRight = true;
  }

  // The first level always shows the choice, so the mechanic is visible
  // before the player has to guess at it.
  if (ctx.level < 1) {
    goldLeft = ctx.rng() < 0.5;
    goldRight = !goldLeft;
  }

  // Both sides always get a ledge. Near a wall the jump on that side ends at
  // the wall, so its ledge goes under the wall; the split between the two
  // sits between the landing spots, leaving each one a margin.
  const landLeft = landingX(anchorX, -1, travel, ctx.width);
  const landRight = landingX(anchorX, 1, travel, ctx.width);
  const lo = landLeft + HOLD + LEDGE_GAP / 2;
  const hi = landRight - HOLD - LEDGE_GAP / 2;
  const split = lo <= hi ? clamp((landLeft + landRight) / 2, lo, hi) : (landLeft + landRight) / 2;

  const y = anchorY - dy;
  const left = makeLedge(ctx, rand, anchorX, y, -1, travel, landLeft, split - LEDGE_GAP / 2, goldLeft);
  const right = makeLedge(ctx, rand, anchorX, y, 1, travel, landRight, split + LEDGE_GAP / 2, goldRight);

  return { left, right, auditor: maybeAuditor(ctx, rand, anchorX, left, right, landLeft, landRight) };
}

function riskyType(rng: Rng): PlatformType {
  const r = rng();
  if (r < 0.66) return 'solid';
  if (r < 0.88) return 'krat';
  return 'fiktif';
}

/**
 * One ledge on one side. `landing` is where the jump ends; `edge` is the
 * boundary with the other side's ledge, which this one may not cross.
 */
function makeLedge(
  ctx: LevelContext,
  rand: (a: number, b: number) => number,
  anchorX: number,
  y: number,
  dir: number,
  travel: number,
  landing: number,
  edge: number,
  gold: boolean,
): Platform {
  const width = ctx.width;
  const w = gold ? rand(60, 74) : rand(84, 108);

  // Sit around the landing spot. The minimum offset keeps the pair reading
  // as left/right instead of bunched under the player; against a wall the
  // landing spot is the wall, so the ledge goes there.
  const pinned = landing !== anchorX + dir * travel;
  const jitter = rand(-w * 0.28, w * 0.28);
  let centre = pinned ? landing : anchorX + dir * Math.max(PARAMS.minLedgeOffset, travel + jitter);
  centre = clamp(centre, WALL_PAD + w / 2, width - WALL_PAD - w / 2);

  let x0 = centre - w / 2;
  let x1 = centre + w / 2;

  // Never reach into the other side's half.
  if (dir < 0) x1 = Math.min(x1, edge);
  else x0 = Math.max(x0, edge);

  // The landing spot must be on the ledge, whatever the clipping did.
  x0 = Math.max(WALL_PAD, Math.min(x0, landing - HOLD));
  x1 = Math.min(width - WALL_PAD, Math.max(x1, landing + HOLD));

  return {
    id: ctx.nextId(),
    x: (x0 + x1) / 2,
    y,
    w: x1 - x0,
    gold,
    type: gold ? riskyType(ctx.rng) : ctx.rng() < 0.35 ? 'krat' : 'solid',
    crumble: 0,
    alive: true,
    taken: false,
  };
}

function maybeAuditor(
  ctx: LevelContext,
  rand: (a: number, b: number) => number,
  anchorX: number,
  left: Platform,
  right: Platform,
  landLeft: number,
  landRight: number,
): Auditor | null {
  if (ctx.level < 5) return null;
  if (left.gold === right.gold) return null;
  if (ctx.rng() > 0.5) return null;

  const gold = left.gold ? left : right;
  const goldOnLeft = gold === left;

  // The auditor only guards the money. The safe jump runs from the anchor to
  // the safe landing spot, so the patrol stays clear of that whole path,
  // plus the reach of a catch and a margin.
  const clearance = AUDITOR_REACH + 6;
  const reach = gold.w / 2 + 26;
  const half = 15;
  let minX = Math.max(half, gold.x - reach);
  let maxX = Math.min(ctx.width - half, gold.x + reach);
  if (goldOnLeft) maxX = Math.min(maxX, Math.min(anchorX, landRight) - clearance);
  else minX = Math.max(minX, Math.max(anchorX, landLeft) + clearance);

  // Too little room to patrol without touching the safe path: no auditor.
  if (maxX - minX < 8) return null;

  return {
    upper: gold,
    x: clamp(gold.x, minX, maxX),
    y: gold.y - 11,
    dir: ctx.rng() < 0.5 ? -1 : 1,
    speed: rand(34, 62),
    w: 30,
    h: 26,
    minX,
    maxX,
  };
}
