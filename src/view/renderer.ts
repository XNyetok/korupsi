/**
 * Draws one frame: the sky, the wall, then everything that moves, back to
 * front. The canvas is a window on the tower at one pixel per unit; the page
 * scales it up without smoothing (platform/viewport.ts).
 */

import type { Game } from '../core/game.ts';
import { FILL, PARAMS, VIEW, WORLD_WIDTH as W } from '../core/params.ts';
import { auditorAt, ledgeX, stampAt } from '../core/tower.ts';
import type { GameEvent } from '../core/types.ts';
import { BASE, type Backdrop, PARALLAX, paintBackdrop } from './backdrop.ts';
import { Fx } from './fx.ts';
import { C } from './palette.ts';
import type { Ctx } from './pixel.ts';
import {
  drawAmplop,
  drawAuditLine,
  drawAuditor,
  drawCheckpoint,
  drawExit,
  drawLedge,
  drawPlayer,
  drawRail,
  drawStamp,
  type Pose,
} from './sprites.ts';

/** Where the player sits in the view, as a fraction up from the bottom. */
const FOCUS = 0.4;
/** How much of the camera's sideways travel the sky follows. */
const SKY_DRIFT = 0.6;

export class Renderer {
  private readonly ctx: Ctx;
  private readonly backdrop: Backdrop;
  private readonly fx = new Fx();
  private readonly reducedMotion: boolean;
  private viewW: number = W;
  private viewH: number = VIEW.minHeight;
  /** Rows at the bottom of the view that the touch controls cover. */
  private deck = 0;
  /** The height above the ground floor of the view's bottom row, and its left column. */
  private cam = -BASE;
  private camX = 0;
  private clock = 0;
  private stride = 0;
  /** A short trail of where the player just was, drawn while dashing. */
  private trail: { x: number; y: number; age: number }[] = [];

  constructor(ctx: Ctx, game: Game, reducedMotion: boolean) {
    this.ctx = ctx;
    this.backdrop = paintBackdrop(game.floor, FILL.maxHeight);
    this.reducedMotion = reducedMotion;
  }

  resize(viewW: number, viewH: number, deck = 0): void {
    this.viewW = viewW;
    this.viewH = viewH;
    this.deck = deck;
    this.ctx.imageSmoothingEnabled = false;
  }

  handle(events: GameEvent[]): void {
    for (const event of events) this.fx.handle(event);
  }

  /** Jump the camera to the player: after a restart there is nothing to pan across. */
  snap(game: Game): void {
    this.cam = this.target(game);
    this.camX = this.targetX(game);
    this.fx.clear();
    this.trail = [];
  }

  private target(game: Game): number {
    // The player stands clear of the touch controls, and at the bottom of the
    // climb the ground floor does too: the cellar is what shows under them.
    const focus = Math.max(this.viewH * FOCUS, this.deck + 14);
    const want = game.player.y - focus;
    return Math.max(-BASE - this.deck, Math.min(game.floor.height - this.viewH, want));
  }

  /** What the view shows right now: for `?debug=1` and the browser tests. */
  get frame(): { left: number; width: number; rows: number; deck: number; groundRow: number } {
    return {
      left: Math.round(this.camX),
      width: this.viewW,
      rows: this.viewH,
      deck: this.deck,
      groundRow: this.viewH + Math.round(this.cam),
    };
  }

  /** A view narrower than the tower keeps the player in the middle. */
  private targetX(game: Game): number {
    return Math.max(0, Math.min(W - this.viewW, game.player.x - this.viewW / 2));
  }

  draw(game: Game, dt: number): void {
    const { ctx, viewW, viewH } = this;
    const { floor, player: p } = game;
    const live = game.phase === 'playing';

    if (live) {
      this.clock += dt;
      this.fx.update(dt);
      this.stride += (Math.abs(p.vx) * dt) / 7;
    }

    // The camera eases after the player, quicker on the way down so a fall stays in view.
    const target = this.target(game);
    const rate = target < this.cam ? 12 : 7;
    this.cam += (target - this.cam) * (1 - Math.exp(-rate * dt));
    if (Math.abs(target - this.cam) < 0.05) this.cam = target;
    const cam = Math.round(this.cam);

    const targetX = this.targetX(game);
    this.camX += (targetX - this.camX) * (1 - Math.exp(-8 * dt));
    if (Math.abs(targetX - this.camX) < 0.05) this.camX = targetX;
    const camX = Math.round(this.camX);

    /** Screen row of a height above the ground floor. */
    const row = (y: number) => viewH - Math.round(y) + cam;
    const time = game.worldTime;

    ctx.save();
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, viewW, viewH);

