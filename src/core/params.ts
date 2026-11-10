/**
 * The numbers in one place. Everything that a designer would want to move
 * lives here, not inside the simulation. Colours are in view/palette.ts.
 */

export const PARAMS = {
  // movement
  gravity: 1900,
  jumpV: 700,
  moveVX: 115,
  weightPenalty: 0.03,
  minFactor: 0.45,

  // level shape
  gapMin: 0.42,
  gapMax: 0.62,
  minLedgeOffset: 58,
  goldChance: 0.45,
  doubleGoldChance: 0,

  // pressure
  // Retuned on 2026-11-10 from real-play telemetry and a reaction-profile
  // sweep: the old values were tuned for a player who never hesitates, and
  // real runs died to the band at a median of 16 s. See the playtest log in
  // docs/design/game-design.md.
  cameraBase: 12,
  cameraAccel: 0.6,
  /** World units of gap at which the one-time band warning fires: about one
   *  full jump of margin, so the death reads as warned, not sudden. */
  bandWarnAt: 150,
  /** Height of the audit band. Its top edge is where the run ends. */
  bandHeight: 40,

  // things
  crumbleDelay: 0.45,
  moneyValue: 500000,

  // score
  pixelsPerMetre: 6,
};

export type Params = typeof PARAMS;

/**
 * The simulation is always this wide, whatever the screen. The renderer scales
 * it to fit, so rotating a phone or resizing a window never moves a ledge out
 * of reach, and every device plays the same level geometry.
 */
export const WORLD_WIDTH = 360;
