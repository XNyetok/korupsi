#!/usr/bin/env node
/**
 * Headless balance simulator: plays the real simulation in src/core with bot
 * profiles, so tuning decisions rest on numbers instead of guesses. No
 * browser, no DOM. The methodology and the latest numbers live in
 * docs/design/game-design.md ("What the simulation measures" and the
 * playtest log); every number cited there comes from this script.
 *
 * A bot re-decides after every landing: it stands still for the reaction
 * time, then jumps to its preferred ledge of the pair above. The reaction
 * time is the honest dial: 0.25 s is the reference bot of the playtest log,
 * while 1-2 s is a human deciding, which is where the audit band bites.
 *
 * Usage:
 *   node scripts/simulate.mjs                        # the log's table: safe/half/greedy, 500 runs, 0.25 s
 *   node scripts/simulate.mjs --reaction 1.5         # a casual human at the current numbers
 *   node scripts/simulate.mjs --base 12 --accel 0.6  # a candidate, without touching params.ts
 *
 * Medians are stable at 500 runs. The half-greedy coin is Math.random, so
 * single runs differ; keep --runs at a few hundred when comparing.
 */

import { parseArgs } from 'node:util';

import { Game } from '../src/core/game.ts';
import { PARAMS } from '../src/core/params.ts';
import { rupiah } from '../src/core/rules.ts';

const STEP = 1 / 120;
/** A run is capped so a near-still band cannot loop forever. */
const MAX_SECONDS = 900;

const { values } = parseArgs({
  options: {
    base: { type: 'string' },
    accel: { type: 'string' },
    reaction: { type: 'string', default: '0.25' },
    style: { type: 'string', default: 'all' },
    runs: { type: 'string', default: '500' },
  },
});

const reaction = Number(values.reaction);
const runs = Number(values.runs);
if (!Number.isFinite(reaction) || reaction < 0) throw new Error('--reaction wants seconds, e.g. 0.25');
if (!Number.isInteger(runs) || runs < 1) throw new Error('--runs wants a count, e.g. 500');
const styles = { safe: ['safe'], half: ['half'], greedy: ['greedy'], all: ['safe', 'half', 'greedy'] }[
  values.style
] ?? ['safe', 'half', 'greedy'];

// A candidate can be tried without touching params.ts.
if (values.base !== undefined) {
  const base = Number(values.base);
  if (!Number.isFinite(base) || base <= 0) throw new Error('--base wants a speed in units/s');
  PARAMS.cameraBase = base;
}
if (values.accel !== undefined) {
  const accel = Number(values.accel);
  if (!Number.isFinite(accel) || accel < 0) throw new Error('--accel wants an acceleration in units/s²');
  PARAMS.cameraAccel = accel;
}

/** The pair of ledges above the player's current footing. */
function levelAbove(game) {
  const anchor = game.player.onGround;
  if (!anchor) return [];
  const alive = game.platforms.filter((p) => p.alive && p.y < anchor.y - 4);
  const top = Math.min(...alive.map((p) => p.y));
  return alive.filter((p) => Math.abs(p.y - top) < 1);
}

/** -1 for the left ledge of the pair, 1 for the right one. */
function sideOf(option, options) {
  return options.every((o) => o.x >= option.x) ? -1 : 1;
}

function land(game) {
  for (let i = 0; i < 400 && game.phase === 'playing' && !game.player.onGround; i++) game.step(STEP);
}

function run(style) {
  const game = new Game({ onEnd() {} });
  game.setViewport(780);
  game.start();
  let steps = MAX_SECONDS / STEP;
  while (game.phase === 'playing' && steps-- > 0) {
    if (!game.player.onGround) {
      game.step(STEP);
      continue;
    }
    // The bot hesitates like its profile says, then commits to a side.
    const pause = Math.round(reaction / STEP);
    for (let i = 0; i < pause && game.phase === 'playing'; i++) game.step(STEP);
    if (game.phase !== 'playing') break;
    const options = levelAbove(game);
    if (!options.length) {
      game.step(STEP);
      continue;
    }
    const wantGold = style === 'greedy' || (style === 'half' && Math.random() < 0.5);
    const pick = (wantGold ? options.find((o) => o.gold) : options.find((o) => !o.gold)) ?? options[0];
    game.jump(sideOf(pick, options));
    land(game);
  }
  return { cause: game.cause || 'capped', money: game.money, height: game.heightMetres, duration: game.elapsed };
}

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

for (const style of styles) {
  const sample = Array.from({ length: runs }, () => run(style));
  const causes = {};
  for (const r of sample) causes[r.cause] = (causes[r.cause] ?? 0) + 1;
  const mix = Object.entries(causes)
    .sort((a, b) => b[1] - a[1])
    .map(([cause, n]) => `${cause} ${Math.round((n / runs) * 100)}%`)
    .join(', ');
  const height = Math.round(median(sample.map((r) => r.height)));
  const money = median(sample.map((r) => r.money));
  const duration = Math.round(median(sample.map((r) => r.duration)));
  console.log(
    `${style.padEnd(6)}  median ${String(height).padStart(5)} m  ${rupiah(money).padStart(14)}  ` +
      `${String(duration).padStart(4)} s  | ${mix}`,
  );
}
console.log(
  `# ${runs} runs per style, reaction ${reaction} s, ` +
    `cameraBase ${PARAMS.cameraBase}, cameraAccel ${PARAMS.cameraAccel}`,
);
