import type { Phase } from '../core/types.ts';

export type Dir = -1 | 1;

export interface ControlTarget {
  readonly phase: Phase;
  readonly player: { readonly dir: number };
  jump(dir: number): void;
}

export interface ControlHooks {
  /** Begin a new run from the ready or result screen. */
  start(): void;
  /** Continue a paused run. */
  resume(): void;
}

/**
 * Turns presses into game actions. No DOM in this class: `bindInput` below
 * maps pointer and keyboard events to `press`, `repeat` and `pointer`, so the
 * rules about what a press means can be tested without a browser.
 */
export class Controls {
  private readonly target: ControlTarget;
  private readonly hooks: ControlHooks;
  private readonly now: () => number;
  private blockedUntil = 0;

  constructor(target: ControlTarget, hooks: ControlHooks, now: () => number = () => performance.now()) {
    this.target = target;
    this.hooks = hooks;
    this.now = now;
  }

  /** Ignore presses for a while: after a death, or a tap that woke the phone. */
  block(ms: number): void {
    this.blockedUntil = Math.max(this.blockedUntil, this.now() + ms);
  }

  press(dir: Dir): void {
    if (this.now() < this.blockedUntil) return;

    if (this.target.phase === 'playing') this.target.jump(dir);
    else if (this.target.phase === 'paused') this.hooks.resume();
    else this.hooks.start();
  }

  /** Space and Enter: the same direction as the last jump. */
  repeat(): void {
    this.press(this.target.player.dir < 0 ? -1 : 1);
  }

  /** A tap or click, in the coordinates of the element it landed on. */
  pointer(clientX: number, left: number, width: number): void {
    this.press(clientX < left + width / 2 ? -1 : 1);
  }
}

export type KeyAction = 'left' | 'right' | 'repeat';

export function keyAction(key: string): KeyAction | null {
  switch (key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return 'left';
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'right';
    case ' ':
    case 'Enter':
      return 'repeat';
    default:
      return null;
  }
}

export interface InputHooks {
  /** Called on every press, before it is handled: audio may only start from a gesture. */
  gesture(): void;
}

/** Wires the canvas and the keyboard to the controls. */
export function bindInput(canvas: HTMLCanvasElement, controls: Controls, hooks: InputHooks): void {
  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    hooks.gesture();
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
    hooks.gesture();
    if (action === 'left') controls.press(-1);
    else if (action === 'right') controls.press(1);
    else controls.repeat();
  });
}
