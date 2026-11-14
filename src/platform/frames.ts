/**
 * How smoothly a run was drawn, for telemetry: three counters, so an hour of
 * play costs nothing to remember. No DOM here; the loop feeds it the length
 * of each frame drawn while the run is played.
 */

/** A frame longer than this is one a player sees as a stutter: under 30 a second. */
export const SLOW_FRAME = 1 / 30;

export interface FrameReport {
  /** Frames drawn per second of play. */
  fps: number;
  /** Percent of frames longer than SLOW_FRAME. */
  slow: number;
}

export class FrameMeter {
  private frames = 0;
  private seconds = 0;
  private slowFrames = 0;

  /** One frame of `seconds`. The loop cuts a stall to 50 ms (loop.ts), so one stall counts once. */
  add(seconds: number): void {
    if (!(seconds > 0)) return;
    this.frames += 1;
    this.seconds += seconds;
    if (seconds > SLOW_FRAME) this.slowFrames += 1;
  }

  reset(): void {
    this.frames = 0;
    this.seconds = 0;
    this.slowFrames = 0;
  }

  /** The run's frames, or null before any were drawn. */
  report(): FrameReport | null {
    if (!this.frames) return null;
    return {
      fps: Math.round(this.frames / this.seconds),
      slow: Math.round((this.slowFrames / this.frames) * 100),
    };
  }
}
