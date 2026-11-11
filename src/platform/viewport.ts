/**
 * Fits the tower to the screen. The page scales the canvas up without
 * smoothing; what changes with the screen is how much of the tower it shows.
 *
 * With a mouse and keyboard the tower sits in a window: its full width,
 * scaled by a whole number of device pixels whenever that costs little, so
 * every game pixel is the same size.
 *
 * On a touch screen the game fills the screen instead. The view is then as
 * wide as the screen allows and no wider than the tower: an upright phone
 * shows a tall slice of it and the camera follows the player sideways, a
 * phone on its side shows the full width and fewer rows. The touch controls
 * sit over the bottom of the picture, and the renderer keeps the ground floor
 * above them (`deck`).
 */

import { FILL, VIEW, WORLD_WIDTH } from '../core/params.ts';

export interface View {
  /** Columns and rows of the tower the canvas shows. */
  viewW: number;
  viewH: number;
  /** The size of the canvas on the page, in CSS pixels. */
  cssW: number;
  cssH: number;
  /** CSS pixels per game pixel: the DOM around the canvas is sized from it. */
  unit: number;
  /** True when the canvas covers the whole screen. */
  fill: boolean;
  /** Rows at the bottom of the view that the touch controls cover. */
  deck: number;
}

/** Below this share of the screen, whole-number scaling is not worth it. */
const WHOLE_SCALE_MIN = 0.85;

/**
 * `touch` picks the filled layout; `deckCss` is the height the touch controls
 * take at the bottom of the screen, in CSS pixels.
 */
export function fitView(cssW: number, cssH: number, dpr: number, touch: boolean, deckCss = 0): View {
  const devW = Math.max(1, Math.floor(cssW * dpr));
  const devH = Math.max(1, Math.floor(cssH * dpr));
  return touch ? fillView(devW, devH, dpr, cssW, cssH, deckCss) : windowView(devW, devH, dpr);
}

function windowView(devW: number, devH: number, dpr: number): View {
  const fit = Math.min(devW / WORLD_WIDTH, devH / VIEW.minHeight);
  let scale = Math.floor(fit);
  if (scale < 1 || scale / fit < WHOLE_SCALE_MIN) scale = fit;

  const viewH = Math.max(VIEW.minHeight, Math.min(VIEW.maxHeight, Math.floor(devH / scale)));
  return {
    viewW: WORLD_WIDTH,
    viewH,
    cssW: (WORLD_WIDTH * scale) / dpr,
    cssH: (viewH * scale) / dpr,
    unit: scale / dpr,
    fill: false,
    deck: 0,
  };
}

function fillView(devW: number, devH: number, dpr: number, cssW: number, cssH: number, deckCss: number): View {
  // The scale must be at least `tight`, or the view would be wider than the
  // tower. Above that, zoom in as far as the smallest useful view allows.
  const tight = devW / WORLD_WIDTH;
  const roomy = Math.min(Math.floor(devW / FILL.minWidth), Math.floor(devH / FILL.minHeight));
  let scale = Math.max(Math.ceil(tight), roomy, 1);
  // A long phone on its side loses too many rows to a whole-number scale:
  // follow the screen's width exactly instead.
  if (devH / scale < FILL.minHeight) scale = Math.max(tight, 1);
  // Wider than that and the tower cannot fill the screen; keep the rows.
  if (devH / scale < FILL.minHeight) scale = Math.max(1, devH / FILL.minHeight);

  const viewW = Math.min(WORLD_WIDTH, Math.floor(devW / scale));
  const viewH = Math.min(FILL.maxHeight, Math.floor(devH / scale));
  const unit = scale / dpr;
  // The canvas is stretched over the few device pixels a whole-number scale
  // leaves over, rather than showing them as a hairline bar.
  const stretch = (view: number, css: number) => ((view + 1) * unit > css ? css : view * unit);
  return {
    viewW,
    viewH,
    cssW: stretch(viewW, cssW),
    cssH: stretch(viewH, cssH),
    unit,
    fill: true,
    deck: Math.min(Math.ceil(deckCss / unit), Math.floor(viewH / 2)),
  };
}

/**
 * Sizes the canvas and the box around it to the stage they sit in. `controls`
 * is the touch pad: where it starts is where the deck begins.
 */
export function applyView(
  canvas: HTMLCanvasElement,
  screen: HTMLElement,
  stage: HTMLElement,
  touch: boolean,
  controls: HTMLElement,
): View {
  const box = stage.getBoundingClientRect();
  const deckCss = touch ? Math.max(0, box.bottom - controls.getBoundingClientRect().top + 6) : 0;
  const view = fitView(stage.clientWidth, stage.clientHeight, window.devicePixelRatio || 1, touch, deckCss);
  canvas.width = view.viewW;
  canvas.height = view.viewH;
  screen.style.width = `${view.cssW}px`;
  screen.style.height = `${view.cssH}px`;
  const root = document.documentElement.style;
  root.setProperty('--u', `${view.unit}px`);
  root.setProperty('--deck', `${deckCss}px`);
  document.body.classList.toggle('is-fill', view.fill);
  return view;
}
