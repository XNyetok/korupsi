import './ui/style.css';
import './ui/atrium.css';
import { Atrium, type LiftPhase } from './core/atrium.ts';
import { AtriumSound } from './platform/atrium-sound.ts';
import { bindInput, guardGestures, Pad } from './platform/input.ts';
import { startLoop } from './platform/loop.ts';
import { applyView } from './platform/viewport.ts';
import { ATRIUM_SCENE } from './view/atrium.ts';
import { Renderer } from './view/renderer.ts';

function need<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as T;
}

const canvas = need<HTMLCanvasElement>('game');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('canvas 2d context unavailable');
const stage = need('stage');
const viewport = need('screen');
const zone = need('pad');
const card = need('overlay');
const next = need<HTMLButtonElement>('continue');
const pauseButton = need<HTMLButtonElement>('pause');
const muteButton = need<HTMLButtonElement>('mute');
const liftStatus = need('lift-status');

const game = new Atrium();
const pad = new Pad();
const sound = new AtriumSound();
const renderer = new Renderer(ctx, game, matchMedia('(prefers-reduced-motion: reduce)').matches, ATRIUM_SCENE);

function play(): void {
  if (game.phase === 'paused') game.resume();
  else {
    game.start();
    renderer.snap(game);
  }
  sound.unlock();
  pad.clear();
  loop.resync();
  card.classList.remove('is-visible');
  document.body.classList.add('is-playing');
  canvas.focus({ preventScroll: true });
}

function show(title: string, text: string, button: string): void {
  need('heading').textContent = title;
  need('message').textContent = text;
  next.textContent = button;
  pad.clear();
  document.body.classList.remove('is-playing');
  card.classList.add('is-visible');
  next.focus({ preventScroll: true });
}

function pause(): void {
  if (game.phase !== 'playing') return;
  game.pause();
  sound.update(game.liftPhase, false);
  show('Dijeda', 'Lift dan berkas menunggu.', 'Lanjut');
}

let touch = matchMedia('(pointer: coarse)').matches;
function resize(): void {
  document.body.classList.toggle('is-touch', touch);
  const view = applyView(canvas, viewport, stage, touch, zone);
  renderer.resize(view.viewW, view.viewH, view.deck);
  renderer.snap(game);
}
window.addEventListener('resize', resize);
window.addEventListener(
  'touchstart',
  () => {
    if (!touch) {
      touch = true;
      resize();
    }
  },
  { passive: true },
);

bindInput(
  pad,
  { pad: zone, jump: need('btn-jump'), dash: need('btn-dash') },
  {
    gesture: () => {},
    press(action) {
      if (action === 'pause') {
        if (game.phase === 'paused') play();
        else pause();
      } else if ((action === 'confirm' || action === 'jump') && game.phase !== 'playing') play();
    },
  },
);
guardGestures(document);
next.addEventListener('click', play);
pauseButton.addEventListener('click', pause);
muteButton.addEventListener('click', (event) => {
  sound.mute(!sound.muted);
  muteButton.setAttribute('aria-pressed', String(!sound.muted));
  if (event.detail > 0) muteButton.blur();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});

const LIFT_STATUS: Record<LiftPhase, string> = {
  ready: 'Lift siap',
  rising: 'Lift naik',
  arrived: 'Tiba · lompat ke kanan',
  returning: 'Lift turun',
};
let shown: LiftPhase = 'ready';
const loop = startLoop({
  running: () => game.phase === 'playing',
  step: (dt) => game.step(dt, pad.read()),
  draw(dt) {
    const events = game.drain();
    renderer.handle(events);
    renderer.draw(game, dt);
    sound.update(game.liftPhase, game.phase === 'playing');
    if (shown !== game.liftPhase) {
      shown = game.liftPhase;
      liftStatus.textContent = LIFT_STATUS[shown];
    }
    if (events.some((event) => event.type === 'win')) {
      show('Sampai verifikasi', 'Ini akhir uji coba atrium. Kamu bisa mencoba jalurnya lagi.', 'Coba lagi');
    }
  },
});

resize();
