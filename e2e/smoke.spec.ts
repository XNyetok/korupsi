import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { goToDoor, holdTouch, leaveAndReturn, open, placeOn, start, state, waitForPhase } from './helpers.ts';

test.describe('title and input', () => {
  test('shows the title card, the version and a crisp canvas', async ({ page, isMobile }) => {
    const errors = await open(page);
    const card = page.locator('.card.title');
    await expect(card.locator('.logo')).toBeVisible();
    await expect(card.locator('.version')).toHaveText(/^v\d+\.\d+\.\d+$/);
    await expect(card.locator('button.primary')).toHaveText('Mulai');

    // The canvas is a window on a tower 384 game pixels wide, scaled without
    // smoothing. With a mouse it shows the full width, in a box; on a touch
    // screen it fills the screen and may show a slice.
    const canvas = page.locator('#game');
    const width = await canvas.evaluate((el: HTMLCanvasElement) => el.width);
    expect(await canvas.evaluate((el) => getComputedStyle(el).imageRendering)).toBe('pixelated');
    const box = await canvas.boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) throw new Error('no canvas box');
    if (isMobile) {
      expect(width).toBeGreaterThanOrEqual(216);
      expect(width).toBeLessThanOrEqual(384);
      expect(Math.abs(box.width - viewport.width)).toBeLessThan(1);
      expect(Math.abs(box.height - viewport.height)).toBeLessThan(1);
    } else {
      expect(width).toBe(384);
      expect(box.width <= viewport.width && box.height <= viewport.height).toBe(true);
    }

    // Full screen is offered exactly where the browser has it.
    const able = await page.evaluate(() => document.fullscreenEnabled);
    await expect(page.locator('#full')).toBeVisible({ visible: able });

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

  test('a double tap on the controls cannot zoom the page', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch only');
    await open(page);
    await start(page);

    // Safari zooms on a double tap unless the touch is cancelled, so every
    // touch outside a real button or a card must be.
    const cancelled = (selector: string) =>
      page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error(`${sel} is missing`);
        return ['touchstart', 'touchend', 'dblclick'].map(
          (type) => !el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true })),
        );
      }, selector);

    for (const selector of ['#btn-jump', '#btn-dash', '#pad', '#game', '#stage']) {
      expect(await cancelled(selector), selector).toEqual([true, true, true]);
    }
    // Real buttons keep their taps: a cancelled touch would never become a click.
    expect(await cancelled('#pause')).toEqual([false, false, false]);

    expect(await page.evaluate(() => getComputedStyle(document.body).touchAction)).toBe('none');
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('#pause') as Element).touchAction)).toBe(
      'manipulation',
    );
  });

  test('on a phone the player stays in view and clear of the controls', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch only');
    await open(page);
    await start(page);

    // The far right of the lobby, then the far left: the camera follows.
    for (const x of [370, 14]) {
      await placeOn(page, 0, x);
      await page.waitForTimeout(700);
      const seen = await page.evaluate(() => {
        const g = (window as unknown as { __korupsi: { player: { x: number } } }).__korupsi;
        const view = (
          window as unknown as {
            __view: { left: number; width: number; groundRow: number; rows: number; deck: number };
          }
        ).__view;
        return { x: g.player.x, ...view };
      });
      expect(seen.x).toBeGreaterThanOrEqual(seen.left);
      expect(seen.x).toBeLessThanOrEqual(seen.left + seen.width);
      // The ground floor is drawn above the rows the controls cover.
      expect(seen.groundRow).toBeLessThanOrEqual(seen.rows - seen.deck);
    }
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

  test('sharing without a share sheet saves the result as a story-sized picture', async ({ page }) => {
    await open(page);
    await win(page);

    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#overlay .share').click()]);
    expect(download.suggestedFilename()).toBe('korupsi-kelurahan.png');
    await expect(page.locator('#toast')).toHaveText('Gambar hasil disimpan');

    // A PNG says its size in the first chunk: 1080 x 1920, the shape of a story.
    const path = await download.path();
    const bytes = readFileSync(path);
    expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1080, 1920]);
    expect(bytes.length).toBeGreaterThan(5_000);

    // The share button must not restart the run underneath.
    expect((await state(page)).phase).toBe('won');
  });

  test('sharing on a phone hands the picture to the share sheet', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the share sheet is a phone thing');
    // A headless browser has no share sheet: stand in for it and keep what it was given.
    await page.addInitScript(() => {
      const w = window as unknown as { __shared?: { files: number; type: string; size: number; text: string } };
      navigator.canShare = (data?: ShareData) => Boolean(data?.files?.length);
      navigator.share = async (data?: ShareData) => {
        const file = data?.files?.[0];
        w.__shared = {
          files: data?.files?.length ?? 0,
          type: file?.type ?? '',
          size: file?.size ?? 0,
          text: data?.text ?? '',
        };
      };
    });
    await open(page);
    await win(page);

    await page.locator('#overlay .share').click();
    await page.waitForFunction(() => '__shared' in window);
    const shared = await page.evaluate(
      () => (window as unknown as { __shared: { files: number; type: string; size: number; text: string } }).__shared,
    );
    expect(shared.files).toBe(1);
    expect(shared.type).toBe('image/png');
    expect(shared.size).toBeGreaterThan(5_000);
    expect(shared.text).toMatch(
      /^Lolos dari Kelurahan dalam \d+:\d\d: 0 kali OTT, 0 amplop \(Rp 0\)\. https:\/\/korupsi\.web\.id\/$/,
    );
    // The sheet took it, so nothing is saved and nothing needs saying.
    await expect(page.locator('#toast')).not.toHaveClass(/is-visible/);
  });

  test('the debug handle is not there for players', async ({ page }) => {
    await open(page, false);
    expect(await page.evaluate(() => '__korupsi' in window)).toBe(false);
    await expect(page.locator('#debug')).toBeHidden();
  });
});
