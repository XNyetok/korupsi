/**
 * The frame loop. The simulation advances in fixed steps, so a run plays the
 * same at 60 Hz and 120 Hz; drawing happens once per frame.
 */

export const STEP = 1 / 120;
/** A long frame (a stall, a breakpoint) is cut to this, so nothing jumps through a ledge. */
const MAX_FRAME = 0.05;
/** At most this many steps per frame, so a slow device falls behind instead of freezing. */
const MAX_STEPS = 8;

export interface LoopTarget {
  /** True while the simulation should advance. */
  running(): boolean;
  step(dt: number): void;
  draw(): void;
}

export interface Loop {
  /** Forget the time that passed and any partial step: when the page comes back. */
  resync(): void;
  /** Forget the time that passed, keep the partial step: after the page is restored. */
  resetClock(): void;
}

export function startLoop(target: LoopTarget): Loop {
  let lastFrame = performance.now();
  let acc = 0;

  function frame(now: number): void {
    const dt = Math.min(MAX_FRAME, (now - lastFrame) / 1000);
    lastFrame = now;

    if (target.running()) {
      acc += dt;
      let guard = 0;
      while (acc >= STEP && guard++ < MAX_STEPS) {
        target.step(STEP);
        acc -= STEP;
        if (!target.running()) break;
      }
    } else {
      acc = 0;
    }

    target.draw();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  return {
    resync() {
      lastFrame = performance.now();
      acc = 0;
    },
    resetClock() {
      lastFrame = performance.now();
    },
  };
}
