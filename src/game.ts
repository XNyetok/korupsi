import {
  PARAMS,
  type Auditor,
  type Best,
  type Cause,
  type Dust,
  type Floater,
  type Phase,
  type Platform,
  type PlatformType,
  type Player,
} from './config';

const BEST_KEY = 'korupsi.best';

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export interface GameEvents {
  onEnd(): void;
  onJump?(): void;
  onLand?(): void;
  onCollect?(): void;
}

export interface Envelope {
  jv: number;
  h: number;
  air: number;
  dxAt(dy: number): number;
}

export function envelope(factor: number): Envelope {
  const jv = PARAMS.jumpV * factor;
  const g = PARAMS.gravity;
  const h = (jv * jv) / (2 * g);
  const air = (2 * jv) / g;
  return {
    jv,
    h,
    air,
    dxAt(dy: number) {
      const inner = Math.max(0, jv * jv - 2 * g * dy);
      const t = (jv + Math.sqrt(inner)) / g;
      return PARAMS.moveVX * t;
    },
  };
}

export function readBest(): Best {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (!raw) return { money: 0, height: 0 };
    const parsed = JSON.parse(raw) as Partial<Best>;
    return { money: Number(parsed.money) || 0, height: Number(parsed.height) || 0 };
  } catch {
    return { money: 0, height: 0 };
  }
}

export function writeBest(best: Best): void {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    /* private mode, ignore */
  }
}

export const rupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

/**
 * Owns the run. Rendering and DOM live outside, so this can be stepped in a
 * test without a browser.
 */
export class Game {
  width = 360;
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
  best: Best = readBest();

  private nextId = 1;
  private readonly events: GameEvents;

  constructor(events: GameEvents) {
    this.events = events;
  }

