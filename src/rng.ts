/**
 * Seeded randomness for the simulation. A run is fully decided by its seed and
 * the player's choices, so a bug report that names the seed can be replayed.
 *
 * Seeds are unsigned 32-bit integers, written in base 36 (at most 7
 * characters) wherever a person sees or types them.
 */

/** A source of numbers in [0, 1). */
export type Rng = () => number;

/** mulberry32: small, fast, and good enough for level generation. */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh seed for a run nobody asked to replay. */
export function randomSeed(): number {
  const crypto = globalThis.crypto;
  if (crypto?.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

export function formatSeed(seed: number): string {
  return (seed >>> 0).toString(36);
}

/** The seed in `?seed=`, or null when it is missing or not a valid seed. */
export function parseSeed(text: string | null | undefined): number | null {
  if (!text) return null;
  const clean = text.trim().toLowerCase();
  if (!/^[0-9a-z]{1,7}$/.test(clean)) return null;
  const value = parseInt(clean, 36);
  return value <= 0xffffffff ? value : null;
}
