/**
 * Owns the run. No DOM in here: rendering, input and storage live outside, so
 * a run can be stepped in a test without a browser.
 */

import { generateLevel, groundLedge } from './level.ts';
import { PARAMS, WORLD_WIDTH } from './params.ts';
import { findLanding, fly, launch, stand } from './physics.ts';
import { mulberry32, randomSeed, type Rng } from './rng.ts';
import { AWAY_LIMIT_MS, auditorCatches, bandCause, beatsBest, jumpFactor, rupiah } from './rules.ts';
import type { Auditor, Best, Cause, Dust, Floater, Phase, Platform, Player } from './types.ts';

/** Mixed into the seed for the cosmetic stream, so dust never shifts the level stream. */
const FX_SALT = 0x9e3779b9;

/** Where the best score is kept between visits. The page passes localStorage. */
export interface BestStore {
  read(): Best;
  write(best: Best): void;
}

/** Keeps the best score for this session only: the default, and what tests use. */
export function memoryStore(): BestStore {
  let best: Best = { money: 0, height: 0 };
  return {
    read: () => ({ ...best }),
    write: (next) => {
      best = { ...next };
    },
  };
}

export interface GameOptions {
  /** Play every run with this seed instead of a fresh one: `?seed=` in the page. */
  seed?: number | null;
  store?: BestStore;
}

export interface GameEvents {
  onEnd(): void;
  onJump?(): void;
  onLand?(): void;
  onCollect?(): void;
  /** Once per run, when the audit band closes in on a player who is stalling. */
  onBandWarn?(): void;
}

export class Game {
  readonly width = WORLD_WIDTH;
  height = 640;

  phase: Phase = 'ready';
  platforms: Platform[] = [];
  auditors: Auditor[] = [];
  floaters: Floater[] = [];
  dust: Dust[] = [];

  player: Player = { x: 0, y: 0, vx: 0, vy: 0, onGround: null, dir: 1 };

  money = 0;
  weight = 0;
  camY = 0;
  camSpeed = 0;
  maxClimb = 0;
  lastFooting = 0;
  squash = 1;
  shake = 0;
  cause: Cause = '';
  best: Best;
  /** Levels climbed this run: new ledges reached, not pixels. */
  level = 0;
  /** Seconds of actual play, pauses excluded. */
  elapsed = 0;
  /** Decides every level of this run, together with the player's choices. */
  seed = 0;

  private nextId = 1;
  /** The last ledge the player stood on. */
  private footing: Platform | null = null;
  /** The one-time band warning has fired this run. */
  private bandWarned = false;
  private readonly events: GameEvents;
  private readonly fixedSeed: number | null;
  private readonly store: BestStore;
  /** Level layout, ledge types, auditors: everything that decides the run. */
  private rng: Rng = mulberry32(0);
  /** Dust only. Its own stream, so how many particles fly never changes a level. */
  private fx: Rng = mulberry32(FX_SALT);

  constructor(events: GameEvents, options: GameOptions = {}) {
    this.events = events;
    this.fixedSeed = options.seed ?? null;
    this.store = options.store ?? memoryStore();
    this.best = this.store.read();
  }

  private fxRand(a: number, b: number): number {
    return a + this.fx() * (b - a);
  }

  /** The visible height in world units. The width never changes. */
  setViewport(height: number): void {
    this.height = height;
  }

  /** Where the audit band starts, measured from the top of the view. Feet past it end the run. */
  get auditLine(): number {
    return this.height - PARAMS.bandHeight;
  }

  get heightMetres(): number {
    return Math.round(this.maxClimb / PARAMS.pixelsPerMetre);
  }

  jumpFactor(): number {
    return jumpFactor(this.weight);
  }

  // ---------- world ----------

  private generateChoices(anchorX: number, anchorY: number): void {
    const { left, right, auditor } = generateLevel(
      {
        rng: this.rng,
        width: this.width,
        level: this.level,
        factor: this.jumpFactor(),
        nextId: () => this.nextId++,
      },
      anchorX,
      anchorY,
    );
    this.platforms.push(left, right);
    if (auditor) this.auditors.push(auditor);
  }

  private rebuildAhead(): void {
    const anchor = this.player.onGround;
    if (!anchor) return;

    // Keep the ledge underfoot: filtering it out left the player standing on a
    // platform that no longer existed on screen.
    this.platforms = this.platforms.filter((p) => p === anchor || p.y >= anchor.y);
    this.auditors = [];
    this.generateChoices(this.player.x, anchor.y);
  }

  // ---------- flow ----------

  /**
   * A new run. Without a seed it uses the fixed one from the options, or a
   * fresh random one.
   */
  reset(seed: number | null = this.fixedSeed): void {
    this.seed = (seed ?? randomSeed()) >>> 0;
    this.rng = mulberry32(this.seed);
    this.fx = mulberry32(this.seed ^ FX_SALT);

    this.platforms = [];
    this.auditors = [];
    this.floaters = [];
    this.dust = [];
    this.money = 0;
    this.weight = 0;
    this.maxClimb = 0;
    this.lastFooting = 0;
    this.squash = 1;
    this.shake = 0;
    this.cause = '';
    this.nextId = 1;
    this.level = 0;
    this.elapsed = 0;
    this.bandWarned = false;

    const ground = groundLedge(this.width, this.nextId++);
    this.platforms.push(ground);
    this.footing = ground;

    this.player = { x: ground.x, y: ground.y, vx: 0, vy: 0, onGround: ground, dir: 1 };

    this.camY = this.player.y - this.height * 0.62;
    this.camSpeed = PARAMS.cameraBase;

    this.generateChoices(ground.x, ground.y);
  }

  start(): void {
    this.reset();
    this.phase = 'playing';
  }

