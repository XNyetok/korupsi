import { expect, test } from '@playwright/test';
import { pressTouch } from './helpers.ts';

const PREVIEW = 'http://127.0.0.1:4174/prototype/kecamatan/';

test('the atrium can be finished and replayed with sound off', async ({ page, isMobile }) => {
  const errors: string[] = [];
  const beacons: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/beacon') beacons.push(request.url());
  });
  const pressRight = async () => {
    if (isMobile) return pressTouch(page, '#pad', 1, 'right');
    await page.keyboard.down('ArrowRight');
    return () => page.keyboard.up('ArrowRight');
  };
  const pressJump = async () => {
    if (isMobile) return pressTouch(page, '#btn-jump', 2);
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
