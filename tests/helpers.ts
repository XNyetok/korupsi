import { Game } from '../src/core/game.ts';
import { PARAMS } from '../src/core/params.ts';
import { ledgeX } from '../src/core/tower.ts';
import type { FloorDef, Input } from '../src/core/types.ts';

export const STEP = 1 / 120;

export const idle: Input = { move: 0, jump: false, dash: false };

/** A running game with the hazards off, so a test can study one thing. */
export function quietGame(floor?: FloorDef): Game {
  const game = new Game(floor ? { floor } : {});
  game.hazards = false;
  game.start();
  return game;
}

/** Steps the game for `seconds`, asking `input` what is held at each moment. */
export function run(game: Game, seconds: number, input: Input | ((t: number) => Input) = idle): void {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    game.step(STEP, typeof input === 'function' ? input(i * STEP) : input);
  }
}

export interface ReachOptions {
  /** Allow the dash. Default true. */
  dash?: boolean;
}

/**
 * Can a player standing on ledge `from` get onto ledge `to` in one jump,
 * carrying `weight` envelopes? Tries a grid of honest inputs: where to stand,
 * how long to run up, how long to hold the jump, when to dash, when to stop
 * steering. A troli is tried at several points of its round trip.
 */
export function canReach(
  floor: FloorDef,
  from: number,
  to: number,
  weight: number,
  options: ReachOptions = {},
): boolean {
  const a = floor.ledges[from];
  const b = floor.ledges[to];
  if (!a || !b) return false;

  const period = Math.max(a.kind === 'troli' ? (a.period ?? 4) : 0, b.kind === 'troli' ? (b.period ?? 4) : 0);
  const clocks = period > 0 ? Array.from({ length: 8 }, (_, i) => (i / 8) * period) : [0];
  const dashes = options.dash === false ? [-1] : [-1, 0.05, 0.15, 0.25, 0.35];

  for (const t0 of clocks) {
    for (const spot of [0, 0.25, 0.5, 0.75, 1]) {
      for (const dir of [-1, 1] as const) {
        for (const runup of [0, 0.15, 0.3]) {
          for (const hold of [1, 0.12]) {
            for (const dashAt of dashes) {
              for (const steer of [9, 0.2, 0.35]) {
                const game = quietGame(floor);
                game.worldTime = t0;
                game.weight = weight;
                game.placeOn(from, ledgeX(a, t0) + 1 + spot * (a.w - 2));

                let jumped = false;
                for (let i = 0; i < 200; i++) {
                  const t = i * STEP;
                  const sinceJump = t - runup;
                  game.step(STEP, {
                    move: sinceJump < steer ? dir : 0,
                    jump: sinceJump >= 0 && sinceJump < hold,
                    dash: dashAt >= 0 && sinceJump >= dashAt && sinceJump < dashAt + 0.05,
                  });
                  const ground = game.player.ground;
                  if (ground < 0) jumped = true;
                  else if (jumped) {
                    if (ground === to) return true;
                    break;
                  } else if (ground !== from) break;
                }
              }
            }
          }
        }
      }
    }
  }
  return false;
}

/** The apex of a full jump from the ground floor at the given weight. */
export function jumpApex(weight: number): number {
  const game = quietGame();
  game.weight = weight;
  let apex = 0;
  for (let i = 0; i < 240; i++) {
    game.step(STEP, { move: 0, jump: true, dash: false });
    apex = Math.max(apex, game.player.y);
  }
  return apex;
}

export { PARAMS };

/** An independent copy of a game mid-run, so a plan can be tried and thrown away. */
export function cloneGame(game: Game): Game {
  return Object.assign(Object.create(Object.getPrototypeOf(game)), structuredClone({ ...game })) as Game;
}

/**
 * Plays one step of the route with the hazards on, the way a careful player
 * would: wait for the moment, walk, maybe dash, jump. Returns the game after
 * the landing, or null when no timing in the grid gets there alive.
 */
export function climbTo(start: Game, to: number): Game | null {
  const target = start.floor.ledges[to];
  if (!target) return null;
  const from = start.player.ground;
  const deaths = start.deaths;

  for (let wait = 0; wait <= 6; wait += 0.2) {
    const waited = cloneGame(start);
    run(waited, wait);
    if (waited.deaths !== deaths || waited.player.ground !== from) continue;
    const dir = ledgeX(target, waited.worldTime) + target.w / 2 < waited.player.x ? -1 : 1;

    for (let jumpAt = 0; jumpAt <= 1.6; jumpAt += 0.1) {
      for (const dashAt of [-1, jumpAt + 0.1, jumpAt + 0.25, 0, 0.3, 0.6]) {
        if (dashAt >= 0 && dashAt < jumpAt && dashAt + 0.2 > jumpAt) continue;
        for (const hold of [1, 0.12]) {
          for (const steer of [9, 0.25]) {
            const game = cloneGame(waited);
            let jumped = false;
            for (let i = 0; i < 400; i++) {
              const t = i * STEP;
              game.step(STEP, {
                move: t - jumpAt < steer ? dir : 0,
                jump: t >= jumpAt && t < jumpAt + hold,
                dash: dashAt >= 0 && t >= dashAt && t < dashAt + 0.05,
              });
              if (game.deaths !== deaths) break;
              const ground = game.player.ground;
              if (ground < 0) {
                if (t >= jumpAt) jumped = true;
                else break;
              } else if (jumped) {
                if (ground !== to) break;
                // Standing where it landed must not be a trap.
                run(game, 0.4);
                if (game.deaths === deaths && (game.player.ground === to || game.phase === 'won')) return game;
                break;
              }
            }
          }
        }
      }
    }
  }
  return null;
}
