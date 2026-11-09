import {
  PARAMS,
  WORLD_WIDTH,
  type Auditor,
  type Best,
  type Cause,
  type Dust,
  type Floater,
  type Phase,
  type Platform,
  type PlatformType,
  type Player,
} from './config.ts';

const BEST_KEY = 'korupsi.best';

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Away longer than this and the run is over: the audit does not wait. */
export const AWAY_LIMIT_MS = 60_000;

/** The player's feet never get closer to a wall than this. */
export const PLAYER_EDGE = 12;
/** Ledges may reach this close to the wall, so a ledge can sit under a player pinned to it. */
const WALL_PAD = 6;
/** Empty space between the two ledges of a level. */
const LEDGE_GAP = 12;
/** A landing spot is at least this far inside the ledge it belongs to. */
const HOLD = 6;
/** Half the width in which an auditor touching the player catches them. */
const AUDITOR_REACH = 24;

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
  best: Best = readBest();
  /** Levels climbed this run: new ledges reached, not pixels. */
  level = 0;
  /** Seconds of actual play, pauses excluded. */
  elapsed = 0;

  private nextId = 1;
  /** The last ledge the player stood on. */
  private footing: Platform | null = null;
  private readonly events: GameEvents;

  constructor(events: GameEvents) {
    this.events = events;
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
    return Math.max(PARAMS.minFactor, 1 - PARAMS.weightPenalty * this.weight);
  }

  // ---------- world ----------

  private riskyType(): PlatformType {
    const r = Math.random();
    if (r < 0.66) return 'solid';
    if (r < 0.88) return 'krat';
    return 'fiktif';
  }

  /** Where a jump in this direction comes down: horizontal speed is constant, walls stop it. */
  private landingX(anchorX: number, dir: number, travel: number): number {
    return clamp(anchorX + dir * travel, PLAYER_EDGE, this.width - PLAYER_EDGE);
  }

  /**
   * One ledge on one side. `landing` is where the jump ends; `edge` is the
   * boundary with the other side's ledge, which this one may not cross.
   */
  private makeLedge(
    anchorX: number,
    y: number,
    dir: number,
    travel: number,
    landing: number,
    edge: number,
    gold: boolean,
  ): Platform {
    const w = gold ? rand(60, 74) : rand(84, 108);

    // Sit around the landing spot. The minimum offset keeps the pair reading
    // as left/right instead of bunched under the player; against a wall the
    // landing spot is the wall, so the ledge goes there.
    const pinned = landing !== anchorX + dir * travel;
    const jitter = rand(-w * 0.28, w * 0.28);
    let centre = pinned ? landing : anchorX + dir * Math.max(PARAMS.minLedgeOffset, travel + jitter);
    centre = clamp(centre, WALL_PAD + w / 2, this.width - WALL_PAD - w / 2);

    let x0 = centre - w / 2;
    let x1 = centre + w / 2;

    // Never reach into the other side's half.
    if (dir < 0) x1 = Math.min(x1, edge);
    else x0 = Math.max(x0, edge);

    // The landing spot must be on the ledge, whatever the clipping did.
    x0 = Math.max(WALL_PAD, Math.min(x0, landing - HOLD));
    x1 = Math.min(this.width - WALL_PAD, Math.max(x1, landing + HOLD));

    return {
      id: this.nextId++,
      x: (x0 + x1) / 2,
      y,
      w: x1 - x0,
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
    const travel = env.dxAt(dy);

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
    if (this.level < 1) {
      goldLeft = Math.random() < 0.5;
      goldRight = !goldLeft;
    }

    // Both sides always get a ledge. Near a wall the jump on that side ends at
    // the wall, so its ledge goes under the wall; the split between the two
    // sits between the landing spots, leaving each one a margin.
    const landLeft = this.landingX(anchorX, -1, travel);
    const landRight = this.landingX(anchorX, 1, travel);
    const lo = landLeft + HOLD + LEDGE_GAP / 2;
    const hi = landRight - HOLD - LEDGE_GAP / 2;
    const split = lo <= hi ? clamp((landLeft + landRight) / 2, lo, hi) : (landLeft + landRight) / 2;

    const y = anchorY - dy;
    const left = this.makeLedge(anchorX, y, -1, travel, landLeft, split - LEDGE_GAP / 2, goldLeft);
    const right = this.makeLedge(anchorX, y, 1, travel, landRight, split + LEDGE_GAP / 2, goldRight);
    this.platforms.push(left, right);

    this.maybeAddAuditor(anchorX, left, right, landLeft, landRight);
  }

  private maybeAddAuditor(
    anchorX: number,
    left: Platform,
    right: Platform,
    landLeft: number,
    landRight: number,
  ): void {
    if (this.level < 5) return;
    if (left.gold === right.gold) return;
    if (Math.random() > 0.5) return;

    const gold = left.gold ? left : right;
    const goldOnLeft = gold === left;

    // The auditor only guards the money. The safe jump runs from the anchor to
    // the safe landing spot, so the patrol stays clear of that whole path,
    // plus the reach of a catch and a margin.
    const clearance = AUDITOR_REACH + 6;
    const reach = gold.w / 2 + 26;
    const half = 15;
    let minX = Math.max(half, gold.x - reach);
    let maxX = Math.min(this.width - half, gold.x + reach);
    if (goldOnLeft) maxX = Math.min(maxX, Math.min(anchorX, landRight) - clearance);
    else minX = Math.max(minX, Math.max(anchorX, landLeft) + clearance);

    // Too little room to patrol without touching the safe path: no auditor.
    if (maxX - minX < 8) return;

    this.auditors.push({
      upper: gold,
      x: clamp(gold.x, minX, maxX),
      y: gold.y - 11,
      dir: Math.random() < 0.5 ? -1 : 1,
      speed: rand(34, 62),
      w: 30,
      h: 26,
      minX,
      maxX,
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
    this.level = 0;
    this.elapsed = 0;

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
    if (this.money > this.best.money || (this.money === this.best.money && h > this.best.height)) {
      this.best = { money: this.money, height: h };
      writeBest(this.best);
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
      p.x = clamp(p.x, PLAYER_EDGE, this.width - PLAYER_EDGE);
      p.y = p.onGround.y;
      p.vx = 0;
      p.vy = 0;
    } else {
      p.vy += PARAMS.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.x < PLAYER_EDGE) {
        p.x = PLAYER_EDGE;
        p.vx = 0;
      } else if (p.x > this.width - PLAYER_EDGE) {
        p.x = this.width - PLAYER_EDGE;
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

    if (p.y - this.camY > this.auditLine) {
      // Well below the last ledge means a missed jump; otherwise the audit
      // simply caught up with a player who could not climb fast enough.
      this.endRun(!p.onGround && p.y > this.lastFooting + 180 ? 'fall' : 'band');
    }
  }
}
