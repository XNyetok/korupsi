import { expect, type Page } from '@playwright/test';

/** The parts of `window.__korupsi` (exposed by `?debug=1`) the tests read and drive. */
export interface Exposed {
  phase: 'ready' | 'playing' | 'paused' | 'won';
  time: number;
  deaths: number;
  weight: number;
  checkpoint: number;
  hazards: boolean;
  player: { x: number; y: number; vx: number; facing: number; ground: number };
  floor: { exit: { ledge: number; x: number } };
  placeOn(ledge: number, x?: number): void;
}

/** Opens the page. `debug` adds `?debug=1` (the tests read the exposed state);
 *  pass false to check what a player without it sees. */
export async function open(page: Page, debug = true): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(debug ? '/?debug=1' : '/');
  await expect(page.locator('.card.title')).toBeVisible();
  return errors;
}

export interface State {
  phase: Exposed['phase'];
  time: number;
  deaths: number;
  weight: number;
  x: number;
  y: number;
  facing: number;
  ground: number;
}

/** A plain copy of the game state, read in the page. */
export function state(page: Page): Promise<State> {
  return page.evaluate(() => {
    const g = (window as unknown as { __korupsi: Exposed }).__korupsi;
    return {
      phase: g.phase,
      time: g.time,
      deaths: g.deaths,
      weight: g.weight,
      x: g.player.x,
      y: g.player.y,
      facing: g.player.facing,
      ground: g.player.ground,
    };
  });
}

export function waitForPhase(page: Page, phase: Exposed['phase'], timeout = 10_000): Promise<unknown> {
  return page.waitForFunction((want) => (window as unknown as { __korupsi: Exposed }).__korupsi.phase === want, phase, {
    timeout,
  });
}

/** Starts the run from the title card. */
export async function start(page: Page): Promise<void> {
  await page.locator('#overlay button.primary').click();
  await waitForPhase(page, 'playing');
}

/** Puts the player on a ledge, as `?debug=1` allows from the console. */
export function placeOn(page: Page, ledge: number, x?: number): Promise<void> {
  return page.evaluate(
    ([l, px]) => {
      (window as unknown as { __korupsi: Exposed }).__korupsi.placeOn(l as number, px as number | undefined);
    },
    [ledge, x] as const,
  );
}

/** Stands the player next to the door, so a few steps to the right win the floor. */
export function goToDoor(page: Page): Promise<void> {
  return page.evaluate(() => {
    const g = (window as unknown as { __korupsi: Exposed }).__korupsi;
    g.placeOn(g.floor.exit.ledge, g.floor.exit.x - 30);
  });
}

/** Pretends the tab went to the background and came back. */
export async function leaveAndReturn(page: Page): Promise<void> {
  await page.evaluate(() => {
    let hidden = true;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event('visibilitychange'));
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

/** Holds a touch control down for `ms`, the way a thumb does. */
export async function holdTouch(
  page: Page,
  selector: string,
  ms: number,
  at: 'left' | 'right' | 'centre' = 'centre',
): Promise<void> {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`${selector} has no box`);
  const x = box.x + box.width * (at === 'left' ? 0.25 : at === 'right' ? 0.75 : 0.5);
  const y = box.y + box.height / 2;
  const init = { bubbles: true, pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true };
  await page.locator(selector).dispatchEvent('pointerdown', init);
  await page.waitForTimeout(ms);
  await page.locator(selector).dispatchEvent('pointerup', init);
}
