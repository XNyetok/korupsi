import './style.css';
import { audio } from './audio.ts';
import { PARAMS } from './config.ts';
import { mountDebug } from './debug.ts';
import { Game } from './game.ts';
import { draw } from './render.ts';
import { track, trackErrors } from './telemetry.ts';
import { Ui } from './ui.ts';

const found = document.getElementById('game');
if (!(found instanceof HTMLCanvasElement)) throw new Error('missing canvas');
const canvas: HTMLCanvasElement = found;

const foundContext = canvas.getContext('2d');
if (!foundContext) throw new Error('canvas 2d context unavailable');
const ctx: CanvasRenderingContext2D = foundContext;

const ui = new Ui();
let runStartedAt = 0;

const game = new Game({
  onEnd() {
    ui.showResult(game);
    audio.play('caught');
    track('run_ended', {
      cause: game.cause,
      money: game.money,
      weight: game.weight,
      height: game.heightMetres,
      duration: runStartedAt ? Math.round((performance.now() - runStartedAt) / 1000) : 0,
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
});

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let width = 360;
let height = 640;

function resize(): void {
  const rect = canvas.getBoundingClientRect();
  width = Math.max(260, Math.round(rect.width));
  height = Math.max(320, Math.round(rect.height));

  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  game.setViewport(width, height);
}

// ---------- input ----------

function tap(clientX: number): void {
  // A tap that wakes the phone should not turn into a jump.
  if (performance.now() < ignoreTapUntil) return;

  if (game.phase !== 'playing') {
    audio.unlock();
    audio.play('start');
    game.start();
    ui.hideOverlay();
    runStartedAt = performance.now();
    track('run_started');
    return;
  }
  const rect = canvas.getBoundingClientRect();
  game.jump(clientX < rect.left + rect.width / 2 ? -1 : 1);
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  audio.unlock();
  tap(event.clientX);
});

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;

  if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
    audio.unlock();
    if (game.phase === 'playing') game.jump(-1);
    else tap(width * 0.25);
    event.preventDefault();
  } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
    audio.unlock();
    if (game.phase === 'playing') game.jump(1);
    else tap(width * 0.75);
    event.preventDefault();
  } else if (event.key === ' ' || event.key === 'Enter') {
    audio.unlock();
    tap(width / 2 + game.player.dir);
    event.preventDefault();
  }
});

// Safari only starts audio from a gesture, and devices disagree about which
// events count. Any of these is enough; unlock() is cheap once running.
for (const type of ['pointerdown', 'touchend', 'click', 'keydown'] as const) {
  window.addEventListener(type, () => audio.unlock(), { capture: true, passive: true });
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  resize();
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (game.phase !== 'playing') {
      game.reset();
      draw(ctx, game, reducedMotion);
    }
  }, 120);
});

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

  draw(ctx, game, reducedMotion);
  ui.update(game);
  debug?.tick();
  requestAnimationFrame(frame);
}

let hiddenAt = 0;
let ignoreTapUntil = 0;

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = performance.now();
    audio.suspend();
    return;
  }

  const awayMs = hiddenAt ? performance.now() - hiddenAt : 0;
  hiddenAt = 0;
  lastFrame = performance.now();
  acc = 0;

  if (game.phase === 'playing') {
    ignoreTapUntil = performance.now() + 350;
    game.handleAway(awayMs);
  }
});

window.addEventListener('pagehide', () => audio.suspend());
window.addEventListener('pageshow', () => {
  lastFrame = performance.now();
});

resize();
game.reset();
ui.showReady();
requestAnimationFrame(frame);

trackErrors();
track('visit');
window.addEventListener('appinstalled', () => track('installed'));

// Offline play: the shell and the hashed assets are cached by the worker.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}

// Keep the parameter object reachable from the console during tuning.
if (import.meta.env.DEV) {
  (window as unknown as { params: typeof PARAMS }).params = PARAMS;
}
