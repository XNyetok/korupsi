import { expect, type Page } from '@playwright/test';

/** The parts of `window.__korupsi` (exposed by `?debug=1`) the tests read. */
export interface Exposed {
  phase: 'ready' | 'playing' | 'paused' | 'over';
  seed: number;
  level: number;
  money: number;
  cause: string;
  player: { x: number; y: number; dir: number; onGround: unknown };
  params: Record<string, number>;
}

/** A fixed seed, so every run in these tests starts with the same levels. */
export const SEED = 'e2e1';

export async function open(page: Page, query = ''): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`/?debug=1&seed=${SEED}${query}`);
  await expect(page.locator('.card.ready')).toBeVisible();
  return errors;
}

export interface State {
  phase: Exposed['phase'];
  seed: number;
  level: number;
  cause: string;
  x: number;
  dir: number;
  grounded: boolean;
}

/** A plain copy of the game state, read in the page. */
export function state(page: Page): Promise<State> {
  return page.evaluate(() => {
    const g = (window as unknown as { __korupsi: Exposed }).__korupsi;
    return {
      phase: g.phase,
      seed: g.seed,
      level: g.level,
      cause: g.cause,
      x: g.player.x,
      dir: g.player.dir,
      grounded: g.player.onGround !== null,
    };
  });
}

/** Changes a tuning number for this page only, like the debug sliders do. */
export function setParam(page: Page, key: string, value: number): Promise<void> {
  return page.evaluate(([k, v]) => {
    (window as unknown as { __korupsi: Exposed }).__korupsi.params[k as string] = v as number;
  }, [key, value] as const);
}

export function waitForPhase(page: Page, phase: Exposed['phase'], timeout = 10_000): Promise<unknown> {
  return page.waitForFunction((want) => (window as unknown as { __korupsi: Exposed }).__korupsi.phase === want, phase, {
    timeout,
  });
}

/** Waits until the player stands on a ledge again. */
export function waitForLanding(page: Page): Promise<unknown> {
  return page.waitForFunction(() => {
    const g = (window as unknown as { __korupsi: Exposed }).__korupsi;
    return g.phase !== 'playing' || g.player.onGround !== null;
  });
}

/** A tap or click on the left or right half of the game. */
export async function tap(page: Page, side: 'left' | 'right'): Promise<void> {
  const box = await page.locator('#game').boundingBox();
  if (!box) throw new Error('the canvas has no box');
  const x = box.x + box.width * (side === 'left' ? 0.25 : 0.75);
  const y = box.y + box.height * 0.5;
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/**
 * Pretends the tab went to the background for `awayMs`, then came back. The
 * game measures the absence with performance.now, so the clock is moved too.
 * With `freeze`, the clock then stands still until `unfreeze`, so a check that
 * depends on "just came back" does not race the test's own speed.
 */
export async function leaveAndReturn(page: Page, awayMs: number, freeze = false): Promise<void> {
  await page.evaluate(
    ([ms, frozen]) => {
      const w = window as unknown as { __shift?: number; __frozenAt?: number | null };
      if (w.__shift === undefined) {
        const real = performance.now.bind(performance);
        w.__shift = 0;
        w.__frozenAt = null;
        performance.now = () => w.__frozenAt ?? real() + (w.__shift ?? 0);
      }
      let hidden = true;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      document.dispatchEvent(new Event('visibilitychange'));
      w.__shift = (w.__shift ?? 0) + (ms as number);
      if (frozen) w.__frozenAt = performance.now();
      hidden = false;
      document.dispatchEvent(new Event('visibilitychange'));
    },
    [awayMs, freeze] as const,
  );
}

export function unfreeze(page: Page): Promise<void> {
  return page.evaluate(() => {
    (window as unknown as { __frozenAt?: number | null }).__frozenAt = null;
  });
}