  setViewport(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  get heightMetres(): number {
    return Math.round(this.maxClimb / PARAMS.pixelsPerMetre);
  }

  jumpFactor(): number {
    return Math.max(PARAMS.minFactor, 1 - PARAMS.weightPenalty * this.weight);
  }

  // ---------- world ----------

  private topPlatform(): Platform {
    let top = this.platforms[0];
    for (const p of this.platforms) if (p.y < top.y) top = p;
    return top;
  }

  private levelsClimbed(): number {
    return Math.round(-this.topPlatform().y / 70);
  }

  private riskyType(): PlatformType {
    const r = Math.random();
    if (r < 0.66) return 'solid';
    if (r < 0.88) return 'krat';
    return 'fiktif';
  }

  private makeOption(
    anchorX: number,
    anchorY: number,
    dir: number,
    dy: number,
    env: Envelope,
    gold: boolean,
  ): Platform | null {
    const w = gold ? rand(60, 74) : rand(84, 108);
    const lo = w / 2 + 10;
    const hi = this.width - w / 2 - 10;
    if (lo > hi) return null;

    // Horizontal speed is constant, so the landing spot is fixed for a given
    // rise. The ledge sits around that spot; the minimum distance keeps the
    // pair reading as left/right instead of bunched under the player.
    const travel = env.dxAt(dy);
    const jitter = rand(-w * 0.28, w * 0.28);
    const x = anchorX + dir * Math.max(PARAMS.minLedgeOffset, travel + jitter);

    if (x < lo || x > hi) return null;

    return {
      id: this.nextId++,
      x,
      y: anchorY - dy,
      w,
      gold,
      type: gold ? this.riskyType() : Math.random() < 0.35 ? 'krat' : 'solid',
      crumble: 0,
      alive: true,
      taken: false,
    };
  }

  private generateChoices(anchorX: number, anchorY: number): void {
    const env = envelope(this.jumpFactor());
    const dy = rand(env.h * PARAMS.gapMin, env.h * PARAMS.gapMax);

    const roll = Math.random();
    let goldLeft = false;
    let goldRight = false;
    if (roll < PARAMS.goldChance) {
      if (Math.random() < 0.5) goldLeft = true;
      else goldRight = true;
    } else if (roll < PARAMS.goldChance + PARAMS.doubleGoldChance) {
      goldLeft = true;
      goldRight = true;
    }

    // The first level always shows the choice, so the mechanic is visible
    // before the player has to guess at it.
    if (this.levelsClimbed() < 1) {
      goldLeft = Math.random() < 0.5;
      goldRight = !goldLeft;
    }

    const placed: Platform[] = [];
    const left = this.makeOption(anchorX, anchorY, -1, dy, env, goldLeft);
    const right = this.makeOption(anchorX, anchorY, 1, dy, env, goldRight);
    if (left) {
      this.platforms.push(left);
      placed.push(left);
    }
    if (right) {
      this.platforms.push(right);
      placed.push(right);
    }

    // If both sides were out of bounds, fall back to one reachable ledge.
    if (!placed.length) {
      const w = rand(70, 100);
      const travel = env.dxAt(dy);
      const dir = anchorX < this.width / 2 ? 1 : -1;
      const x = clamp(anchorX + dir * travel, w / 2 + 10, this.width - w / 2 - 10);
      const plat: Platform = {
        id: this.nextId++,
        x,
        y: anchorY - dy,
        w,
        gold: false,
        type: 'solid',
        crumble: 0,
        alive: true,
        taken: false,
      };
      this.platforms.push(plat);
      placed.push(plat);
    }

    // A single ledge means no choice, so it must never be the risky one.
    if (placed.length === 1 && placed[0].gold) {
      placed[0].gold = false;
      placed[0].type = 'solid';
      placed[0].w = Math.max(placed[0].w, 84);
    }

    this.maybeAddAuditor(anchorY, placed);
  }

  private maybeAddAuditor(_anchorY: number, placed: Platform[]): void {
    if (this.levelsClimbed() < 5) return;
    const gold = placed.find((p) => p.gold);
    if (!gold) return;
    if (Math.random() > 0.5) return;

    // The auditor only guards the money: its patrol never reaches the safe
    // ledge, so choosing the safe side always works.
    const reach = gold.w / 2 + 26;
    this.auditors.push({
      upper: gold,
      x: gold.x,
      y: gold.y - 11,
      dir: Math.random() < 0.5 ? -1 : 1,
      speed: rand(34, 62),
      w: 30,
      h: 26,
      minX: gold.x - reach,
      maxX: gold.x + reach,
    });
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

  reset(): void {
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

    const groundW = Math.min(this.width - 56, 220);
    const ground: Platform = {
      id: this.nextId++,
      x: this.width / 2,
      y: 0,
      w: groundW,
      gold: false,
      type: 'solid',
      crumble: 0,
      alive: true,
      taken: false,
    };
    this.platforms.push(ground);

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
    if (this.money > this.best.money || (this.money === this.best.money && h > this.best.height)) {
      this.best = { money: this.money, height: h };
      writeBest(this.best);
    }
    this.events.onEnd();
  }

  jump(dir: number): void {
    const plat = this.player.onGround;
    if (!plat) return;

    this.player.vy = -PARAMS.jumpV * this.jumpFactor();
    this.player.vx = dir * PARAMS.moveVX;
    this.player.dir = dir;
    this.player.onGround = null;

    this.squash = 0.86;
    this.puff(6, 0);
    this.events.onJump?.();

    if (plat.type === 'fiktif' && plat.crumble === 0) plat.crumble = 0.0001;
  }

  private puff(count: number, drift: number): void {
    for (let i = 0; i < count; i++) {
      this.dust.push({
        x: this.player.x + rand(-9, 9),
        y: this.player.y - 1,
        vx: rand(-30, 30) + drift,
        vy: rand(-52, -8),
        life: rand(0.22, 0.5),
        t: 0,
        r: rand(1.1, 2.4),
      });
    }
  }

  private land(plat: Platform): void {
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

    this.rebuildAhead();
  }

  // ---------- simulation ----------

  step(dt: number): void {
    if (this.phase !== 'playing') return;

    const p = this.player;
    const prevY = p.y;

    if (p.onGround && !p.onGround.alive) p.onGround = null;

    if (p.onGround) {
      p.x = clamp(p.x, 12, this.width - 12);
      p.y = p.onGround.y;
      p.vx = 0;
      p.vy = 0;
    } else {
      p.vy += PARAMS.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.x < 12) {
        p.x = 12;
        p.vx = 0;
      } else if (p.x > this.width - 12) {
        p.x = this.width - 12;
        p.vx = 0;
      }

      if (p.vy > 0) {
        for (const plat of this.platforms) {
          if (!plat.alive) continue;
          if (prevY <= plat.y && p.y >= plat.y && Math.abs(p.x - plat.x) <= plat.w / 2 + 6) {
            this.land(plat);
            break;
          }
        }
      }
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
            x: plat.x + rand(-plat.w / 2, plat.w / 2),
            y: plat.y + rand(0, 6),
            vx: rand(-46, 46),
            vy: rand(-34, 18),
            life: rand(0.3, 0.65),
            t: 0,
            r: rand(1, 2.6),
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

      if (
        Math.abs(a.x - p.x) < (a.w + 18) / 2 &&
        p.y - 30 < a.y + a.h / 2 &&
        p.y > a.y - a.h / 2
      ) {
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

    if (p.y > this.camY + this.height) {
      // Well below the last ledge means a missed jump; otherwise the audit
      // simply caught up with a player who could not climb fast enough.
      this.endRun(!p.onGround && p.y > this.lastFooting + 180 ? 'fall' : 'band');
    }
  }
}
