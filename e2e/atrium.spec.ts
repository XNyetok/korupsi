import { expect, type Page, test } from '@playwright/test';

const PREVIEW = 'http://127.0.0.1:4174/prototype/kecamatan/';

/** Same direction and jump actions as a player, without teleporting to the lift. */
async function pressThumb(page: Page, selector: string, pointerId: number, half = false) {
  const target = page.locator(selector);
  const box = await target.boundingBox();
  if (!box) throw new Error(`missing controls: ${selector}`);
  const event = {
    pointerId,
    pointerType: 'touch',
    bubbles: true,
    clientX: box.x + box.width * (half ? 0.75 : 0.5),
    clientY: box.y + box.height * 0.5,
  };
  await target.dispatchEvent('pointerdown', event);
  return () => target.dispatchEvent('pointerup', event);
}

test('the atrium can be finished and replayed with sound off', async ({ page, isMobile }) => {
  const errors: string[] = [];
  const beacons: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/beacon') beacons.push(request.url());
  });
  const pressRight = async () => {
    if (isMobile) return pressThumb(page, '#pad', 1, true);
    await page.keyboard.down('ArrowRight');
    return () => page.keyboard.up('ArrowRight');
  };
  const pressJump = async () => {
    if (isMobile) return pressThumb(page, '#btn-jump', 2);
    await page.keyboard.down('Space');
    return () => page.keyboard.up('Space');
  };
  const lift = page.locator('#lift-status');
  await page.clock.install();
  await page.goto(PREVIEW);
  const sound = page.getByRole('button', { name: 'Suara' });
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Mulai uji coba' }).click();

  let stop = await pressRight();
  await page.clock.runFor(1400);
  await stop();
  await expect(lift).toHaveText('Lift naik');

  await page.getByRole('button', { name: 'Jeda' }).click();
  await page.clock.runFor(2000);
  await expect(lift).toHaveText('Lift naik');
  await page.getByRole('button', { name: 'Lanjut' }).click();
  await page.clock.runFor(1200);
  await expect(lift).toHaveText('Tiba · lompat ke kanan');

  stop = await pressRight();
  await page.clock.runFor(535);
  const land = await pressJump();
  await page.clock.runFor(160);
  await land();
  await page.clock.runFor(1360);
  await stop();
  await expect(page.getByRole('heading', { name: 'Sampai verifikasi' })).toBeVisible();
  await page.getByRole('button', { name: 'Coba lagi' }).click();
  await expect(lift).toHaveText('Lift siap');
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect(beacons).toEqual([]);
  expect(errors).toEqual([]);
});

test('the production entry does not serve the prototype', async ({ request }) => {
  const response = await request.get('/prototype/kecamatan/', { headers: { accept: 'text/html' } });
  expect(await response.text()).not.toContain('Nomor Berikutnya');
});
