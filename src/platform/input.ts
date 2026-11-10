/**
 * Keyboard and touch, reduced to what the simulation asks each step: which way
 * the player is pushing, and whether jump and dash are held.
 */

import type { Input } from '../core/types.ts';

export type PadAction = 'left' | 'right' | 'jump' | 'dash';
export type MenuAction = 'pause' | 'confirm';
export type Action = PadAction | MenuAction;

/** What a key means, or null when the game does not use it. */
export function keyAction(key: string): Action | null {
  switch (key.length === 1 ? key.toLowerCase() : key) {
    case 'ArrowLeft':
    case 'a':
      return 'left';
    case 'ArrowRight':
    case 'd':
      return 'right';
    case ' ':
    case 'ArrowUp':
    case 'w':
    case 'z':
      return 'jump';
    case 'Shift':
    case 'x':
    case 'k':
      return 'dash';
    case 'Escape':
    case 'p':
      return 'pause';
    case 'Enter':
      return 'confirm';
    default:
      return null;
  }
}

/**
 * What is held down right now. No DOM in this class: `bindInput` below feeds
 * it, so the rules can be tested without a browser. Each press names its
 * source (a key, a touch button), so two keys for one action do not cancel
 * each other when one of them is released.
 */
export class Pad {
  private held = new Map<string, PadAction>();
  /** Sources the simulation has already read at least once since they were pressed. */
  private seen = new Set<string>();
  /** Sources released before the simulation saw them: kept for one read. */
  private dropped = new Set<string>();
  /** When both directions are held, the one pressed last wins. */
  private latest: 'left' | 'right' = 'right';

  press(source: string, action: PadAction): void {
    this.held.set(source, action);
    this.seen.delete(source);
    this.dropped.delete(source);
    if (action === 'left' || action === 'right') this.latest = action;
  }

  /**
   * A tap can begin and end between two steps of the simulation. Such a press
   * is kept until it has been read once, so the quickest tap still jumps.
   */
  release(source: string): void {
    if (!this.held.has(source)) return;
    if (this.seen.has(source)) this.held.delete(source);
    else this.dropped.add(source);
  }

  /** Let go of everything: the page lost focus, or a card came up. */
  clear(): void {
    this.held.clear();
    this.seen.clear();
    this.dropped.clear();
  }

  private has(action: PadAction): boolean {
    for (const value of this.held.values()) if (value === action) return true;
    return false;
  }

  read(): Input {
    const left = this.has('left');
    const right = this.has('right');
    const move = left && right ? (this.latest === 'left' ? -1 : 1) : left ? -1 : right ? 1 : 0;
    const input: Input = { move, jump: this.has('jump'), dash: this.has('dash') };

    for (const source of this.held.keys()) this.seen.add(source);
    for (const source of this.dropped) {
      this.held.delete(source);
      this.seen.delete(source);
    }
    this.dropped.clear();
    return input;
  }
}

export interface InputHooks {
  /** Called on every press, before it is handled: audio may only start from a gesture. */
  gesture(): void;
  /** A fresh press (not a key repeat) of any action, from a key or a touch button. */
  press(action: Action): void;
}

export interface TouchControls {
  /** The left-right zone: its left half pushes left, its right half right. */
  pad: HTMLElement;
  jump: HTMLElement;
  dash: HTMLElement;
}

/** Wires the keyboard and the touch controls to the pad. */
export function bindInput(pad: Pad, touch: TouchControls, hooks: InputHooks): void {
  window.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    // Enter and Space on a button belong to the button, not to the game.
    const target = event.target;
    if (target instanceof Element && target.closest('button, a, input, select, textarea')) return;

    const action = keyAction(event.key);
    if (!action) return;
    event.preventDefault();
    if (event.repeat) return;

    hooks.gesture();
    if (action !== 'pause' && action !== 'confirm') pad.press('key:' + event.key.toLowerCase(), action);
    hooks.press(action);
  });

  window.addEventListener('keyup', (event) => {
    pad.release('key:' + event.key.toLowerCase());
  });

  // A key released while the window is elsewhere never sends its keyup.
  window.addEventListener('blur', () => pad.clear());

  // Capturing keeps a thumb that slides off a control from losing it. It can
  // be refused (the pointer is already gone), and the control must still work.
  const capture = (el: HTMLElement, id: number) => {
    try {
      el.setPointerCapture(id);
    } catch {
      /* not capturable: the control still tracks the pointer by its id */
    }
  };

  let steering: number | null = null;
  const steer = (event: PointerEvent) => {
    const box = touch.pad.getBoundingClientRect();
    const action: PadAction = event.clientX < box.left + box.width / 2 ? 'left' : 'right';
    pad.press('touch:move', action);
    touch.pad.dataset.dir = action;
  };

  touch.pad.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    steering = event.pointerId;
    capture(touch.pad, event.pointerId);
    hooks.gesture();
    steer(event);
  });
  touch.pad.addEventListener('pointermove', (event) => {
    if (event.pointerId === steering) steer(event);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    touch.pad.addEventListener(type, (event) => {
      if (event.pointerId !== steering) return;
      steering = null;
      pad.release('touch:move');
      delete touch.pad.dataset.dir;
    });
  }

  const button = (el: HTMLElement, action: PadAction) => {
    el.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      capture(el, event.pointerId);
      el.classList.add('is-down');
      hooks.gesture();
      pad.press('touch:' + action, action);
      hooks.press(action);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      el.addEventListener(type, () => {
        el.classList.remove('is-down');
        pad.release('touch:' + action);
      });
    }
    el.addEventListener('contextmenu', (event) => event.preventDefault());
  };
  button(touch.jump, 'jump');
  button(touch.dash, 'dash');
  touch.pad.addEventListener('contextmenu', (event) => event.preventDefault());
}
