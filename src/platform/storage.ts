/**
 * localStorage, with every failure swallowed: private mode, a full disk or a
 * blocked origin must never stop the game.
 */

import type { Best, BestStore } from '../core/types.ts';

export function readItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode, ignore */
  }
}

function nonnegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/** Kelurahan keeps its existing key. The old one-tap game's `korupsi.best` is separate. */
export function bestStore(floorId: string): BestStore {
  const key = `korupsi.${floorId}.best`;
  return {
    read(): Best {
      try {
        const raw = readItem(key);
        if (!raw) return { time: 0, money: 0 };
        const parsed = JSON.parse(raw) as Partial<Best>;
        return { time: nonnegative(parsed.time), money: nonnegative(parsed.money) };
      } catch {
        return { time: 0, money: 0 };
      }
    },
    write(best: Best): void {
      writeItem(key, JSON.stringify(best));
    },
  };
}
