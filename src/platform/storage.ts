/**
 * localStorage, with every failure swallowed: private mode, a full disk or a
 * blocked origin must never stop the game.
 */

import type { Best, BestStore } from '../core/types.ts';

/** The first game kept its record under `korupsi.best`, in another shape; that key is left alone. */
const BEST_KEY = 'korupsi.kelurahan.best';

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

export const bestStore: BestStore = {
  read(): Best {
    try {
      const raw = readItem(BEST_KEY);
      if (!raw) return { time: 0, money: 0 };
      const parsed = JSON.parse(raw) as Partial<Best>;
      return { time: Number(parsed.time) || 0, money: Number(parsed.money) || 0 };
    } catch {
      return { time: 0, money: 0 };
    }
  },
  write(best: Best): void {
    writeItem(BEST_KEY, JSON.stringify(best));
  },
};
