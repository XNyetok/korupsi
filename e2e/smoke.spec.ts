import { expect, test } from '@playwright/test';

import { goToDoor, holdTouch, leaveAndReturn, open, placeOn, start, state, waitForPhase } from './helpers.ts';

test.describe('title and input', () => {
  test('shows the title card, the version and a crisp canvas', async ({ page }) => {
    const errors = await open(page);
    const card = page.locator('.card.title');
    await expect(card.locator('.logo')).toBeVisible();
    await expect(card.locator('.version')).toHaveText(/^v\d+\.\d+\.\d+$/);
    await expect(card.locator('button.primary')).toHaveText('Mulai');

    // The tower is 384 game pixels wide on every screen, scaled without smoothing.
    const canvas = page.locator('#game');
    expect(await canvas.evaluate((el: HTMLCanvasElement) => el.width)).toBe(384);
    expect(await canvas.evaluate((el) => getComputedStyle(el).imageRendering)).toBe('pixelated');
    const box = await canvas.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && box.width <= viewport.width && box.height <= viewport.height).toBe(true);

    expect(errors).toEqual([]);
  });

  test('the button starts the run and shows the HUD', async ({ page }) => {
    const errors = await open(page);
    await start(page);
    await expect(page.locator('#overlay')).not.toHaveClass(/is-visible/);
    await expect(page.locator('body')).toHaveClass(/is-playing/);
    await expect(page.locator('#hud-floor')).toHaveText('01 Kelurahan');
    await expect(page.locator('#hud-money')).toHaveText('Rp 0');
    await expect(page.locator('#hud-deaths')).toHaveText('OTT 0');
    expect(errors).toEqual([]);
  });

  test('keys run, jump and dash', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard only');
    await open(page);
    await page.keyboard.press('Enter');
    await waitForPhase(page, 'playing');
    const begin = await state(page);

    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(300);
    await page.keyboard.up('ArrowLeft');
    const left = await state(page);
    expect(left.x).toBeLessThan(begin.x - 10);
    expect(left.facing).toBe(-1);

    await page.keyboard.down('d');
    await page.waitForTimeout(300);
    await page.keyboard.up('d');
    const right = await state(page);
    expect(right.x).toBeGreaterThan(left.x + 10);
    expect(right.facing).toBe(1);

    await page.keyboard.down(' ');
    await page.waitForFunction(
      () => (window as unknown as { __korupsi: { player: { y: number } } }).__korupsi.player.y > 20,
    );
    await page.keyboard.up(' ');
    await page.waitForFunction(
      () => (window as unknown as { __korupsi: { player: { ground: number } } }).__korupsi.player.ground === 0,
    );

    const before = await state(page);
    await page.keyboard.press('Shift');
    await page.waitForTimeout(250);
    expect((await state(page)).x).toBeGreaterThan(before.x + 20);
  });

  test('the touch controls run and jump', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch only');
    await open(page);
    await expect(page.locator('#pad')).toBeHidden();
    await start(page);
    await expect(page.locator('#pad')).toBeVisible();
    await expect(page.locator('#btn-jump')).toBeVisible();
    const begin = await state(page);

    await holdTouch(page, '#pad', 300, 'left');
    const left = await state(page);
    expect(left.x).toBeLessThan(begin.x - 10);

    await holdTouch(page, '#pad', 300, 'right');
    expect((await state(page)).x).toBeGreaterThan(left.x + 10);

    await page.locator('#btn-jump').dispatchEvent('pointerdown', { pointerId: 9, pointerType: 'touch' });
    await page.waitForFunction(
      () => (window as unknown as { __korupsi: { player: { y: number } } }).__korupsi.player.y > 20,
    );
    await page.locator('#btn-jump').dispatchEvent('pointerup', { pointerId: 9, pointerType: 'touch' });
  });

  test('an envelope adds money and weight to the HUD', async ({ page }) => {
    await open(page);
    await start(page);
    await placeOn(page, 0, 340);
    await expect(page.locator('#hud-money')).toHaveText('Rp 500.000');
    await expect(page.locator('#hud-weight')).toHaveText('Beban 1');
  });

  test('an auditor means OTT and a trip back to the checkpoint', async ({ page }) => {
    const errors = await open(page);
    await start(page);
    // The first auditor walks the desk that is ledge 10.
    await placeOn(page, 10, 336);
    await expect(page.locator('#hud-deaths')).toHaveText('OTT 1');
    await page.waitForFunction(
      () => (window as unknown as { __korupsi: { player: { ground: number } } }).__korupsi.player.ground === 0,
    );
    expect((await state(page)).phase).toBe('playing');
    expect(errors).toEqual([]);
  });

  test('Space on the sound button toggles the sound, not a jump', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard only');
    await open(page);
    await page.keyboard.press('Enter');
    await waitForPhase(page, 'playing');

    const mute = page.locator('#mute');
    await mute.focus();
    await page.keyboard.press(' ');
    await expect(mute).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(200);
    expect((await state(page)).y).toBe(0);
  });
});

