#!/usr/bin/env node
/**
 * Writes server/floor.json: the floor in game pixels, with its ledges,
 * hazards, envelopes, clock-in machines and door. The collector sends it with
 * the statistics, so the panel can draw where players are caught and a reader
 * of the JSON can tell what a position or a ledge number is.
 *
 * Run it after changing a floor in src/core/tower.ts; tests/panel.test.mjs
 * fails while the file and the floor disagree.
 *
 *   node scripts/floor.mjs
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { WORLD_WIDTH } from '../src/core/params.ts';
import { FLOORS } from '../src/core/tower.ts';

export const FLOOR_FILE = fileURLToPath(new URL('../server/floor.json', import.meta.url));

/** What the panel needs of a floor, and nothing else. */
export function floorPlan(floor) {
  return {
    name: floor.name,
    width: WORLD_WIDTH,
    height: floor.height,
    ledges: floor.ledges.map(({ x, y, w, kind, travel }) => ({
      x,
      y,
      w,
      ...(kind ? { kind } : {}),
      ...(travel ? { travel } : {}),
    })),
    auditors: floor.auditors.map(({ ledge, from, to }) => ({ ledge, from, to })),
    stamps: floor.stamps.map(({ ledge, x }) => ({ ledge, x })),
    amplop: floor.amplop.map(({ x, y }) => ({ x, y })),
    checkpoints: floor.checkpoints.map(({ ledge, x }) => ({ ledge, x })),
    exit: { ledge: floor.exit.ledge, x: floor.exit.x },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(FLOOR_FILE, `${JSON.stringify(floorPlan(FLOORS[0]), null, 2)}\n`);
  console.log(`wrote ${FLOOR_FILE}`);
}
