/**
 * localStorage, with every failure swallowed: private mode, a full disk or a
 * blocked origin must never stop the game.
 */

import type { BestStore } from '../core/game.ts';
import type { Best } from '../core/types.ts';

const BEST_KEY = 'korupsi.best';

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
      if (!raw) return { money: 0, height: 0 };
      const parsed = JSON.parse(raw) as Partial<Best>;
      return { money: Number(parsed.money) || 0, height: Number(parsed.height) || 0 };
    } catch {
      return { money: 0, height: 0 };
    }
  },
  write(best: Best): void {
    writeItem(BEST_KEY, JSON.stringify(best));
  },
};
