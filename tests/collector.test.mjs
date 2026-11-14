import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { cleanModel, readAgent } from '../server/agent.mjs';
import { normaliseEvent, openStore } from '../server/store.mjs';

/** Rows straight from the database have no prototype; copy them to compare with plain objects. */
const plain = (rows) => rows.map((row) => ({ ...row }));

/** A browser build number as Chrome writes it: 130 -> "130.0.0.0". */
const build = (major) => [major, 0, 0, 0].join('.');

const ANDROID_CHROME = `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${build(130)} Mobile Safari/537.36`;
const SAMSUNG = `Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/${build(122)} Mobile Safari/537.36`;
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

test('a User-Agent header is reduced to a browser, a system, a kind of device and a model', () => {
  const read = (ua) => {
    const { browser, version, os, form, model } = readAgent(ua);
    return [browser, version, os, form, model];
  };
  assert.deepEqual(read(ANDROID_CHROME), ['Chrome', 130, 'Android', 'phone', null], 'Chrome hides the model');
  assert.deepEqual(read(SAMSUNG), ['Samsung Internet', 26, 'Android', 'phone', 'SM-A135F']);
  assert.deepEqual(read(IPHONE), ['Safari', 17, 'iOS', 'phone', 'iPhone']);
  assert.deepEqual(
    read(
      `Mozilla/5.0 (Linux; Android 11; Redmi Note 8 Build/RKQ1; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/${build(120)} Mobile Safari/537.36`,
    ),
    ['Android WebView', 120, 'Android', 'phone', 'Redmi Note 8'],
  );
  assert.deepEqual(
    read(
      `Mozilla/5.0 (Linux; Android 9; SM-T295) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${build(110)} Safari/537.36`,
    ),
    ['Chrome', 110, 'Android', 'tablet', 'SM-T295'],
  );
  assert.deepEqual(
    read(
      `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${build(130)} Safari/537.36 Edg/${build(130)}`,
    ),
    ['Edge', 130, 'Windows', 'desktop', null],
  );

  // A link opened inside an app is named by the app, not by the browser underneath.
  const app = (ua) => readAgent(ua).browser;
  assert.equal(
    app(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0 (iPhone14,5; iOS 17_5; id_ID; id; scale=3.00)',
    ),
    'Instagram',
  );
  assert.equal(
    app(
      `Mozilla/5.0 (Linux; Android 13; V2111; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/${build(119)} Mobile Safari/537.36 musical_ly_2023109030 BytedanceWebview/d8a21c6`,
    ),
    'TikTok',
  );
  assert.equal(
    app(
      `Mozilla/5.0 (Linux; Android 12; RMX3363 Build/SKQ1; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/${build(118)} Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/439.0.0.0;]`,
    ),
    'Facebook',
  );
  assert.equal(
    app(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/312.0.623379220 Mobile/15E148 Safari/604.1',
    ),
    'Google app',
  );

  assert.deepEqual(read(''), [null, null, null, null, null]);
  assert.deepEqual(read(undefined), [null, null, null, null, null]);
  assert.equal(readAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)').bot, true);
  assert.equal(readAgent(`Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/${build(130)}`).bot, true);
  assert.equal(readAgent(IPHONE).bot, false);

  assert.equal(cleanModel('  <script>X1</script>  '), 'scriptX1/script', 'markup is not kept');
  assert.equal(cleanModel('K'), null);
  assert.equal(cleanModel(42), null);
});

test('every event carries what the request said it was played in; a visit says its screen and clock', () => {
  const agent = readAgent(SAMSUNG);
  const visit = normaliseEvent(
    { type: 'visit', width: 412, installed: false, zone: 420, finishedBefore: true, model: 'SM-A546E' },
    agent,
  );
  assert.deepEqual(
    [visit.browser, visit.browserVersion, visit.os, visit.form, visit.model],
    ['Samsung Internet', 26, 'Android', 'phone', 'SM-A546E'],
    'the model the page was told beats the one in the header',
  );
  assert.deepEqual([visit.width, visit.installed, visit.zone, visit.finishedBefore], [412, 0, 420, 1]);

  const odd = normaliseEvent({ type: 'visit', width: 'wide', installed: 'yes', zone: 99999, model: 'K' }, agent);
  assert.deepEqual([odd.width, odd.installed, odd.zone, odd.model], [null, null, 840, 'SM-A135F']);

  // A run carries the browser too, but what only a visit says stays with the visit.
  const run = normaliseEvent({ type: 'run_ended', cause: 'finished', width: 400, zone: 420 }, readAgent(IPHONE));
  assert.deepEqual([run.browser, run.form, run.width, run.zone], ['Safari', 'phone', null, null]);
  assert.equal(normaliseEvent({ type: 'visit' }).browser, null, 'no header, no browser');
});

