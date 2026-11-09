/**
 * The rules of a run: what weight costs, what catches the player, what ends
 * the run, and what counts as a record.
 */

import { PARAMS } from './params.ts';
import type { Auditor, Best, Cause, Player } from './types.ts';

/** Away longer than this and the run is over: the audit does not wait. */
export const AWAY_LIMIT_MS = 60_000;

/** Half the width in which an auditor touching the player catches them. */
export const AUDITOR_REACH = 24;

/** How far below the last ledge a player must be for an ending to count as a fall. */
const FALL_DEPTH = 180;

export const rupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

/** Every envelope shortens the jump, down to a floor that still clears a gap. */
export function jumpFactor(weight: number): number {
  return Math.max(PARAMS.minFactor, 1 - PARAMS.weightPenalty * weight);
}

export function auditorCatches(a: Auditor, p: Player): boolean {
  return Math.abs(a.x - p.x) < (a.w + 18) / 2 && p.y - 30 < a.y + a.h / 2 && p.y > a.y - a.h / 2;
}

/**
 * Why a run ended once the feet crossed the audit line. Well below the last
 * ledge means a missed jump; otherwise the audit simply caught up with a
 * player who could not climb fast enough.
 */
export function bandCause(p: Player, lastFooting: number): Cause {
  return !p.onGround && p.y > lastFooting + FALL_DEPTH ? 'fall' : 'band';
}

/** More money wins; the same money and more height also wins. */
export function beatsBest(best: Best, money: number, height: number): boolean {
  return money > best.money || (money === best.money && height > best.height);
}
