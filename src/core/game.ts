/**
 * The simulation: one player climbing one floor. No DOM, no clock of its own
 * and no randomness, so a run can be stepped in a test and the same inputs
 * always give the same climb.
 */

import { OVERHANG, PARAMS, PLAYER } from './params.ts';
import { AUDITOR, auditorAt, FLOORS, ledgeX, STAMP, stampAt, stampBites, type StampPhase } from './tower.ts';
import type { Best, BestStore, Cause, FloorDef, GameEvent, GameEventType, Input, Phase, Player } from './types.ts';

const IDLE: Input = { move: 0, jump: false, dash: false };

export const rupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

/** 83.4 -> "1:23". */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Every envelope shortens the jump, down to a floor the level is built for. */
export function jumpFactor(weight: number): number {
  return Math.max(PARAMS.minFactor, 1 - PARAMS.weightPenalty * weight);
}

function approach(value: number, target: number, step: number): number {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}

export interface GameOptions {
  floor?: FloorDef;
  store?: BestStore;
}

export class Game {
  readonly floor: FloorDef;
  phase: Phase = 'ready';

  /** The run clock: what the result screen shows. */
  time = 0;
  /** Drives the hazards. Never rewinds, so a respawn does not reset their rhythm. */
  worldTime = 0;
  deaths = 0;
  weight = 0;
  /** Index into the floor's checkpoints. */
  checkpoint = 0;
  /** Highest point reached, for telemetry. */
  peak = 0;

  /** Which envelopes are gone. */
  taken: boolean[] = [];
  /** Seconds since each ledge was touched; 0 while it is intact. Only fiktif ledges count up. */
  crumble: number[] = [];
  /** Counts down while the player is caught; the respawn happens at zero. */
  caught = 0;
  cause: Cause | null = null;
  best: Best;
  /** Set when the last finish beat a record. */
  record = { time: false, money: false };

  /** Tests and tuning switch this off to study the geometry alone. */
  hazards = true;

  player: Player;

  private savedTaken: boolean[] = [];
  private prev: Input = IDLE;
  private stampPhases: StampPhase[] = [];
  private queue: GameEvent[] = [];
  private readonly store: BestStore | null;

  constructor(options: GameOptions = {}) {
    this.floor = options.floor ?? (FLOORS[0] as FloorDef);
    this.store = options.store ?? null;
    this.best = this.store ? this.store.read() : { time: 0, money: 0 };
    this.player = this.spawnPlayer();
    this.reset();
  }

  get money(): number {
    return this.weight * PARAMS.moneyValue;
  }

  get heightMetres(): number {
    return Math.round(this.peak / PARAMS.pixelsPerMetre);
  }

  /** The height below which a fall ends in the audit team's arms; below the floor at the first checkpoint. */
  get auditLine(): number {
    if (this.checkpoint === 0) return -1000;
    const spot = this.floor.checkpoints[this.checkpoint];
    return (this.floor.ledges[spot?.ledge ?? 0]?.y ?? 0) - PARAMS.auditLine;
  }

  /** Back to the lobby with nothing in the bag. */
  reset(): void {
    this.phase = 'ready';
    this.time = 0;
    this.deaths = 0;
    this.weight = 0;
    this.checkpoint = 0;
    this.peak = 0;
    this.caught = 0;
    this.cause = null;
    this.record = { time: false, money: false };
    this.taken = this.floor.amplop.map(() => false);
    this.savedTaken = [...this.taken];
    this.crumble = this.floor.ledges.map(() => 0);
    this.stampPhases = this.floor.stamps.map((s) => stampAt(s, this.worldTime).phase);
    this.player = this.spawnPlayer();
    this.prev = IDLE;
    this.queue = [];
  }

  start(): void {
    if (this.phase === 'won') this.reset();
    if (this.phase === 'ready') this.phase = 'playing';
  }

  pause(): void {
    if (this.phase === 'playing') this.phase = 'paused';
  }

  resume(): void {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    // Whatever was held when the pause began is not a fresh press.
    this.prev = { move: 0, jump: true, dash: true };
  }

  /** Hands over what happened since the last call. */
  drain(): GameEvent[] {
    const events = this.queue;
    this.queue = [];
    return events;
  }

  /** Puts the player on a ledge: for tests and `?debug=1`. */
  placeOn(ledge: number, x?: number): void {
    const def = this.floor.ledges[ledge];
    if (!def) return;
    const left = ledgeX(def, this.worldTime);
    const p = this.player;
    p.x = x ?? left + def.w / 2;
    p.y = def.y;
    p.vx = 0;
    p.vy = 0;
    p.ground = ledge;
    p.dashT = 0;
    p.dashReady = true;
    p.rising = false;
    this.peak = Math.max(this.peak, p.y);
  }

