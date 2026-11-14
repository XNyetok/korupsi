/**
 * What a run says about itself when it ends, for telemetry: enough to judge
 * the floor by, and nothing about the player. Field names match what the
 * collector stores (server/store.mjs) and explains (its ABOUT block).
 */

import type { Game } from './game.ts';
import { gelarFor } from './gelar.ts';

export type Ending = 'finished' | 'abandoned';

/** At most this many catch positions go out with a run, so a beacon stays small. */
export const MAX_SPOTS = 30;

export interface RunReport {
  /** `finished` reached the door; `abandoned` was closed or restarted before it. */
  cause: Ending;
  /** Rupiah carried at the end. */
  money: number;
  /** Envelopes carried at the end. */
  weight: number;
  /** Highest point reached, in metres. */
  height: number;
  /** Seconds on the run's clock. */
  duration: number;
  /** Times caught. */
  deaths: number;
  /** The last checkpoint reached: 0 is the lobby. */
  checkpoint: number;
  /** How often each hazard caught the player, by `kind:ledge`, or `jatuh`. */
  hazards: Record<string, number>;
  /** The title earned, for a run that finished. */
  title?: string;
  /** Whole seconds on the run clock at which each checkpoint after the lobby was first reached; null when skipped. */
  splits: (number | null)[];
  /** Where catches happened, [x, y, envelopes carried] in game pixels: all of them, or an even sample of MAX_SPOTS. */
  spots: [number, number, number][];
  /** What caught the player last, for a run that was caught at all. */
  lastHazard?: string;
  /** Whole seconds since the last catch, or since the start when there was none. */
  sinceCaught: number;
  /** Envelopes picked up at least once, and those carried at the end, by index in the floor's `amplop`. */
  picked: number[];
  kept: number[];
  /** Envelopes a catch put back on the floor. */
  lost: number;
  /** Whole seconds spent free to move while carrying 0, 1, 2... envelopes, and the catches at each weight. */
  carried: number[];
  caughtWith: number[];
  jumps: number;
  dashes: number;
  /** Whole seconds stood on each ledge, by index, for the ledges stood on for a second or more. */
  dwell: Record<string, number>;
  /** True when the floor had been finished on this device before this run began. */
  finishedBefore: boolean;
  /** For a finish that beat a record: which one. */
  record?: 'time' | 'money' | 'both';
}

/** `count` items spread evenly over `items`, first and last included. */
function sample<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  const step = (items.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => items[Math.round(i * step)] as T);
}

const indices = (flags: boolean[]) => flags.flatMap((on, i) => (on ? [i] : []));

export function runReport(game: Game, cause: Ending): RunReport {
  const { log } = game;
  const dwell: Record<string, number> = {};
  log.dwell.forEach((seconds, ledge) => {
    if (seconds >= 1) dwell[ledge] = Math.round(seconds);
  });

  const report: RunReport = {
    cause,
    money: game.money,
    weight: game.weight,
    height: game.heightMetres,
    duration: Math.round(game.time),
    deaths: game.deaths,
    checkpoint: game.checkpoint,
    hazards: { ...game.catches },
    splits: log.splits.map((t) => (t == null ? null : Math.round(t))),
    spots: sample(log.spots, MAX_SPOTS).map(([x, y, w]) => [x, y, w]),
    sinceCaught: Math.round(game.time - log.lastCaught),
    picked: indices(log.picked),
    kept: indices(game.taken),
    lost: log.lost,
    carried: log.carried.map((t) => Math.round(t)),
    caughtWith: [...log.caughtWith],
    jumps: log.jumps,
    dashes: log.dashes,
    dwell,
    finishedBefore: log.finishedBefore,
  };
  if (log.lastHazard) report.lastHazard = log.lastHazard;
  if (cause === 'finished') {
    const total = game.floor.amplop.length;
    report.title = gelarFor({ time: game.time, deaths: game.deaths, weight: game.weight, total }).id;
    const { time, money } = game.record;
    if (time || money) report.record = time && money ? 'both' : time ? 'time' : 'money';
  }
  return report;
}