    ctx.drawImage(
      this.backdrop.sky,
      -Math.round(camX * SKY_DRIFT),
      viewH - this.backdrop.sky.height + Math.round((cam + BASE + this.deck) * PARALLAX),
    );

    if (this.fx.shake > 0 && !this.reducedMotion) {
      const s = Math.ceil(this.fx.shake * 8);
      ctx.translate(Math.round((Math.random() - 0.5) * s), Math.round((Math.random() - 0.5) * s));
    }

    // From here on, x is a column of the tower.
    ctx.translate(-camX, 0);
    ctx.drawImage(this.backdrop.wall, 0, viewH - floor.height + cam);

    const visible = (y: number, margin = 60) => {
      const sy = row(y);
      return sy > -margin && sy < viewH + margin;
    };

    // ledges
    floor.ledges.forEach((def, i) => {
      if (!visible(def.y)) return;
      if (def.kind === 'troli' && def.travel) {
        drawRail(ctx, def.x - def.travel, def.x + def.travel + def.w, row(def.y));
      }
      const since = game.crumble[i] ?? 0;
      if (def.kind === 'fiktif' && since >= PARAMS.crumbleDelay) {
        // Gone; it blinks back in just before it can be stood on again.
        const left = PARAMS.crumbleDelay + PARAMS.crumbleReturn - since;
        if (left > 0.4 || Math.floor(this.clock * 12) % 2 === 0) return;
      }
      drawLedge(ctx, def, {
        x: ledgeX(def, time),
        sy: row(def.y),
        toGround: def.y,
        shaking: since > 0 && since < PARAMS.crumbleDelay,
        time: this.clock,
      });
    });

    // things on ledges
    floor.checkpoints.forEach((spot, i) => {
      const y = floor.ledges[spot.ledge]?.y ?? 0;
      if (i > 0 && visible(y)) drawCheckpoint(ctx, spot.x, row(y), game.checkpoint >= i, this.clock);
    });

    const exitY = floor.ledges[floor.exit.ledge]?.y ?? 0;
    if (visible(exitY)) drawExit(ctx, floor.exit.x, row(exitY), 'KECAMATAN');

    floor.amplop.forEach((a, i) => {
      if (!game.taken[i] && visible(a.y)) drawAmplop(ctx, a.x, row(a.y), this.clock);
    });

    for (const def of floor.stamps) {
      const y = floor.ledges[def.ledge]?.y ?? 0;
      if (visible(y, 100)) drawStamp(ctx, def.x, row(y), stampAt(def, time), this.clock);
    }

    for (const def of floor.auditors) {
      const y = floor.ledges[def.ledge]?.y ?? 0;
      if (!visible(y)) continue;
      const a = auditorAt(def, time);
      drawAuditor(ctx, {
        x: a.x,
        sy: row(y),
        facing: a.dir,
        pose: 'run',
        time: this.clock,
        stride: (time * def.speed) / 6,
        weight: 0,
      });
    }

    // the player
    const pose: Pose =
      game.caught > 0
        ? 'caught'
        : p.dashT > 0
          ? 'dash'
          : p.ground < 0
            ? p.vy > 0
              ? 'jump'
              : 'fall'
            : Math.abs(p.vx) > 8
              ? 'run'
              : 'idle';

    if (live) {
      if (pose === 'dash') this.trail.push({ x: p.x, y: p.y, age: 0 });
      for (const ghost of this.trail) ghost.age += dt;
      this.trail = this.trail.filter((ghost) => ghost.age < 0.18);
    }
    const look = { facing: p.facing, time: this.clock, stride: this.stride, weight: game.weight };
    for (const ghost of this.trail) {
      drawPlayer(ctx, { ...look, x: ghost.x, sy: row(ghost.y), pose: 'dash' }, 0.3);
    }

    // Caught: the player blinks in the orange vest until the respawn.
    if (!(game.caught > 0 && Math.floor(this.clock * 14) % 3 === 0)) {
      drawPlayer(ctx, { ...look, x: p.x, sy: row(p.y), pose });
    }

    drawAuditLine(ctx, row(game.auditLine), camX, viewW, viewH);
    this.fx.draw(ctx, row, camX, viewW);

    ctx.restore();

    if (this.fx.flash > 0 && !this.reducedMotion) {
      ctx.fillStyle = `rgba(217, 72, 59, ${Math.min(0.35, this.fx.flash * 1.6)})`;
      ctx.fillRect(0, 0, viewW, viewH);
    }
  }
}
