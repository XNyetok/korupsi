import './style.css';
import { audio } from './audio.ts';
import { PARAMS, WORLD_WIDTH } from './config.ts';
import { mountDebug } from './debug.ts';
import { Game } from './game.ts';
import { Controls, keyAction } from './input.ts';
import { draw } from './render.ts';
import { parseSeed } from './rng.ts';
import { track, trackErrors } from './telemetry.ts';
import { Ui } from './ui.ts';

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

const game = new Game({
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
}, { seed: fixedSeed });

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
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(260, Math.round(rect.width));
  const cssHeight = Math.max(320, Math.round(rect.height));

  // The world is always WORLD_WIDTH wide; only how much of it is visible
  // vertically depends on the screen.
  const scale = cssWidth / WORLD_WIDTH;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  pixelScale = scale * dpr;

  game.setViewport(cssHeight / scale);
}

// ---------- input ----------

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  audio.unlock();
  const rect = canvas.getBoundingClientRect();
  controls.pointer(event.clientX, rect.left, rect.width);
});

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('keydown', (event) => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;

  // Enter and Space on a button belong to the button, not to the game.
  const target = event.target;
  if (target instanceof Element && target.closest('button, a, input, select, textarea')) return;

  const action = keyAction(event.key);
  if (!action) return;

  event.preventDefault();
  audio.unlock();
  if (action === 'left') controls.press(-1);
  else if (action === 'right') controls.press(1);
  else controls.repeat();
});

// Safari only starts audio from a gesture, and devices disagree about which
// events count. Any of these is enough; unlock() is cheap once running.
for (const type of ['pointerdown', 'touchend', 'click', 'keydown'] as const) {
  window.addEventListener(type, () => audio.unlock(), { capture: true, passive: true });
}

window.addEventListener('resize', resize);

// ---------- loop ----------

let lastFrame = performance.now();
let acc = 0;
const STEP = 1 / 120;

const debug = mountDebug(game);

function frame(now: number): void {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  if (game.phase === 'playing') {
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 8) {
      game.step(STEP);
      acc -= STEP;
      if (game.phase !== 'playing') break;
    }
  } else {
    acc = 0;
  }

  ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
  draw(ctx, game, reducedMotion);
  ui.update(game);
  debug?.tick();
  requestAnimationFrame(frame);
}

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
  lastFrame = performance.now();
  acc = 0;

  // Coming back never drops the player straight into a moving band: a short
  // absence waits on a pause card, a long one has already ended the run.
  game.handleAway(awayMs);
  if (game.phase === 'paused') {
    controls.block(WAKE_LOCK_MS);
    ui.showPaused(game);
  }
});

window.addEventListener('pagehide', () => audio.suspend());
window.addEventListener('pageshow', () => {
  lastFrame = performance.now();
});

resize();
game.reset();
ui.showReady(fixedSeed);
requestAnimationFrame(frame);

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
