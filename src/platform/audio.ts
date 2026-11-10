/**
 * Small synthesised sound set. No audio files: the game stays a single build
 * with no binary assets, and every cue is a couple of oscillator notes.
 */

import { readItem, writeItem } from './storage.ts';

const MUTE_KEY = 'korupsi.muted';

export type Cue =
  | 'jump'
  | 'land'
  | 'dash'
  | 'collect'
  | 'caught'
  | 'checkpoint'
  | 'stamp'
  | 'crumble'
  | 'win'
  | 'start';

function readMuted(): boolean {
  return readItem(MUTE_KEY) === '1';
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  muted = readMuted();

  get state(): AudioContextState | 'uninitialised' {
    return this.ctx ? this.ctx.state : 'uninitialised';
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
    this.master = ctx.createGain();
    this.master.gain.value = 0.3;
    this.master.connect(ctx.destination);

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
  }

  play(cue: Cue): void {
    if (this.muted) return;

    // No context yet means no gesture yet; creating one here would be asleep.
    const ctx = this.ctx;
    if (!ctx || !this.master) return;

    if (ctx.state === 'running') {
      this.schedule(cue);
      return;
    }

    // Resuming is asynchronous on iOS. Scheduling into a suspended clock would
    // swallow the cue, so wait for the context instead.
    void ctx
      .resume()
      .then(() => {
        if (ctx.state === 'running') this.schedule(cue);
      })
      .catch(() => {});
  }

  private schedule(cue: Cue): void {
    switch (cue) {
      case 'jump':
        this.tone({ freq: 470, to: 760, dur: 0.1, gain: 0.1 });
        break;
      case 'land':
        this.tone({ freq: 130, to: 78, dur: 0.11, type: 'sine', gain: 0.12 });
        this.noise(0.07, 0.05);
        break;
      case 'collect':
        this.tone({ freq: 880, dur: 0.07, gain: 0.08 });
        this.tone({ freq: 1320, dur: 0.12, gain: 0.07, delay: 0.06 });
        break;
      case 'caught':
        this.tone({ freq: 300, to: 82, dur: 0.5, type: 'sawtooth', gain: 0.11 });
        break;
      case 'start':
        this.tone({ freq: 380, to: 620, dur: 0.16, gain: 0.1 });
        break;
      case 'dash':
        this.tone({ freq: 900, to: 320, dur: 0.12, type: 'square', gain: 0.05 });
        this.noise(0.09, 0.06);
        break;
      case 'checkpoint':
        this.tone({ freq: 660, dur: 0.08, type: 'square', gain: 0.06 });
        this.tone({ freq: 990, dur: 0.14, type: 'square', gain: 0.06, delay: 0.08 });
        break;
      case 'stamp':
        this.tone({ freq: 90, to: 48, dur: 0.16, type: 'sine', gain: 0.2 });
        this.noise(0.12, 0.12);
        break;
      case 'crumble':
        this.noise(0.15, 0.1);
        this.tone({ freq: 180, to: 70, dur: 0.2, type: 'square', gain: 0.04 });
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((freq, i) => {
          this.tone({ freq, dur: 0.16, type: 'square', gain: 0.07, delay: i * 0.11 });
        });
        break;
    }
  }

  private tone(opts: {
    freq: number;
    to?: number;
    dur: number;
    type?: OscillatorType;
    gain?: number;
    delay?: number;
  }): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = opts.type ?? 'triangle';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t0 + opts.dur);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(opts.gain ?? 0.15, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);

    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.03);
  }

  private noise(dur: number, gain: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    if (!this.noiseBuffer) {
      const length = Math.ceil(ctx.sampleRate * 0.15);
      this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      }
    }

    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();

    src.buffer = this.noiseBuffer;
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    env.gain.value = gain;

    src.connect(filter);
    filter.connect(env);
    env.connect(master);
    src.start(t0);
    src.stop(t0 + dur);
  }
}

export const audio = new AudioEngine();
