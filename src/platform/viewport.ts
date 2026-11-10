/**
 * Fits the tower to the screen. The canvas is always WORLD_WIDTH pixels wide
 * and is scaled up by the page without smoothing; only how much of the tower
 * shows vertically depends on the screen.
 *
 * The scale is a whole number of device pixels whenever that costs little,
 * so every game pixel is the same size. A narrow phone held upright would
 * waste a third of its width that way, so there the scale follows the screen.
 */

import { VIEW, WORLD_WIDTH } from '../core/params.ts';

export interface View {
  /** Rows of the tower the canvas shows. */
  viewH: number;
  /** The size of the canvas on the page, in CSS pixels. */
  cssW: number;
  cssH: number;
  /** CSS pixels per game pixel: the DOM around the canvas is sized from it. */
  unit: number;
  portrait: boolean;
}

/** CSS pixels kept free under the canvas for the touch controls, on an upright phone. */
const CONTROLS_RESERVE = 190;
/** Below this share of the screen, whole-number scaling is not worth it. */
const WHOLE_SCALE_MIN = 0.85;

export function fitView(cssW: number, cssH: number, dpr: number, touch: boolean): View {
  const portrait = cssH > cssW * 1.15;
  const reserve = portrait && touch ? CONTROLS_RESERVE : 0;
  const devW = Math.max(1, Math.floor(cssW * dpr));
  const devH = Math.max(1, Math.floor(Math.max(120, cssH - reserve) * dpr));

  const fit = Math.min(devW / WORLD_WIDTH, devH / VIEW.minHeight);
  let scale = Math.floor(fit);
  if (scale < 1 || scale / fit < WHOLE_SCALE_MIN) scale = fit;

  const viewH = Math.max(VIEW.minHeight, Math.min(VIEW.maxHeight, Math.floor(devH / scale)));
  return {
    viewH,
    cssW: (WORLD_WIDTH * scale) / dpr,
    cssH: (viewH * scale) / dpr,
    unit: scale / dpr,
    portrait,
  };
}

/** Sizes the canvas and the box around it to the stage they sit in. */
export function applyView(canvas: HTMLCanvasElement, screen: HTMLElement, stage: HTMLElement, touch: boolean): View {
  const view = fitView(stage.clientWidth, stage.clientHeight, window.devicePixelRatio || 1, touch);
  canvas.width = WORLD_WIDTH;
  canvas.height = view.viewH;
  screen.style.width = `${view.cssW}px`;
  screen.style.height = `${view.cssH}px`;
  document.documentElement.style.setProperty('--u', `${view.unit}px`);
  document.body.classList.toggle('is-portrait', view.portrait);
  return view;
}
