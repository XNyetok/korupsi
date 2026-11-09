/**
 * Small synthesised sound set. No audio files: the game stays a single build
 * with no binary assets, and every cue is a couple of oscillator notes.
 */

const MUTE_KEY = 'korupsi.muted';

export type Cue = 'jump' | 'land' | 'collect' | 'caught' | 'start';

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  muted = readMuted();

  /** Must be called from a user gesture before anything can be heard. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;

      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.3;
      this.master.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Stop the clock while the page is hidden; unlock() resumes it. */
  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* private mode, ignore */
    }
  }

  play(cue: Cue): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || !this.master) return;

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
