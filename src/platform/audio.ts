/**
 * The game's sound: when the audio context may run, the mute switch, and the
 * clock that keeps the tune playing. What things sound like is in synth.ts,
 * and the tune itself in music.ts. No audio files anywhere: the game stays a
 * single small build.
 */

import { SONG, STEP_SECONDS } from './music.ts';
import { readItem, writeItem } from './storage.ts';
import { type Cue, Synth } from './synth.ts';

export type { Cue } from './synth.ts';

const MUTE_KEY = 'korupsi.muted';

/** How far ahead of the clock notes are handed to the audio thread. */
const LOOKAHEAD = 0.25;
/** How often the tune is topped up. Well under the lookahead, so a slow frame never leaves a gap. */
const TICK_MS = 60;

function readMuted(): boolean {
  return readItem(MUTE_KEY) === '1';
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private synth: Synth | null = null;
  muted = readMuted();

  /** The tune: whether it is playing, where in the loop it is, and when the next step is due. */
  private playing = false;
  private step = 0;
  private nextTime = 0;
  private timer = 0;

  get state(): AudioContextState | 'uninitialised' {
    return this.ctx ? this.ctx.state : 'uninitialised';
  }

  /** True while the tune is being played. */
  get musicOn(): boolean {
    return this.playing;
  }

  /** Must be called from a user gesture before anything can be heard. */
  unlock(): void {
    const ctx = this.ensure();
    if (!ctx) return;

    // Safari on iOS reports "interrupted" after a call or Siri, which behaves
    // like suspended but is not part of the spec's type. Resume unless running.
    if (ctx.state !== 'running') void ctx.resume().catch(() => {});
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;

    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    const ctx = new Ctor();
    this.ctx = ctx;
    this.synth = new Synth(ctx);
    this.synth.setLevel(this.muted ? 0 : 1, 0);

    // iOS keeps a context created in a gesture asleep until something is
    // actually played from it. One sample of silence satisfies that.
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);

    return ctx;
  }

  /** Stop the clock while the page is hidden; unlock() resumes it. */
  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    writeItem(MUTE_KEY, muted ? '1' : '0');
    this.synth?.setLevel(muted ? 0 : 1);
  }

  /** Plays an effect, at `volume` between 0 and 1. */
  play(cue: Cue, volume = 1): void {
    if (this.muted || volume <= 0) return;

    // No context yet means no gesture yet; creating one here would be asleep.
    const { ctx, synth } = this;
    if (!ctx || !synth) return;

    if (ctx.state === 'running') {
      synth.cue(cue, volume);
      return;
    }

    // Resuming is asynchronous on iOS. Scheduling into a suspended clock would
    // swallow the cue, so wait for the context instead.
    void ctx
      .resume()
      .then(() => {
        if (ctx.state === 'running') synth.cue(cue, volume);
      })
      .catch(() => {});
  }

  // ---------- the tune ----------

  /** Starts the tune from the top. */
  startMusic(): void {
    this.step = 0;
    this.resumeMusic();
  }

  /** Carries on from where the tune was paused. */
  resumeMusic(): void {
    const { ctx, synth } = this;
    if (!ctx || !synth) return;
    this.playing = true;
    this.nextTime = ctx.currentTime + 0.06;
    synth.setMusicLevel(1, 0.05);
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.fill(), TICK_MS);
    this.fill();
  }

  /** Fades the tune out and remembers the place. */
  pauseMusic(): void {
    if (!this.playing) return;
    this.playing = false;
    window.clearInterval(this.timer);
    this.synth?.setMusicLevel(0, 0.12);
  }

  /** Pulls the tune down for a moment, so what just happened is heard. */
  duckMusic(seconds: number): void {
    const { synth } = this;
    if (!synth || !this.playing) return;
    synth.setMusicLevel(0.25, 0.05);
    window.setTimeout(() => {
      if (this.playing) synth.setMusicLevel(1, 0.4);
    }, seconds * 1000);
  }

  /** Hands the audio thread every step of the tune that falls inside the lookahead. */
  private fill(): void {
    const { ctx, synth } = this;
    if (!ctx || !synth || !this.playing || ctx.state !== 'running') return;

    // After a stall (a hidden tab, a long frame) do not play the backlog at once.
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.03;

    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      synth.musicStep(this.step, this.nextTime);
      this.step = (this.step + 1) % SONG.steps;
      this.nextTime += STEP_SECONDS;
    }
  }
}

export const audio = new AudioEngine();
