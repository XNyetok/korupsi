/**
 * The sound itself: every effect and every note of the tune, made from
 * oscillators and filtered noise. No audio files. It works on any audio
 * context, live or offline, so the mix can be rendered and measured without
 * anyone listening (see docs/design/game-design.md, What the tests check).
 *
 * Everything goes through two buses, effects and music, into one compressor.
 * The compressor is what lets the effects be loud without clipping when
 * several land on the same beat as the tune.
 */

import { type Drum, STEP_SECONDS, stepEvents } from './music.ts';

export type Cue =
  | 'jump'
  | 'land'
  | 'step'
  | 'dash'
  | 'collect'
  | 'caught'
  | 'rejected'
  | 'respawn'
  | 'checkpoint'
  | 'warn'
  | 'stamp'
  | 'crumble'
  | 'win'
  | 'start'
  | 'click';

type Wave = OscillatorType | PeriodicWave;

interface Tone {
  wave?: Wave;
  freq: number;
  /** Glide to this frequency over the note. */
  to?: number;
  /** Seconds after `at`. */
  delay?: number;
  dur: number;
  gain: number;
  /** Held notes keep their level and let go at the end; the default is a pluck that dies away. */
  held?: boolean;
}

interface Noise {
  delay?: number;
  dur: number;
  gain: number;
  filter: BiquadFilterType;
  freq: number;
  to?: number;
  q?: number;
}

/** The tune's share of the mix: measured to sit about 10 dB under the effects that matter. */
const MUSIC_LEVEL = 0.22;

export class Synth {
  readonly ctx: BaseAudioContext;
  private readonly out: GainNode;
  private readonly sfx: GainNode;
  private readonly music: GainNode;
  /** Pulse waves, a quarter and an eighth wide: the two voices of an old console. */
  private readonly pulse: PeriodicWave;
  private readonly thin: PeriodicWave;
  private readonly hiss: AudioBuffer;
  private stride = 0;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;

    this.out = ctx.createGain();
    this.out.gain.value = 0.9;
    this.out.connect(ctx.destination);

    const squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -16;
    squash.knee.value = 12;
    squash.ratio.value = 6;
    squash.attack.value = 0.003;
    squash.release.value = 0.18;
    squash.connect(this.out);

    this.sfx = ctx.createGain();
    this.sfx.gain.value = 1;
    this.sfx.connect(squash);

    // The tune sits under the effects, with its top rolled off so it never fights them.
    const soften = ctx.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 5200;
    soften.connect(squash);
    this.music = ctx.createGain();
    this.music.gain.value = MUSIC_LEVEL;
    this.music.connect(soften);

    this.pulse = this.pulseWave(0.25);
    this.thin = this.pulseWave(0.125);