  step(dt: number, input: Input = IDLE): void {
    if (this.phase !== 'playing') return;

    this.time += dt;
    this.worldTime += dt;
    this.stepWorld(dt);

    if (this.caught > 0) {
      this.caught -= dt;
      if (this.caught <= 0) this.respawn();
      this.prev = input;
      return;
    }

    this.stepPlayer(dt, input);
    this.prev = input;
    this.interact();
  }

  // ---------- the world ----------

  private stepWorld(dt: number): void {
    const { ledges, stamps } = this.floor;

    for (let i = 0; i < ledges.length; i++) {
      const since = this.crumble[i] ?? 0;
      if (since <= 0) continue;
      const next = since + dt;
      if (since < PARAMS.crumbleDelay && next >= PARAMS.crumbleDelay) {
        const def = ledges[i] as FloorDef['ledges'][number];
        this.emit('crumble', def.x + def.w / 2, def.y);
      }
      this.crumble[i] = next >= PARAMS.crumbleDelay + PARAMS.crumbleReturn ? 0 : next;
    }

    for (let i = 0; i < stamps.length; i++) {
      const def = stamps[i] as FloorDef['stamps'][number];
      const phase = stampAt(def, this.worldTime).phase;
      if (phase === 'hold' && this.stampPhases[i] !== 'hold') {
        this.emit('stamp', def.x, ledges[def.ledge]?.y ?? 0);
      }
      this.stampPhases[i] = phase;
    }
  }

  /** A fiktif ledge holds for a moment after it is touched, then is gone for a while. */
  ledgeHolds(index: number): boolean {
    return (this.crumble[index] ?? 0) < PARAMS.crumbleDelay;
  }

  // ---------- the player ----------

  private spawnPlayer(): Player {
    const spot = this.floor.checkpoints[this.checkpoint] ?? { ledge: 0, x: 0 };
    return {
      x: spot.x,
      y: this.floor.ledges[spot.ledge]?.y ?? 0,
      vx: 0,
      vy: 0,
      facing: 1,
      ground: spot.ledge,
      coyote: 0,
      buffer: 0,
      rising: false,
      dashT: 0,
      dashDir: 1,
      dashCool: 0,
      dashReady: true,
    };
  }

  private stepPlayer(dt: number, input: Input): void {
    const p = this.player;
    const { ledges } = this.floor;
    const jumpPressed = input.jump && !this.prev.jump;
    const dashPressed = input.dash && !this.prev.dash;

    // A troli carries whoever stands on it.
    if (p.ground >= 0) {
      const def = ledges[p.ground];
      if (def) p.x += ledgeX(def, this.worldTime) - ledgeX(def, this.worldTime - dt);
    }

    p.buffer = jumpPressed ? PARAMS.jumpBuffer : Math.max(0, p.buffer - dt);
    p.dashCool = Math.max(0, p.dashCool - dt);
    if (p.ground < 0) p.coyote = Math.max(0, p.coyote - dt);

    if (dashPressed && p.dashReady && p.dashCool <= 0 && p.dashT <= 0) {
      p.dashDir = input.move !== 0 ? input.move : p.facing;
      p.facing = p.dashDir;
      p.dashT = PARAMS.dashTime;
      p.dashCool = PARAMS.dashCooldown;
      p.dashReady = p.ground >= 0;
      p.rising = false;
      this.emit('dash', p.x, p.y);
    }

    if (p.dashT > 0) {
      // A dash is level and fast; gravity waits until it is over.
      p.dashT -= dt;
      p.vx = p.dashDir * PARAMS.dashSpeed;
      p.vy = 0;
      if (p.dashT <= 0) p.vx = p.dashDir * PARAMS.runSpeed;
    } else {
      if (input.move !== 0) p.facing = input.move;
      const accel = p.ground >= 0 ? (input.move !== 0 ? PARAMS.groundAccel : PARAMS.groundBrake) : PARAMS.airAccel;
      p.vx = approach(p.vx, input.move * PARAMS.runSpeed, accel * dt);

      if (p.ground >= 0) {
        p.vy = 0;
      } else {
        if (p.rising && (!input.jump || p.vy <= 0)) {
          if (p.vy > 0) p.vy *= PARAMS.jumpCut;
          p.rising = false;
        }
        const gravity = p.vy > 0 ? PARAMS.gravity : PARAMS.fallGravity;
        p.vy = Math.max(-PARAMS.maxFall, p.vy - gravity * dt);
      }
    }

    if (p.buffer > 0 && (p.ground >= 0 || p.coyote > 0)) {
      p.vy = PARAMS.jumpV * jumpFactor(this.weight);
      p.ground = -1;
      p.coyote = 0;
      p.buffer = 0;
      p.rising = true;
      p.dashT = 0;
      this.emit('jump', p.x, p.y);
    }

    const before = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const width = ledges[0]?.w ?? 0;
    if (p.x < PLAYER.half) {
      p.x = PLAYER.half;
      p.vx = Math.max(0, p.vx);
    } else if (p.x > width - PLAYER.half) {
      p.x = width - PLAYER.half;
      p.vx = Math.min(0, p.vx);
    }

    if (p.ground >= 0) {
      if (!this.supports(p.ground, p.x)) {
        p.ground = -1;
        p.coyote = PARAMS.coyote;
      }
    } else if (p.vy <= 0) {
      const landed = this.landing(before, p.y, p.x);
      if (landed >= 0) {
        const def = ledges[landed];
        p.y = def?.y ?? 0;
        p.vy = 0;
        p.ground = landed;
        p.rising = false;
        p.dashReady = true;
        if (def?.kind === 'fiktif' && (this.crumble[landed] ?? 0) <= 0) this.crumble[landed] = 0.0001;
        this.emit('land', p.x, p.y);
      }
    }

    this.peak = Math.max(this.peak, p.y);
  }