  endRun(cause: Cause): void {
    this.phase = 'over';
    this.cause = cause;
    this.shake = 1;

    const h = this.heightMetres;
    if (beatsBest(this.best, this.money, h)) {
      this.best = { money: this.money, height: h };
      this.store.write(this.best);
    }
    this.events.onEnd();
  }

  /** Freeze the run while the page is hidden. */
  pause(): void {
    if (this.phase === 'playing') this.phase = 'paused';
  }

  resume(): void {
    if (this.phase === 'paused') this.phase = 'playing';
  }

  /**
   * Called when the player comes back. A glance at a notification should not
   * cost the run; leaving for a minute should, or the pause becomes a save.
   */
  handleAway(awayMs: number): void {
    if (this.phase !== 'playing' && this.phase !== 'paused') return;
    if (awayMs >= AWAY_LIMIT_MS) this.endRun('abandoned');
  }

  jump(dir: number): void {
    const plat = this.player.onGround;
    if (!plat) return;

    launch(this.player, dir, this.jumpFactor());

    this.squash = 0.86;
    this.puff(6, 0);
    this.events.onJump?.();

    if (plat.type === 'fiktif' && plat.crumble === 0) plat.crumble = 0.0001;
  }

  private puff(count: number, drift: number): void {
    for (let i = 0; i < count; i++) {
      this.dust.push({
        x: this.player.x + this.fxRand(-9, 9),
        y: this.player.y - 1,
        vx: this.fxRand(-30, 30) + drift,
        vy: this.fxRand(-52, -8),
        life: this.fxRand(0.22, 0.5),
        t: 0,
        r: this.fxRand(1.1, 2.4),
      });
    }
  }

  private land(plat: Platform): void {
    const from = this.footing;
    this.footing = plat;

    this.player.y = plat.y;
    this.player.vy = 0;
    this.player.vx = 0;
    this.player.onGround = plat;
    this.lastFooting = plat.y;
    this.squash = 1.18;
    this.puff(9, 0);
    this.events.onLand?.();

    if (plat.type === 'fiktif' && plat.crumble === 0) plat.crumble = 0.0001;

    if (plat.gold && !plat.taken) {
      plat.taken = true;
      this.money += PARAMS.moneyValue;
      this.weight += 1;
      this.floaters.push({
        x: plat.x,
        y: plat.y - 46,
        t: 0,
        text: '+' + rupiah(PARAMS.moneyValue),
      });
      this.events.onCollect?.();
    }

    // Coming back down on the same ledge is not progress. Rebuilding here let
    // a jump into the wall reroll the level and dismiss its auditor.
    if (plat === from) return;
    if (!from || plat.y < from.y) this.level += 1;

    this.rebuildAhead();
  }

  // ---------- simulation ----------

  step(dt: number): void {
    if (this.phase !== 'playing') return;

    this.elapsed += dt;

    const p = this.player;
    const prevY = p.y;

    if (p.onGround && !p.onGround.alive) p.onGround = null;

    if (p.onGround) {
      stand(p, p.onGround, this.width);
    } else {
      fly(p, dt, this.width);
      const target = findLanding(this.platforms, p, prevY);
      if (target) this.land(target);
    }

    for (const plat of this.platforms) {
      if (plat.crumble <= 0) continue;
      plat.crumble += dt;
      if (plat.alive && plat.crumble >= PARAMS.crumbleDelay) {
        plat.alive = false;
        if (p.onGround === plat) p.onGround = null;

        // Show the thing breaking, so a vanishing ledge never reads as a bug.
        for (let i = 0; i < 10; i++) {
          this.dust.push({
            x: plat.x + this.fxRand(-plat.w / 2, plat.w / 2),
            y: plat.y + this.fxRand(0, 6),
            vx: this.fxRand(-46, 46),
            vy: this.fxRand(-34, 18),
            life: this.fxRand(0.3, 0.65),
            t: 0,
            r: this.fxRand(1, 2.6),
          });
        }
      }
    }

    for (const a of this.auditors) {
      a.x += a.dir * a.speed * dt;
      if (a.x < a.minX) {
        a.x = a.minX;
        a.dir = 1;
      } else if (a.x > a.maxX) {
        a.x = a.maxX;
        a.dir = -1;
      }
      a.y = a.upper.y - 11;

      if (auditorCatches(a, p)) {
        this.endRun('auditor');
        return;
      }
    }
    this.auditors = this.auditors.filter((a) => a.upper.alive);

    this.camSpeed += PARAMS.cameraAccel * dt;
    this.camY -= this.camSpeed * dt;

    const follow = p.y - this.height * 0.62;
    if (follow < this.camY) this.camY += (follow - this.camY) * Math.min(1, dt * 12);

    this.maxClimb = Math.max(this.maxClimb, -p.y);

    if (this.platforms.length > 60) {
      const cutoff = this.camY + this.height + 420;
      this.platforms = this.platforms.filter((plat) => plat.y < cutoff || plat === p.onGround);
    }

    for (const f of this.floaters) {
      f.t += dt;
      f.y -= 30 * dt;
    }
    this.floaters = this.floaters.filter((f) => f.t < 1.2);

    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.squash += (1 - this.squash) * Math.min(1, dt * 16);

    for (const d of this.dust) {
      d.t += dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 190 * dt;
    }
    this.dust = this.dust.filter((d) => d.t < d.life);

    if (!this.bandWarned && this.auditLine - (p.y - this.camY) < PARAMS.bandWarnAt) {
      this.bandWarned = true;
      this.events.onBandWarn?.();
    }
    if (p.y - this.camY > this.auditLine) this.endRun(bandCause(p, this.lastFooting));
  }
}
