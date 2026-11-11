/**
 * Composition root: builds the game and connects it to the page. The pieces
 * live in core/ (the simulation, no DOM), platform/ (browser APIs), view/
 * (the canvas) and ui/ (the DOM around it).
 */

import './ui/style.css';
import { Game } from './core/game.ts';
import type { GameEvent } from './core/types.ts';
import { PARAMS } from './core/params.ts';
import { audio } from './platform/audio.ts';
import { type Action, bindInput, guardGestures, Pad } from './platform/input.ts';
import { startLoop } from './platform/loop.ts';
import { bestStore } from './platform/storage.ts';
import { track, trackErrors } from './platform/telemetry.ts';
import { applyView } from './platform/viewport.ts';
import { mountDebug } from './ui/debug.ts';
import { Ui } from './ui/ui.ts';
import { Renderer } from './view/renderer.ts';

function need<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node as T;
}

const canvas = need<HTMLCanvasElement>('game');
const screen = need<HTMLDivElement>('screen');
const stage = need<HTMLDivElement>('stage');
const touchPad = need<HTMLDivElement>('pad');

const foundContext = canvas.getContext('2d');
if (!foundContext) throw new Error('canvas 2d context unavailable');
const ctx: CanvasRenderingContext2D = foundContext;

/** Long enough that the press which won the floor does not also restart it. */
const RESULT_LOCK_MS = 700;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const game = new Game({ store: bestStore });
const pad = new Pad();
const renderer = new Renderer(ctx, game, reducedMotion);

/** True from the start of a run until its result has been reported. */
let runOpen = false;

function reportRun(cause: 'finished' | 'abandoned'): void {
  if (!runOpen) return;
  runOpen = false;
  track('run_ended', {
    cause,
    money: game.money,
    weight: game.weight,
    height: game.heightMetres,
    duration: Math.round(game.time),
  });
}

function start(): void {
  audio.unlock();
  audio.play('start');
  audio.startMusic();
  pad.clear();
  game.start();
  renderer.snap(game);
  ui.hideOverlay();
  runOpen = true;
  track('run_started');
}

function restart(): void {
  reportRun('abandoned');
  game.reset();
  start();
}

function pause(): void {
  if (game.phase !== 'playing') return;
  game.pause();
  pad.clear();
  audio.pauseMusic();
  audio.play('click');
  ui.showPaused(game);
}

function resume(): void {
  if (game.phase !== 'paused') return;
  pad.clear();
  game.resume();
  audio.play('click');
  audio.resumeMusic();
  ui.hideOverlay();
  loop.resync();
}

const ui = new Ui({ start, resume, restart, pause });

// ---------- screen ----------

/** Touch controls show on a phone or tablet, and on anything the first time it is touched. */
let touch = window.matchMedia('(pointer: coarse)').matches;

function resize(): void {
  document.body.classList.toggle('is-touch', touch);
  const view = applyView(canvas, screen, stage, touch, touchPad);
  renderer.resize(view.viewW, view.viewH, view.deck);
  renderer.snap(game);
}

window.addEventListener('resize', resize);
window.addEventListener(
  'touchstart',
  () => {
    if (touch) return;
    touch = true;
    resize();
  },
  { passive: true },
);

// ---------- input ----------

bindInput(
  pad,
  { pad: touchPad, jump: need('btn-jump'), dash: need('btn-dash') },
  {
    gesture: () => audio.unlock(),
    press(action: Action) {
      if (action === 'pause') {
        if (game.phase === 'playing') pause();
        else if (game.phase === 'paused') resume();
      } else if ((action === 'confirm' || action === 'jump') && game.phase !== 'playing') {
        ui.confirm();
      }
    },
  },
);

canvas.addEventListener('contextmenu', (event) => event.preventDefault());
guardGestures(document);

// Safari only starts audio from a gesture, and devices disagree about which
// events count. Any of these is enough; unlock() is cheap once running.
for (const type of ['pointerdown', 'touchend', 'click', 'keydown'] as const) {
  window.addEventListener(type, () => audio.unlock(), { capture: true, passive: true });
}

// ---------- loop ----------

const debug = mountDebug(game);

resize();
renderer.snap(game);
ui.showTitle();

/** How loud something at x, y is to the player: full when close, silent a screen away. */
function nearness(x: number, y: number): number {
  const distance = Math.hypot(x - game.player.x, y - game.player.y);
  return Math.max(0, Math.min(1, 1 - (distance - 90) / 210));
}

function sound(event: GameEvent): void {
  switch (event.type) {
    case 'caught':
      audio.duckMusic(1.2);
      audio.play(event.cause === 'stempel' ? 'rejected' : 'caught');
      break;
    case 'warn':
    case 'stamp':
    case 'crumble':
      // The whole floor is simulated; only what is near is heard.
      audio.play(event.type, nearness(event.x, event.y));
      break;
    case 'win':
      audio.pauseMusic();
      audio.play('win');
      break;
    default:
      audio.play(event.type);
  }
}

/** Pixels run since the last footstep was heard. */
let sinceStep = 0;
const STRIDE = 20;

const loop = startLoop({
  running: () => game.phase === 'playing',
  step(dt) {
    game.step(dt, pad.read());

    const p = game.player;
    if (p.ground >= 0 && game.caught <= 0 && p.dashT <= 0 && Math.abs(p.vx) > 40) {
      sinceStep += Math.abs(p.vx) * dt;
      if (sinceStep >= STRIDE) {
        sinceStep = 0;
        audio.play('step');
      }
    } else {
      // The first step after standing still or landing comes quickly.
      sinceStep = STRIDE * 0.7;
    }
  },
  draw(dt) {
    const events = game.drain();
    for (const event of events) {
      sound(event);
      if (event.type === 'win') {
        ui.update(game);
        ui.showResult(game, RESULT_LOCK_MS);
        reportRun('finished');
      }
    }
    renderer.handle(events);
    renderer.draw(game, dt);
    ui.update(game);
    if (debug) {
      debug.tick();
      (window as unknown as { __view: Renderer['frame'] }).__view = renderer.frame;
    }
  },
});

// ---------- leaving and coming back ----------

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pause();
    audio.suspend();
    return;
  }
  // The pause card is up; nothing moves until the player says so.
  loop.resync();
});

window.addEventListener('pagehide', () => {
  audio.suspend();
  // A run left behind still says how far it got.
  if (game.phase === 'playing' || game.phase === 'paused') reportRun('abandoned');
});
window.addEventListener('pageshow', () => loop.resetClock());

trackErrors();
track('visit');

// The first version of the game installed a service worker that cached the
// build. Remove any registration and cache it left behind, so every visit
// loads the live build. public/sw.js does the same for browsers that never
// run this script.
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
