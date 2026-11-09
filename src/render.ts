import { PARAMS, PALETTE as C, type Auditor, type Platform } from './config';
import type { Game } from './game';

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawPlatform(ctx: CanvasRenderingContext2D, plat: Platform, camY: number): void {
  const top = plat.y - camY;
  const x = plat.x - plat.w / 2;

  if (!plat.alive) {
    if (plat.crumble <= 0) return;
    const fade = clamp(1 - (plat.crumble - PARAMS.crumbleDelay) / 0.3, 0, 1);
    if (fade <= 0) return;
    ctx.globalAlpha = fade * 0.45;
    ctx.fillStyle = C.paperDark;
    roundRect(ctx, x, top + (1 - fade) * 16, plat.w, 6, 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }

  const wobble = plat.crumble > 0 ? Math.sin(plat.crumble * 70) * 2.2 : 0;
  const bodyH = plat.type === 'krat' ? 13 : 11;

  // the shadow the ledge throws on the wall behind it
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  roundRect(ctx, x + wobble + 5, top + bodyH + 2, plat.w - 10, 4, 2);
  ctx.fill();

  if (plat.type === 'fiktif') {
    ctx.fillStyle = plat.gold ? 'rgba(227, 176, 75, 0.12)' : 'rgba(143, 134, 116, 0.1)';
    roundRect(ctx, x + wobble, top, plat.w, bodyH, 3);
    ctx.fill();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = plat.gold ? 'rgba(227, 176, 75, 0.9)' : 'rgba(143, 134, 116, 0.7)';
    ctx.lineWidth = 1.4;
    roundRect(ctx, x + wobble, top, plat.w, bodyH, 3);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    const g = ctx.createLinearGradient(0, top, 0, top + bodyH);
    if (plat.gold) {
      g.addColorStop(0, C.goldLight);
      g.addColorStop(1, C.goldDark);
    } else if (plat.type === 'krat') {
      g.addColorStop(0, '#A07C57');
      g.addColorStop(1, C.crateDark);
    } else {
      g.addColorStop(0, C.paper);
      g.addColorStop(1, C.paperMid);
    }
    ctx.fillStyle = g;
    roundRect(ctx, x + wobble, top, plat.w, bodyH, 3);
    ctx.fill();

    // the top edge is the part that catches the light
    ctx.fillStyle = plat.gold ? 'rgba(255, 246, 224, 0.7)' : 'rgba(255, 255, 255, 0.45)';
    ctx.fillRect(x + wobble + 4, top + 1.2, plat.w - 8, 1.3);

    if (plat.type === 'krat') {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        const lx = x + wobble + (plat.w * i) / 3;
        ctx.beginPath();
        ctx.moveTo(lx, top + 2);
        ctx.lineTo(lx, top + bodyH - 2);
        ctx.stroke();
      }
    }
  }

  if (plat.gold && !plat.taken) drawMoney(ctx, plat.x + wobble, top - 18);
}

