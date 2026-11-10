/**
 * Composition root: builds the game and connects it to the page. The pieces
 * live in core/ (the simulation, no DOM), platform/ (browser APIs), view/
 * (the canvas) and ui/ (the DOM around it).
 */

import './ui/style.css';
import { Game } from './core/game.ts';
import { PARAMS } from './core/params.ts';
import { parseSeed } from './core/rng.ts';
import { audio } from './platform/audio.ts';
import { bindInput, Controls } from './platform/input.ts';
import { startLoop } from './platform/loop.ts';
import { bestStore } from './platform/storage.ts';
import { track, trackErrors } from './platform/telemetry.ts';
import { fitCanvas } from './platform/viewport.ts';
import { mountDebug } from './ui/debug.ts';
import { Ui } from './ui/ui.ts';
import { draw } from './view/renderer.ts';

const found = document.getElementById('game');
if (!(found instanceof HTMLCanvasElement)) throw new Error('missing canvas');
const canvas: HTMLCanvasElement = found;

const foundContext = canvas.getContext('2d');
if (!foundContext) throw new Error('canvas 2d context unavailable');
const ctx: CanvasRenderingContext2D = foundContext;

const ui = new Ui();

/** Long enough to stop the tap that was meant as a jump from skipping the result. */
const RESULT_LOCK_MS = 700;
/** A tap that wakes the phone should not count. */
const WAKE_LOCK_MS = 350;

// `?seed=` replays one layout on every run: for bug reports and playtests.
const fixedSeed = parseSeed(new URLSearchParams(location.search).get('seed'));

const game = new Game(
  {
    onEnd() {
      controls.block(RESULT_LOCK_MS);
      ui.showResult(game);
      audio.play('caught');
      track('run_ended', {
        cause: game.cause,
        money: game.money,
        weight: game.weight,
        height: game.heightMetres,
        duration: Math.round(game.elapsed),
      });
    },
    onJump() {
      audio.play('jump');
    },
    onLand() {
      audio.play('land');
    },
    onCollect() {
      audio.play('collect');
    },
    onBandWarn() {
      ui.toast('Pita audit menyusul — terus naik');
      track('band_warned');
    },
  },
  { seed: fixedSeed, store: bestStore },
);

const controls = new Controls(game, {
  start() {
    audio.unlock();
    audio.play('start');
    game.start();
    ui.hideOverlay();
    track('run_started');
  },
  resume() {
    game.resume();
    ui.hideOverlay();
  },
});

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Screen pixels per world unit, times the device pixel ratio. */
let pixelScale = 1;

function resize(): void {
  const viewport = fitCanvas(canvas);
  pixelScale = viewport.pixelScale;
  game.setViewport(viewport.worldHeight);
}

// ---------- input ----------

bindInput(canvas, controls, { gesture: () => audio.unlock() });

// Safari only starts audio from a gesture, and devices disagree about which
// events count. Any of these is enough; unlock() is cheap once running.
for (const type of ['pointerdown', 'touchend', 'click', 'keydown'] as const) {
  window.addEventListener(type, () => audio.unlock(), { capture: true, passive: true });
}

window.addEventListener('resize', resize);

// ---------- loop ----------

const debug = mountDebug(game);

resize();
game.reset();
ui.showReady(fixedSeed);

const loop = startLoop({
  running: () => game.phase === 'playing',
  step: (dt) => game.step(dt),
  draw() {
    ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
    draw(ctx, game, reducedMotion);
    ui.update(game);
    debug?.tick();
  },
});

// ---------- leaving and coming back ----------

let hiddenAt = 0;

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = performance.now();
    game.pause();
    audio.suspend();
    return;
  }

  const awayMs = hiddenAt ? performance.now() - hiddenAt : 0;
  hiddenAt = 0;
  loop.resync();

  // Coming back never drops the player straight into a moving band: a short
  // absence waits on a pause card, a long one has already ended the run.
  game.handleAway(awayMs);
  if (game.phase === 'paused') {
    controls.block(WAKE_LOCK_MS);
    ui.showPaused(game);
  }
});

window.addEventListener('pagehide', () => audio.suspend());
window.addEventListener('pageshow', () => loop.resetClock());

trackErrors();
track('visit');

// The game used to install a service worker that cached the build. Remove any
// registration and cache it left behind, so every visit loads the live build.
// public/sw.js does the same for browsers that never run this script.
if ('serviceWorker' in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
    .catch(() => {});
}
if ('caches' in window) {
  void caches
    .keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('korupsi-')).map((k) => caches.delete(k))))
    .catch(() => {});
}

// Keep the parameter object reachable from the console during tuning.
if (import.meta.env.DEV) {
  (window as unknown as { params: typeof PARAMS }).params = PARAMS;
}
