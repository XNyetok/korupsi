/**
 * Fits the fixed-width world to the canvas. The world is always WORLD_WIDTH
 * wide; only how much of it is visible vertically depends on the screen.
 */

import { WORLD_WIDTH } from '../core/params.ts';

export interface Viewport {
  /** Screen pixels per world unit, times the device pixel ratio. */
  pixelScale: number;
  /** The visible height in world units. */
  worldHeight: number;
}

export function fitCanvas(canvas: HTMLCanvasElement): Viewport {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(260, Math.round(rect.width));
  const cssHeight = Math.max(320, Math.round(rect.height));

  const scale = cssWidth / WORLD_WIDTH;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);

  return { pixelScale: scale * dpr, worldHeight: cssHeight / scale };
}