    const length = Math.ceil(ctx.sampleRate * 1);
    this.hiss = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.hiss.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }

  /** A pulse wave `duty` wide, from its Fourier series. */
  private pulseWave(duty: number): PeriodicWave {
    const harmonics = 32;
    const real = new Float32Array(harmonics);
    const imag = new Float32Array(harmonics);
    for (let n = 1; n < harmonics; n++) real[n] = (4 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    return this.ctx.createPeriodicWave(real, imag);
  }

  /** The level of everything: 0 is muted. */
  setLevel(level: number, seconds = 0.03): void {
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setTargetAtTime(level * 0.9, now, seconds / 3);
  }

  /** The level of the tune alone, as a share of its normal level. */
  setMusicLevel(level: number, seconds = 0.2): void {
    const now = this.ctx.currentTime;
    this.music.gain.cancelScheduledValues(now);
    this.music.gain.setTargetAtTime(level * MUSIC_LEVEL, now, seconds / 3);
  }

  private tone(bus: GainNode, at: number, tone: Tone, volume = 1): void {
    const { ctx } = this;
    const t0 = at + (tone.delay ?? 0);
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const peak = tone.gain * volume;
    if (peak <= 0) return;

    const wave: Wave = tone.wave ?? 'square';
    if (wave instanceof PeriodicWave) osc.setPeriodicWave(wave);
    else osc.type = wave;
    osc.frequency.setValueAtTime(tone.freq, t0);
    if (tone.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, tone.to), t0 + tone.dur);

    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(peak, t0 + 0.004);
    if (tone.held) {
      env.gain.setValueAtTime(peak * 0.75, t0 + Math.max(0.01, tone.dur - 0.03));
      env.gain.linearRampToValueAtTime(0.0001, t0 + tone.dur);
    } else {
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.dur);
    }

    osc.connect(env);
    env.connect(bus);
    osc.start(t0);
    osc.stop(t0 + tone.dur + 0.02);
  }

  private noise(bus: GainNode, at: number, noise: Noise, volume = 1): void {
    const { ctx } = this;
    const t0 = at + (noise.delay ?? 0);
    const peak = noise.gain * volume;
    if (peak <= 0) return;

    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();
    src.buffer = this.hiss;
    src.loop = true;
    filter.type = noise.filter;
    filter.Q.value = noise.q ?? 0.8;
    filter.frequency.setValueAtTime(noise.freq, t0);
    if (noise.to) filter.frequency.exponentialRampToValueAtTime(Math.max(40, noise.to), t0 + noise.dur);

    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(peak, t0 + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + noise.dur);

    src.connect(filter);
    filter.connect(env);
    env.connect(bus);
    // Start somewhere different each time, so two hits never sound identical.
    src.start(t0, Math.random() * 0.8);
    src.stop(t0 + noise.dur + 0.02);
  }

  /** Plays an effect. `volume` scales it: a stamp far away is a quiet stamp. */
  cue(name: Cue, volume = 1, at = this.ctx.currentTime): void {
    const tone = (t: Tone) => this.tone(this.sfx, at, t, volume);
    const noise = (n: Noise) => this.noise(this.sfx, at, n, volume);

    switch (name) {
      case 'jump':
        tone({ wave: this.pulse, freq: 330, to: 700, dur: 0.14, gain: 0.5 });
        noise({ dur: 0.04, gain: 0.12, filter: 'highpass', freq: 3000 });
        break;
      case 'land':
        tone({ wave: 'sine', freq: 170, to: 62, dur: 0.14, gain: 0.5 });
        noise({ dur: 0.09, gain: 0.2, filter: 'lowpass', freq: 700 });
        break;
      case 'step': {
        // Left foot, right foot.
        this.stride = 1 - this.stride;
        noise({ dur: 0.035, gain: 0.2, filter: 'bandpass', freq: this.stride ? 1500 : 1900, q: 1.4 });
        tone({ wave: 'triangle', freq: this.stride ? 190 : 230, to: 120, dur: 0.04, gain: 0.16 });
        break;
      }
      case 'dash':
        noise({ dur: 0.22, gain: 0.9, filter: 'bandpass', freq: 3600, to: 500, q: 1.2 });
        tone({ wave: this.thin, freq: 980, to: 240, dur: 0.18, gain: 0.3 });
        break;
      case 'collect':
        tone({ wave: this.pulse, freq: 988, dur: 0.07, gain: 0.22 });
        tone({ wave: this.pulse, freq: 1319, dur: 0.22, gain: 0.22, delay: 0.07 });
        tone({ wave: 'triangle', freq: 2637, dur: 0.18, gain: 0.1, delay: 0.07 });
        break;
      case 'caught':
        // The two notes of a patrol car, then the floor going out from under you.
        for (let i = 0; i < 4; i++) {
          tone({ wave: this.pulse, freq: i % 2 ? 880 : 660, dur: 0.13, gain: 0.24, delay: i * 0.13, held: true });
        }
        tone({ wave: 'sawtooth', freq: 160, to: 45, dur: 0.6, gain: 0.2 });
        break;
      case 'rejected':
        // Stamped: the thud, then a buzzer that says no.
        tone({ wave: 'sine', freq: 120, to: 38, dur: 0.3, gain: 0.7 });
        noise({ dur: 0.16, gain: 0.3, filter: 'lowpass', freq: 900 });
        tone({ wave: 'sawtooth', freq: 98, dur: 0.16, gain: 0.22, delay: 0.14, held: true });
        tone({ wave: 'sawtooth', freq: 87, dur: 0.3, gain: 0.22, delay: 0.32, held: true });
        break;
      case 'respawn':
        tone({ wave: 'triangle', freq: 392, to: 784, dur: 0.16, gain: 0.36 });
        break;
      case 'checkpoint':
        // The fingerprint reader: bip, bip, biiip.
        tone({ wave: this.thin, freq: 1175, dur: 0.06, gain: 0.18, held: true });
        tone({ wave: this.thin, freq: 1175, dur: 0.06, gain: 0.18, delay: 0.09, held: true });
        tone({ wave: this.thin, freq: 1568, dur: 0.2, gain: 0.18, delay: 0.18, held: true });
        break;
      case 'warn':
        // The stamp rattling before it falls.
        for (let i = 0; i < 4; i++) {
          tone({ wave: 'square', freq: 150 + i * 14, dur: 0.035, gain: 0.16, delay: i * 0.085 });
          noise({ dur: 0.03, gain: 0.1, filter: 'bandpass', freq: 2400, q: 2, delay: i * 0.085 });
        }
        break;
      case 'stamp':
        tone({ wave: 'sine', freq: 130, to: 36, dur: 0.26, gain: 0.8 });
        noise({ dur: 0.14, gain: 0.34, filter: 'lowpass', freq: 1000 });
        tone({ wave: 'square', freq: 82, dur: 0.05, gain: 0.16 });
        break;
      case 'crumble':
        for (let i = 0; i < 4; i++) {
          noise({ dur: 0.1, gain: 0.7, filter: 'bandpass', freq: 900 - i * 150, q: 1, delay: i * 0.055 });
        }
        tone({ wave: 'sawtooth', freq: 170, to: 55, dur: 0.3, gain: 0.22 });
        break;
      case 'win': {
        // Up the scale the tune is written in, and a chord to land on.
        const climb = [659.26, 783.99, 987.77, 1046.5, 1318.51];
        climb.forEach((freq, i) => {
          tone({ wave: this.pulse, freq, dur: 0.11, gain: 0.2, delay: i * 0.1, held: true });
        });
        for (const freq of [659.26, 987.77, 1318.51]) {
          tone({ wave: this.pulse, freq, dur: 0.7, gain: 0.14, delay: 0.52 });
        }
        tone({ wave: 'triangle', freq: 164.81, dur: 0.8, gain: 0.3, delay: 0.52 });
        break;
      }
      case 'start':
        tone({ wave: this.pulse, freq: 392, dur: 0.08, gain: 0.2, held: true });
        tone({ wave: this.pulse, freq: 659.26, dur: 0.18, gain: 0.2, delay: 0.09 });
        break;
      case 'click':
        tone({ wave: 'square', freq: 520, dur: 0.04, gain: 0.18 });
        break;
    }
  }

  /** Schedules everything the tune starts on one step of its loop. */
  musicStep(step: number, at: number): void {
    const events = stepEvents(step);
    const bus = this.music;

    if (events.bass) {
      this.tone(bus, at, {
        wave: 'triangle',
        freq: events.bass.freq,
        dur: events.bass.length * STEP_SECONDS * 0.92,
        gain: 0.5,
        held: true,
      });
    }
    if (events.lead) {
      this.tone(bus, at, {
        wave: this.pulse,
        freq: events.lead.freq,
        dur: Math.max(0.09, events.lead.length * STEP_SECONDS * 0.9),
        gain: 0.2,
        held: events.lead.length > 1,
      });
    }
    if (events.arp) {
      this.tone(bus, at, { wave: this.thin, freq: events.arp.freq, dur: STEP_SECONDS * 0.8, gain: 0.075 });
    }
    if (events.drum) this.drum(events.drum, at);
  }

  private drum(drum: Drum, at: number): void {
    const bus = this.music;
    if (drum === 'k') {
      this.tone(bus, at, { wave: 'sine', freq: 150, to: 44, dur: 0.14, gain: 0.6 });
    } else if (drum === 's') {
      this.noise(bus, at, { dur: 0.1, gain: 0.3, filter: 'bandpass', freq: 1900, q: 0.7 });
      this.tone(bus, at, { wave: 'triangle', freq: 210, to: 150, dur: 0.06, gain: 0.2 });
    } else if (drum === 'h') {
      this.noise(bus, at, { dur: 0.03, gain: 0.12, filter: 'highpass', freq: 7000 });
    } else {
      // The fill at the end of a section, falling like a kendang.
      this.tone(bus, at, { wave: 'sine', freq: 260, to: 120, dur: 0.1, gain: 0.45 });
    }
  }
}