  private supports(index: number, x: number): boolean {
    const def = this.floor.ledges[index];
    if (!def || !this.ledgeHolds(index)) return false;
    const left = ledgeX(def, this.worldTime);
    return x >= left - OVERHANG && x <= left + def.w + OVERHANG;
  }

  /** The highest ledge whose surface the feet crossed on the way down this step. */
  private landing(from: number, to: number, x: number): number {
    let found = -1;
    let height = Number.NEGATIVE_INFINITY;
    const { ledges } = this.floor;
    for (let i = 0; i < ledges.length; i++) {
      const y = ledges[i]?.y ?? 0;
      if (y > from || y < to || y <= height) continue;
      if (!this.supports(i, x)) continue;
      found = i;
      height = y;
    }
    return found;
  }

  // ---------- what the player touches ----------

  private interact(): void {
    const p = this.player;
    const { amplop, auditors, stamps, checkpoints, exit, ledges } = this.floor;

    for (let i = 0; i < amplop.length; i++) {
      const a = amplop[i];
      if (!a || this.taken[i]) continue;
      if (Math.abs(a.x - p.x) < 10 && a.y > p.y - 4 && a.y < p.y + PLAYER.height + 4) {
        this.taken[i] = true;
        this.weight += 1;
        this.emit('collect', a.x, a.y);
      }
    }

    if (p.ground >= 0) {
      for (let i = this.checkpoint + 1; i < checkpoints.length; i++) {
        const spot = checkpoints[i];
        if (spot && spot.ledge === p.ground && Math.abs(spot.x - p.x) < 12) {
          this.checkpoint = i;
          this.savedTaken = [...this.taken];
          this.emit('checkpoint', spot.x, p.y);
        }
      }

      if (exit.ledge === p.ground && Math.abs(exit.x - p.x) < 8) {
        this.win();
        return;
      }
    }

    if (!this.hazards) return;

    if (p.y < this.auditLine) {
      this.catch('jatuh');
      return;
    }

    // A dash slips past an auditor: that is what ngeles means.
    if (p.dashT <= 0) {
      for (const def of auditors) {
        const a = auditorAt(def, this.worldTime);
        const feet = ledges[def.ledge]?.y ?? 0;
        if (
          Math.abs(a.x - p.x) < AUDITOR.half + PLAYER.half &&
          p.y < feet + AUDITOR.height - 2 &&
          p.y + PLAYER.height - 2 > feet
        ) {
          this.catch('auditor');
          return;
        }
      }
    }

    for (const def of stamps) {
      const state = stampAt(def, this.worldTime);
      if (!stampBites(state)) continue;
      const bottom = (ledges[def.ledge]?.y ?? 0) + state.lift * STAMP.lift;
      if (
        Math.abs(def.x - p.x) < STAMP.w / 2 + PLAYER.half - 1 &&
        p.y < bottom + STAMP.h &&
        p.y + PLAYER.height > bottom
      ) {
        this.catch('stempel');
        return;
      }
    }
  }

  private catch(cause: Cause): void {
    const p = this.player;
    this.deaths += 1;
    this.cause = cause;
    this.caught = PARAMS.caughtPause;
    p.vx = 0;
    p.vy = 0;
    p.dashT = 0;
    this.emit('caught', p.x, p.y, cause);
  }

  /** Back to the last checkpoint, with the bag as it was when the player clocked in. */
  private respawn(): void {
    this.caught = 0;
    this.taken = [...this.savedTaken];
    this.weight = this.taken.filter(Boolean).length;
    this.crumble = this.crumble.map(() => 0);
    this.player = this.spawnPlayer();
    this.emit('respawn', this.player.x, this.player.y);
  }

  private win(): void {
    this.phase = 'won';
    const time = this.best.time === 0 || this.time < this.best.time;
    const money = this.money > this.best.money;
    this.record = { time, money };
    if (time || money) {
      this.best = { time: time ? this.time : this.best.time, money: money ? this.money : this.best.money };
      this.store?.write(this.best);
    }
    this.emit('win', this.player.x, this.player.y);
  }

  private emit(type: GameEventType, x: number, y: number, cause?: Cause): void {
    this.queue.push(cause ? { type, x, y, cause } : { type, x, y });
  }
}
