import type { LiftPhase } from '../core/game.ts';

/** A quiet motor and a two-note queue chime, separate from the tower tune. */
export class AtriumSound {
  private ctx?: AudioContext;
  private master?: GainNode;
  private motor?: GainNode;
  private phase?: LiftPhase;
  private lastMoving = false;
  muted = false;

  unlock(): void {
    if (this.muted) return;
    const Ctor =
      window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    if (!this.ctx) {
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.connect(ctx.destination);
      const motor = ctx.createGain();
      motor.gain.value = 0;
      motor.connect(master);
      const hum = ctx.createOscillator();
      hum.type = 'triangle';
      hum.frequency.value = 94;
      hum.connect(motor);
      hum.start();
      this.ctx = ctx;
      this.master = master;
      this.motor = motor;
    }
    void this.ctx.resume().catch(() => {});
  }

  mute(on: boolean): void {
    this.muted = on;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(on ? 0 : 1, this.ctx.currentTime, 0.02);
    if (!on) this.unlock();
  }

  update(phase: LiftPhase, playing: boolean): void {
    const { ctx, master, motor } = this;
    if (!ctx || !master || !motor) return;
    const moving = playing && (phase === 'rising' || phase === 'returning');
    const now = ctx.currentTime;
    if (moving !== this.lastMoving) {
      motor.gain.setTargetAtTime(moving ? 0.047 : 0, now, 0.05);
      this.lastMoving = moving;
    }
    if (playing && !this.muted && this.phase !== phase && (phase === 'rising' || phase === 'arrived')) {
      for (const [i, frequency] of [523, 659].entries()) {
        const at = now + i * 0.12;
        const tone = ctx.createOscillator();
        const gain = ctx.createGain();
        tone.frequency.value = phase === 'arrived' ? frequency * 1.18 : frequency;
        gain.gain.setValueAtTime(0.001, at);
        gain.gain.linearRampToValueAtTime(0.12, at + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.16);
        tone.connect(gain).connect(master);
        tone.start(at);
        tone.stop(at + 0.19);
      }
    }
    this.phase = phase;
  }
}
