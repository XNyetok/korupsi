import type { Phase } from './config.ts';

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
 * Turns presses into game actions. No DOM in here: the page maps pointer and
 * keyboard events to `press`, `repeat` and `pointer`, so the rules about what
 * a press means can be tested without a browser.
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
