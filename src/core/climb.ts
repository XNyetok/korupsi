import { Game } from './game.ts';
import type { BestStore, FloorDef } from './types.ts';

/** The floors in one climb. Each game keeps its own physics, clock and record. */
export class Climb {
  private readonly games: readonly Game[];
  private current: Game;
  private floorNumber = 1;
  private deposited = 0;

  constructor([first, ...above]: readonly [FloorDef, ...FloorDef[]], storeFor: (floorId: string) => BestStore) {
    const makeGame = (floor: FloorDef) => new Game({ floor, store: storeFor(floor.id) });
    this.current = makeGame(first);
    this.games = [this.current, ...above.map(makeGame)];
  }

  get game(): Game {
    return this.current;
  }

  get number(): number {
    return this.floorNumber;
  }

  get nextFloor(): FloorDef | undefined {
    return this.games[this.floorNumber]?.floor;
  }

  /** A finish at the door opens the next floor, even if the player leaves then. */
  get highestUnlocked(): number {
    const firstUnfinished = this.games.findIndex((game) => game.best.time <= 0);
    return firstUnfinished < 0 ? this.games.length : firstUnfinished + 1;
  }

  /** What was paid upstairs, plus what is still in the bag. */
  get money(): number {
    return this.deposited + this.current.money;
  }

  returnToTitle(): void {
    this.deposited = 0;
    this.current = this.games[0];
    this.floorNumber = 1;
    this.current.reset();
  }

  /** Starting from the title is a fresh climb, not a continuation of an old score. */
  startAt(number: number): boolean {
    if (!Number.isInteger(number) || number < 1 || number > this.highestUnlocked) return false;
    const game = this.games[number - 1];
    this.deposited = 0;
    this.enter(game, number);
    return true;
  }

  /** Leave a won floor for the one above it. The bag is paid in, not carried up. */
  promote(): boolean {
    const next = this.games[this.floorNumber];
    if (this.current.phase !== 'won' || !next) return false;
    this.deposited += this.current.money;
    this.enter(next, this.floorNumber + 1);
    return true;
  }

  private enter(game: Game, number: number): void {
    this.current = game;
    this.floorNumber = number;
    game.worldTime = 0;
    game.reset();
    game.start();
  }
}
