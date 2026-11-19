import { Game } from './game.ts';
import { WORLD_WIDTH } from './params.ts';
import type { FloorDef, Input } from './types.ts';

export const LIFT = { ledge: 1, top: 114, speed: 124, recall: 0.9 } as const;
export type LiftPhase = 'ready' | 'rising' | 'arrived' | 'returning';

/** This small room is not part of the tower or the saved floor list. */
export const ATRIUM: FloorDef = {
  id: 'kecamatan-atrium',
  name: 'Nomor Berikutnya',
  height: 492,
  ledges: [
    { x: 0, y: 0, w: WORLD_WIDTH },
    { x: 150, y: 0, w: 100 },
    { x: 270, y: LIFT.top, w: 114 },
  ],
  auditors: [],
  stamps: [],
  amplop: [],
  checkpoints: [{ ledge: 0, x: 42 }],
  exit: { ledge: 2, x: 350, label: 'VERIFIKASI' },
};

/** An automatic lift: stand on it to go up. It stays at the balcony while occupied. */
export class Atrium extends Game {
  liftPhase: LiftPhase = 'ready';
  private liftY = 0;
  private priorY = 0;
  private emptyFor = 0;

  constructor() {
    super({ floor: ATRIUM });
  }

  override reset(): void {
    this.liftPhase = 'ready';
    this.liftY = this.priorY = this.emptyFor = 0;
    super.reset();
  }

  override ledgeHeight(index: number, previous = false): number {
    return index === LIFT.ledge ? (previous ? this.priorY : this.liftY) : super.ledgeHeight(index, previous);
  }

  override step(dt: number, input?: Input): void {
    if (this.phase !== 'playing') return;
    const p = this.player;
    const { x, w } = ATRIUM.ledges[LIFT.ledge];
    this.priorY = this.liftY;

    if (this.liftPhase === 'ready' && p.ground >= 0 && p.y === 0 && p.x >= x + 5 && p.x <= x + w - 5) {
      // Flush with the lobby, so walking onto it boards without a jump or button.
      p.ground = LIFT.ledge;
      this.liftPhase = 'rising';
    }
    if (this.liftPhase === 'rising') {
      this.liftY = Math.min(LIFT.top, this.liftY + LIFT.speed * dt);
      if (this.liftY === LIFT.top) this.liftPhase = 'arrived';
    } else if (this.liftPhase === 'arrived') {
      this.emptyFor = p.ground === LIFT.ledge ? 0 : this.emptyFor + dt;
      if (this.emptyFor >= LIFT.recall) this.liftPhase = 'returning';
    } else if (this.liftPhase === 'returning') {
      this.liftY = Math.max(0, this.liftY - LIFT.speed * dt);
      if (this.liftY === 0) {
        this.emptyFor = 0;
        this.liftPhase = 'ready';
      }
    }

    super.step(dt, input);
  }
}
