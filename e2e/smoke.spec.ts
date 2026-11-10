import { expect, test } from '@playwright/test';

import { leaveAndReturn, open, SEED, setParam, state, tap, unfreeze, waitForLanding, waitForPhase } from './helpers.ts';

test.describe('ready screen and input', () => {
  test('shows the version and the fixed seed', async ({ page }) => {
    const errors = await open(page);
    const card = page.locator('.card.ready');
    await expect(card.locator('.eyebrow')).toHaveText(/^v\d+\.\d+\.\d+$/);
    await expect(card.locator('.seed')).toHaveText(`Seed tetap ${SEED}`);
    expect(errors).toEqual([]);
  });

  test('a tap starts the run, and each half of the screen jumps its way', async ({ page }) => {
    const errors = await open(page);

    await tap(page, 'right');
    await waitForPhase(page, 'playing');
    await expect(page.locator('#overlay')).not.toHaveClass(/is-visible/);
    await expect(page.locator('body')).toHaveClass(/is-playing/);

    const start = await state(page);
    expect(start.seed.toString(36)).toBe(SEED);

    await tap(page, 'left');
    await waitForLanding(page);
    const afterLeft = await state(page);
    expect(afterLeft.dir).toBe(-1);
    expect(afterLeft.x).toBeLessThan(start.x);

    await tap(page, 'right');
    await waitForLanding(page);
    const afterRight = await state(page);
    expect(afterRight.dir).toBe(1);
    expect(afterRight.x).toBeGreaterThan(afterLeft.x);
    expect(afterRight.level).toBe(2);

    expect(errors).toEqual([]);
  });

  test('keys jump, and Space repeats the last direction', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard only');
    await open(page);

    await page.keyboard.press('Enter');
    await waitForPhase(page, 'playing');

    await page.keyboard.press('ArrowLeft');
    await waitForLanding(page);
    expect((await state(page)).dir).toBe(-1);

    const before = await state(page);
    await page.keyboard.press(' ');
    await waitForLanding(page);
    const after = await state(page);
    expect(after.dir).toBe(-1);
    expect(after.level).toBe(before.level + 1);

    await page.keyboard.press('d');
    await waitForLanding(page);
    expect((await state(page)).dir).toBe(1);
  });

  test('Space on the mute button toggles the sound, not a jump', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard only');
    await open(page);
    await page.keyboard.press('Enter');
    await waitForPhase(page, 'playing');

    const mute = page.locator('#mute');
    await mute.focus();
    const before = await state(page);
    await page.keyboard.press(' ');
    await expect(mute).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(300);
    expect((await state(page)).level).toBe(before.level);
  });
});

test.describe('pause', () => {
  test('a short absence shows the pause card, and a tap resumes', async ({ page }) => {
    await open(page);
    await tap(page, 'right');
    await waitForPhase(page, 'playing');

    await leaveAndReturn(page, 5_000, true);
    await waitForPhase(page, 'paused');
    const card = page.locator('#overlay .card');
    await expect(card.locator('.stamp')).toHaveText('dijeda');
    await expect(card.locator('.cta')).toHaveText('Tap untuk lanjut');

    // The tap that wakes the phone does nothing. The clock is frozen at the
    // moment of return, so this tap is always inside the 350 ms window.
    await tap(page, 'left');
    expect((await state(page)).phase).toBe('paused');

    await unfreeze(page);
    await page.waitForTimeout(400);
    const before = await state(page);
    await tap(page, 'left');
    await waitForPhase(page, 'playing');
    await expect(page.locator('#overlay')).not.toHaveClass(/is-visible/);
    // Resuming is not a jump.
    expect((await state(page)).level).toBe(before.level);
  });

  test('a minute away ends the run', async ({ page }) => {
    await open(page);
    await tap(page, 'right');
    await waitForPhase(page, 'playing');

    await leaveAndReturn(page, 61_000);
    await waitForPhase(page, 'over');
    expect((await state(page)).cause).toBe('abandoned');
    await expect(page.locator('#overlay .stamp')).toHaveText('ditinggal');
  });
});

test.describe('result screen', () => {
  async function endRun(page: import('@playwright/test').Page): Promise<void> {
    // Standing still always ends the run; a fast band makes it quick. The
    // band speed is read when a run starts, so set it first.
    await setParam(page, 'cameraBase', 600);
    await tap(page, 'right');
    await waitForPhase(page, 'over');
  }

  test('shows the outcome, the seed, and survives the tap that ended the run', async ({ page }) => {
    const errors = await open(page);
    await endRun(page);

    const card = page.locator('#overlay .card');
    await expect(card.locator('.stamp')).toHaveText(/ketinggalan|terjatuh/);
    await expect(card.locator('.money')).toHaveText('Rp 0');
    await expect(card.locator('.seed')).toHaveText(`Seed ${SEED}`);
    await expect(card.locator('.share')).toBeVisible();

    // A tap right after the end is ignored, so the result stays readable.
    await tap(page, 'left');
    expect((await state(page)).phase).toBe('over');

    await page.waitForTimeout(800);
    await setParam(page, 'cameraBase', 26);
    await tap(page, 'left');
    await waitForPhase(page, 'playing');
    expect((await state(page)).seed.toString(36)).toBe(SEED);

    expect(errors).toEqual([]);
  });

  test('sharing on a desktop copies the result', async ({ page, context, isMobile }) => {
    test.skip(isMobile, 'phones open the native share sheet');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page);
    await endRun(page);

    await page.locator('#overlay .share').click();
    await expect(page.locator('#toast')).toHaveText('Disalin ke papan klip');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(/^(Ketinggalan|Terjatuh): 0 amplop, Rp 0, \d+ m\.\nhttps:\/\/korupsi\.web\.id\/$/);
    // The share button must not restart the run underneath.
    expect((await state(page)).phase).toBe('over');
  });
});
