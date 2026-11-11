/**
 * What a run says about itself when it ends, for telemetry: enough to judge
 * the floor by, and nothing about the player. Field names match what the
 * collector stores (server/store.mjs) and explains (its ABOUT block).
 */

import type { Game } from './game.ts';
import { gelarFor } from './gelar.ts';

export type Ending = 'finished' | 'abandoned';

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
}

export function runReport(game: Game, cause: Ending): RunReport {
  const report: RunReport = {
    cause,
    money: game.money,
    weight: game.weight,
    height: game.heightMetres,
    duration: Math.round(game.time),
    deaths: game.deaths,
    checkpoint: game.checkpoint,
    hazards: { ...game.catches },
  };
  if (cause === 'finished') {
    const total = game.floor.amplop.length;
    report.title = gelarFor({ time: game.time, deaths: game.deaths, weight: game.weight, total }).id;
  }
  return report;
}
