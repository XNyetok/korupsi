/**
 * Effects that live only on screen: dust, scraps, sparkles, the words that pop
 * up, the shake and the flash. Cosmetic, so they use Math.random and never
 * touch the simulation.
 */

import type { GameEvent } from '../core/types.ts';
import { C } from './palette.ts';
import { type Ctx, rect, textCentred, textHeight, textWidth } from './pixel.ts';

interface Particle {
  x: number;
  /** Height above the ground floor, like everything in the world. */
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  color: string;
  size: number;
  gravity: number;
}

interface Floater {
  x: number;
  y: number;
  age: number;
  life: number;
  label: string;
  color: string;
  big: boolean;
}

const CAUGHT_WORDS = { auditor: 'OTT!', stempel: 'DITOLAK!', jatuh: 'OTT!' } as const;

export class Fx {
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  shake = 0;
  flash = 0;

  clear(): void {
    this.particles = [];
    this.floaters = [];
    this.shake = 0;
    this.flash = 0;
  }

  private burst(
    n: number,
    x: number,
    y: number,
    colors: readonly string[],
    opts: { speed: number; up: number; life: number; gravity: number; size?: number },
  ): void {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 6,
        y,
        vx: (Math.random() - 0.5) * 2 * opts.speed,
        vy: opts.up * (0.4 + Math.random() * 0.6),
        life: opts.life * (0.6 + Math.random() * 0.4),
        age: 0,
        color: colors[i % colors.length] as string,
        size: opts.size ?? 1,
        gravity: opts.gravity,
      });
    }
  }

  private say(label: string, x: number, y: number, color: string, big = false, life = 0.9): void {
    this.floaters.push({ x, y, age: 0, life, label, color, big });
  }

  handle(event: GameEvent): void {
    const { x, y } = event;
    switch (event.type) {
      case 'jump':
        this.burst(3, x, y, [C.paperDark, C.concrete], { speed: 22, up: 14, life: 0.28, gravity: 60 });
        break;
      case 'land':
        this.burst(5, x, y, [C.paperDark, C.concrete], { speed: 34, up: 18, life: 0.3, gravity: 80 });
        break;
      case 'dash':
        this.burst(6, x, y + 10, [C.white, C.paper], { speed: 8, up: 4, life: 0.22, gravity: 0 });
        break;
      case 'collect':
        this.burst(8, x, y, [C.goldLight, C.gold, C.white], { speed: 46, up: 60, life: 0.5, gravity: 160 });
        this.say('+RP 500.000', x, y + 10, C.goldLight);
        break;
      case 'caught':
        this.shake = 0.35;
        this.flash = 0.25;
        this.say(CAUGHT_WORDS[event.cause ?? 'auditor'], x, y + 34, C.red, true, 1);
        break;
      case 'checkpoint':
        this.burst(10, x, y + 18, [C.green, C.glass, C.white], { speed: 40, up: 50, life: 0.6, gravity: 120 });
        this.say('ABSEN MASUK', x, y + 44, C.green);
        break;
      case 'crumble':
        this.burst(12, x, y, [C.red, C.white, C.bamboo], { speed: 40, up: 30, life: 0.7, gravity: 320, size: 2 });
        break;
      case 'stamp':
        this.shake = Math.max(this.shake, 0.12);
        this.burst(8, x, y, [C.paper, C.paperDark], { speed: 70, up: 26, life: 0.35, gravity: 120 });
        break;
      case 'win':
        this.burst(40, x, y + 20, [C.gold, C.goldLight, C.red, C.white, C.green], {
          speed: 90,
          up: 150,
          life: 1.4,
          gravity: 220,
          size: 2,
        });
        break;
      case 'respawn':
        this.burst(6, x, y + 10, [C.white, C.glass], { speed: 30, up: 30, life: 0.4, gravity: 0 });
        break;
    }
  }

  update(dt: number): void {
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, this.flash - dt);
    for (const p of this.particles) {
      p.age += dt;
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (const f of this.floaters) {
      f.age += dt;
      f.y += 16 * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
    this.floaters = this.floaters.filter((f) => f.age < f.life);
  }

  /**
   * `row` turns a height above the ground floor into a screen row; `left`
   * and `width` are the part of the tower in view, so a word stays on screen.
   */
  draw(ctx: Ctx, row: (y: number) => number, left: number, width: number): void {
    for (const p of this.particles) rect(ctx, p.x, row(p.y), p.size, p.size, p.color);

    for (const f of this.floaters) {
      // A word blinks out at the end rather than fading: there is no alpha in this palette.
      if (f.life - f.age < 0.2 && Math.floor(f.age * 30) % 2 === 0) continue;
      const w = textWidth(f.label, f.big);
      const h = textHeight(f.big);
      const cx = Math.max(left + w / 2 + 3, Math.min(left + width - w / 2 - 3, f.x));
      const top = row(f.y) - h;
      rect(ctx, Math.round(cx - w / 2) - 2, top - 2, w + 4, h + 4, C.ink);
      textCentred(ctx, f.label, cx, top, f.color, f.big);
    }
  }
}