function drawMoney(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  roundRect(ctx, -10, -5.5, 21, 14, 2);
  ctx.fill();

  ctx.fillStyle = '#F6E3B4';
  roundRect(ctx, -11, -8, 22, 14, 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(152, 109, 29, 0.6)';
  ctx.lineWidth = 1;
  roundRect(ctx, -11, -8, 22, 14, 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-10, -7);
  ctx.lineTo(0, 0);
  ctx.lineTo(10, -7);
  ctx.stroke();

  // wax seal: the envelope is official, that is the whole joke
  ctx.fillStyle = C.red;
  ctx.beginPath();
  ctx.arc(0, 1.5, 2.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawAuditor(ctx: CanvasRenderingContext2D, a: Auditor, camY: number): void {
  const y = a.y - camY;
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = C.red;
  roundRect(ctx, a.x - a.dir * 8 - a.w / 2, y - a.h / 2, a.w, a.h, 4);
  ctx.fill();
  roundRect(ctx, a.x - a.dir * 15 - a.w / 2, y - a.h / 2, a.w, a.h, 4);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = C.red;
  roundRect(ctx, a.x - a.w / 2, y - a.h / 2, a.w, a.h, 4);
  ctx.fill();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(a.x - a.w / 2 + 5, y - 3, a.w - 10, 4);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fillRect(a.x - a.w / 2 + 5, y - a.h / 2 + 3, a.w - 10, 2);
}

function drawPlayer(ctx: CanvasRenderingContext2D, game: Game): void {
  const { player, squash } = game;
  const x = player.x;
  const y = player.y - game.camY;
  const sx = squash;
  const sy = 2 - squash;

  if (player.onGround) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.beginPath();
    ctx.ellipse(x, y, 12, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const lean = player.onGround ? 0 : clamp(player.vx / 420, -0.14, 0.14);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.scale(sx, sy);

  ctx.fillStyle = '#161F29';
  roundRect(ctx, -7, -8, 14, 8, 2);
  ctx.fill();

  ctx.fillStyle = C.suit;
  roundRect(ctx, -9, -27, 18, 20, 4);
  ctx.fill();

  ctx.fillStyle = 'rgba(240, 233, 219, 0.9)';
  ctx.beginPath();
  ctx.moveTo(-4, -27);
  ctx.lineTo(0, -22);
  ctx.lineTo(4, -27);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = C.gold;
  ctx.beginPath();
  ctx.moveTo(0, -23);
  ctx.lineTo(3, -20);
  ctx.lineTo(0, -11);
  ctx.lineTo(-3, -20);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.arc(0, -33, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(-7.5, -36.5, 15, 3);

  ctx.strokeStyle = 'rgba(240, 233, 219, 0.16)';
  ctx.lineWidth = 1;
  roundRect(ctx, -9, -27, 18, 20, 4);
  ctx.stroke();

  ctx.restore();
}

function drawBand(ctx: CanvasRenderingContext2D, game: Game): void {
  const { width: W, height: H } = game;
  const bandH = 68;
  const y = H - bandH;

  const grad = ctx.createLinearGradient(0, y, 0, H);
  grad.addColorStop(0, 'rgba(217, 72, 59, 0)');
  grad.addColorStop(1, 'rgba(217, 72, 59, 0.4)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, y, W, bandH);

  // hazard tape: the audit is a place you can fall into
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y, W, bandH);
  ctx.clip();
  ctx.strokeStyle = 'rgba(217, 72, 59, 0.16)';
  ctx.lineWidth = 7;
  for (let i = -bandH; i < W + bandH; i += 26) {
    ctx.beginPath();
    ctx.moveTo(i, H + 6);
    ctx.lineTo(i + bandH, y - 6);
    ctx.stroke();
  }
  ctx.restore();

  ctx.setLineDash([9, 7]);
  ctx.strokeStyle = 'rgba(217, 72, 59, 0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(217, 72, 59, 0.9)';
  ctx.font = '700 9px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('TIM AUDIT', 12, H - 10);

  const closeness = clamp(1 - (game.camY + H - game.player.y) / 240, 0, 1);
  if (closeness > 0) {
    ctx.fillStyle = `rgba(217, 72, 59, ${0.05 + closeness * 0.15})`;
    ctx.fillRect(0, 0, W, H);
  }
}

export function draw(
  ctx: CanvasRenderingContext2D,
  game: Game,
  reducedMotion: boolean,
): void {
  const { width: W, height: H } = game;

  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = C.inkDeep;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, H * 0.04, 20, W / 2, H * 0.2, H * 0.85);
  glow.addColorStop(0, 'rgba(227, 176, 75, 0.09)');
  glow.addColorStop(0.5, 'rgba(227, 176, 75, 0.025)');
  glow.addColorStop(1, 'rgba(227, 176, 75, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  if (game.shake > 0 && !reducedMotion) {
    const s = game.shake * 7;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  // shelf lines: the only thing telling you how far you have climbed
  const gap = 88;
  const first = Math.ceil(game.camY / gap) * gap;
  for (let wy = first; wy < game.camY + H + gap; wy += gap) {
    const sy = wy - game.camY;
    ctx.fillStyle = 'rgba(240, 233, 219, 0.035)';
    ctx.fillRect(0, sy, W, 1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(0, sy + 1, W, 6);
  }

  ctx.fillStyle = 'rgba(240, 233, 219, 0.03)';
  ctx.fillRect(0, 0, 3, H);
  ctx.fillRect(W - 3, 0, 3, H);

  for (const plat of game.platforms) {
    const top = plat.y - game.camY;
    if (top < -60 || top > H + 60) continue;

    // Ledges behind the player stay visible, just dimmer with distance: the
    // route taken is part of the scenery, not something that vanished.
    let alpha = 1;
    if (plat !== game.player.onGround && plat.y > game.player.y) {
      alpha = clamp(1 - (plat.y - game.player.y) / (H * 0.95), 0.34, 1);
    }
    ctx.globalAlpha = alpha;
    drawPlatform(ctx, plat, game.camY);
    ctx.globalAlpha = 1;
  }

  for (const a of game.auditors) drawAuditor(ctx, a, game.camY);

  for (const d of game.dust) {
    const a = clamp(1 - d.t / d.life, 0, 1);
    ctx.fillStyle = `rgba(201, 192, 175, ${a * 0.5})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y - game.camY, d.r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (game.phase !== 'over') drawPlayer(ctx, game);

  ctx.textAlign = 'center';
  for (const f of game.floaters) {
    const life = clamp(1 - f.t / 1.2, 0, 1);
    const pop = 1 + Math.max(0, 0.22 - f.t) * 1.6;
    ctx.save();
    ctx.translate(f.x, f.y - game.camY);
    ctx.scale(pop, pop);
    ctx.font = '700 10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = `rgba(227, 176, 75, ${life})`;
    ctx.fillText(f.text, 0, 0);
    ctx.restore();
  }

  const vig = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.22, W / 2, H * 0.55, H * 0.85);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  drawBand(ctx, game);
}