test.describe('pause', () => {
  test('leaving the tab pauses, and the button resumes', async ({ page }) => {
    await open(page);
    await start(page);

    await leaveAndReturn(page);
    await waitForPhase(page, 'paused');
    const card = page.locator('#overlay .card');
    await expect(card.locator('.stamp')).toHaveText('dijeda');

    const frozen = (await state(page)).time;
    await page.waitForTimeout(300);
    expect((await state(page)).time).toBe(frozen);

    await card.locator('button.primary').click();
    await waitForPhase(page, 'playing');
    await expect(page.locator('#overlay')).not.toHaveClass(/is-visible/);
  });

  test('Escape pauses and resumes, and the pause button pauses', async ({ page, isMobile }) => {
    await open(page);
    await start(page);

    await page.locator('#pause').click();
    await waitForPhase(page, 'paused');

    if (!isMobile) {
      await page.keyboard.press('Escape');
      await waitForPhase(page, 'playing');
      await page.keyboard.press('Escape');
      await waitForPhase(page, 'paused');
    }

    // "Ulang dari lobi" starts over.
    await page.locator('#overlay button.secondary').click();
    await waitForPhase(page, 'playing');
    expect((await state(page)).time).toBeLessThan(1);
  });
});

test.describe('result', () => {
  async function win(page: import('@playwright/test').Page): Promise<void> {
    await start(page);
    await goToDoor(page);
    await page.evaluate(() => {
      const g = (window as unknown as { __korupsi: { player: { x: number }; floor: { exit: { x: number } } } })
        .__korupsi;
      g.player.x = g.floor.exit.x;
    });
    await waitForPhase(page, 'won');
  }

  test('reaching the door shows the result, and playing again starts over', async ({ page }) => {
    const errors = await open(page);
    await win(page);

    const card = page.locator('#overlay .card.result');
    await expect(card.locator('.stamp')).toHaveText('lolos');
    await expect(card.locator('.big')).toHaveText(/^\d+:\d\d$/);
    await expect(card.locator('.stats')).toContainText('0/6');
    await expect(card.locator('.record')).toContainText('Rekor waktu baru');

    // The record survives a reload.
    await page.waitForTimeout(800);
    await card.locator('button.primary').click();
    await waitForPhase(page, 'playing');
    expect((await state(page)).ground).toBe(0);
    expect(errors).toEqual([]);
  });

  test('sharing on a desktop copies the result', async ({ page, context, isMobile }) => {
    test.skip(isMobile, 'phones open the native share sheet');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page);
    await win(page);

    await page.locator('#overlay .share').click();
    await expect(page.locator('#toast')).toHaveText('Disalin ke papan klip');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(
      /^Lolos dari Kelurahan dalam \d+:\d\d: 0 kali OTT, 0 amplop \(Rp 0\)\.\nhttps:\/\/korupsi\.web\.id\/$/,
    );
    expect((await state(page)).phase).toBe('won');
  });

  test('the debug handle is not there for players', async ({ page }) => {
    await open(page, false);
    expect(await page.evaluate(() => '__korupsi' in window)).toBe(false);
    await expect(page.locator('#debug')).toBeHidden();
  });
});