test('the statistics say what players come in, and when', () => {
  const store = openStore(':memory:');
  // 2026-11-13 is a Friday; 01:30 UTC is 08:30 WIB and 09:30 WITA.
  const at = Date.UTC(2026, 10, 13, 1, 30);
  const tooOld = Date.now() - 400 * 86_400_000;
  const add = (event, ua, ts = Date.now()) => store.insert(normaliseEvent(event, readAgent(ua)), ts);
  const insta =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0';

  add({ type: 'visit', width: 390, installed: true, zone: 420, finishedBefore: false }, IPHONE, at);
  add({ type: 'visit', width: 412, installed: false, zone: 480, finishedBefore: true }, SAMSUNG, at);
  add({ type: 'visit', width: 1280, zone: 420 }, `Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/${build(131)}`, at);
  add({ type: 'visit', width: 390, zone: 420 }, insta, at);
  add({ type: 'visit' }, `Mozilla/5.0 (Linux; Android 12; SM-A135F) SamsungBrowser/24.0 Chrome/${build(118)} Mobile`);
  add({ type: 'run_started' }, insta);
  add({ type: 'run_ended', cause: 'abandoned' }, insta);
  add({ type: 'run_started' }, IPHONE);
  add({ type: 'run_ended', cause: 'finished' }, IPHONE);
  add({ type: 'visit', width: 300 }, IPHONE, tooOld);

  const stats = store.stats(3650);
  const byName = Object.fromEntries(stats.browsers.map((row) => [row.name, row]));
  assert.deepEqual(byName['Samsung Internet'], {
    name: 'Samsung Internet',
    visits: 2,
    runs: 0,
    finished: 0,
    oldest: 24,
    common: 26,
    inApp: false,
  });
  assert.deepEqual(byName.Instagram, {
    name: 'Instagram',
    visits: 1,
    runs: 1,
    finished: 0,
    oldest: null,
    common: null,
    inApp: true,
  });
  assert.equal(byName.Safari.finished, 1);
  assert.deepEqual(plain(stats.systems)[0], { name: 'iOS', n: 3 });
  assert.deepEqual(plain(stats.forms), [
    { form: 'phone', visits: 5, runs: 2, finished: 1 },
    { form: 'desktop', visits: 1, runs: 0, finished: 0 },
  ]);
  assert.deepEqual(plain(stats.models), [
    { name: 'iPhone', n: 3 },
    { name: 'SM-A135F', n: 2 },
  ]);
  assert.deepEqual(stats.widths, [
    { name: 'narrow', n: 1 },
    { name: 'phone', n: 3 },
    { name: 'wide', n: 0 },
    { name: 'desktop', n: 1 },
  ]);
  assert.deepEqual(stats.visitors, {
    installed: { said: 2, yes: 1 },
    finishedBefore: { said: 2, yes: 1 },
  });
  assert.equal(stats.hours[8].n, 3, 'three at half past eight WIB');
  assert.equal(stats.hours[9].n, 1, 'one at half past nine WITA');
  assert.equal(stats.weekdays[5].n, 4, 'all on a Friday');
  assert.deepEqual(stats.zones, [
    { zone: 420, n: 3 },
    { zone: 480, n: 1 },
  ]);
  store.close();
});

/** Starts the collector on a free port with an empty database, and waits until it answers. */
async function collector(t) {
  const dir = mkdtempSync(join(tmpdir(), 'korupsi-collector-'));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [fileURLToPath(new URL('../server/index.mjs', import.meta.url))], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DB_PATH: join(dir, 'stats.db') },
    stdio: 'ignore',
  });
  t.after(() => {
    child.kill();
    rmSync(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) return base;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error('the collector did not start');
}

test('the collector stores beacons, and ignores crawlers, Do Not Track and Global Privacy Control', async (t) => {
  const base = await collector(t);
  const post = (body, headers = {}) =>
    fetch(`${base}/api/beacon`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': SAMSUNG, ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }).then((response) => response.status);

  assert.equal(await post({ type: 'visit', width: 412, zone: 420 }), 204);
  assert.equal(await post({ type: 'visit' }, { dnt: '1' }), 204);
  assert.equal(await post({ type: 'visit' }, { 'sec-gpc': '1' }), 204);
  assert.equal(await post({ type: 'visit' }, { 'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' }), 204);
  assert.equal(await post({ type: 'unknown' }), 422);
  assert.equal(await post('{not json'), 400);

  const stats = await (await fetch(`${base}/api/stats?days=7`)).json();
  assert.equal(stats.totals.visits, 1, 'only the one honest visit was stored');
  assert.deepEqual(
    stats.browsers.map((row) => [row.name, row.visits]),
    [['Samsung Internet', 1]],
  );
  assert.equal(stats.floor?.name, 'Kelurahan');
});
