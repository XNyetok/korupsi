/**
 * The numbers in one place. Everything that a designer would want to move
 * lives here, not inside the simulation. Colours are in view/palette.ts.
 *
 * Distances are world pixels: the tower is WORLD_WIDTH wide on every screen
 * and the renderer scales it, so every device plays the same geometry.
 */

export const PARAMS = {
  // running
  runSpeed: 96,
  groundAccel: 1400,
  groundBrake: 1800,
  airAccel: 900,

  // jumping
  /** About 51 px of rise at zero weight: one ledge up, never two. */
  jumpV: 320,
  gravity: 1000,
  /** Falling is heavier than rising, so a jump lands sooner than it took off. */
  fallGravity: 1300,
  maxFall: 340,
  /** Letting go of the button early keeps this much of the upward speed. */
  jumpCut: 0.5,
  /** Seconds after walking off a ledge in which a jump still counts. */
  coyote: 0.1,
  /** Seconds a jump pressed too early waits for the landing. */
  jumpBuffer: 0.12,

  // ngeles: a short horizontal burst that slips past an auditor
  dashSpeed: 220,
  dashTime: 0.14,
  dashCooldown: 0.3,

  // weight
  /** Each envelope takes this much off the jump velocity. */
  weightPenalty: 0.02,
  /** The floor is built to be finished at this factor: see tests/tower.test.ts. */
  minFactor: 0.8,

  // things
  crumbleDelay: 0.5,
  crumbleReturn: 2.5,
  /** How long the player stays caught before going back to the checkpoint. */
  caughtPause: 0.9,
  /** Falling this far below the last checkpoint lands in the audit team's arms. */
  auditLine: 80,
  moneyValue: 500_000,

  // score
  pixelsPerMetre: 12,
};

export type Params = typeof PARAMS;

export const WORLD_WIDTH = 384;

/** Rows of the tower a screen may show: 16:9 at the least, taller on a taller screen. */
export const VIEW = { minHeight: 216, maxHeight: 320 } as const;

/** The player's box: `half` each side of x, `height` up from the feet. */
export const PLAYER = { half: 5, height: 24 } as const;

/** How far the centre may hang past a ledge's end before the player drops. */
export const OVERHANG = 3;
