import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { cleanModel, readAgent } from '../server/agent.mjs';
import { mark, siteOf } from '../server/arrival.mjs';
import { addressBytes, openGeo } from '../server/geo.mjs';
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

/* ---------- Where a visit came from ---------- */

test('the site that linked here is kept as a name or a domain, never more', () => {
  assert.equal(siteOf('l.instagram.com'), 'instagram');
  assert.equal(siteOf('lm.facebook.com'), 'facebook');
  assert.equal(siteOf('t.co'), 'x');
  assert.equal(siteOf('www.google.co.id'), 'google');
  assert.equal(siteOf('www.tiktok.com'), 'tiktok');
  assert.equal(siteOf('berita.contoh.co.id'), 'contoh.co.id', 'a site under an Indonesian second level');
  assert.equal(siteOf('blog.example.com'), 'example.com');
  assert.equal(siteOf(''), 'direct', 'nothing linked here');
  assert.equal(siteOf('korupsi.web.id'), 'direct', 'the game itself is not a source');
  for (const junk of ['localhost', '192.168.1.1', 'example.com/path?q=1', 'a b.com', 42, null, undefined]) {
    assert.equal(siteOf(junk), null, String(junk));
  }

  assert.equal(mark(' IG_Story '), 'ig_story');
  assert.equal(mark('bagikan'), 'bagikan');
  for (const junk of ['', 'two words', 'x'.repeat(41), '<b>', 7]) assert.equal(mark(junk), null, String(junk));
});

test('a visit says where it came from, a run what came before it, a hidden page where it was left', () => {
  const visit = normaliseEvent({ type: 'visit', from: 'l.instagram.com', source: 'IG_story', campaign: 'Rilis' });
  assert.deepEqual([visit.referrer, visit.source, visit.campaign], ['instagram', 'ig_story', 'rilis']);

  const start = normaliseEvent({ type: 'run_started', from: '', attempt: 2, after: 'win', wait: 7 });
  assert.deepEqual([start.referrer, start.after, start.wait], ['direct', 'win', 7]);
  assert.equal(normaliseEvent({ type: 'run_started', after: 'lost' }).after, null);
  assert.equal(normaliseEvent({ type: 'run_ended', after: 'win', wait: 3 }).after, null, 'only a start says it');

  const hidden = normaliseEvent({ type: 'hidden', screen: 'result', visible: 95, part: 1, from: 'x.com' });
  assert.deepEqual([hidden.screen, hidden.visible, hidden.part, hidden.referrer], ['result', 95, 1, null]);
  assert.equal(normaliseEvent({ type: 'hidden', screen: 'menu' }).screen, null);

  assert.equal(normaliseEvent({ type: 'share_missed', via: 'cancelled' }).via, 'cancelled');
  assert.equal(normaliseEvent({ type: 'share_missed', via: 'saved' }).via, null);
  assert.equal(normaliseEvent({ type: 'shared', via: 'cancelled' }).via, null, 'a share is never a miss');
});

test('the statistics say where players come from, where they leave and what they do between runs', () => {
  const store = openStore(':memory:');
  const add = (event) => store.insert(normaliseEvent(event));
  add({ type: 'visit', from: 'l.instagram.com', source: 'ig_story', campaign: 'rilis' });
  add({ type: 'visit', from: 'l.instagram.com' });
  add({ type: 'visit', from: '', source: 'bagikan' });
  add({ type: 'run_started', from: 'l.instagram.com', attempt: 1, wait: 12 });
  add({ type: 'run_ended', from: 'l.instagram.com', cause: 'finished', attempt: 1 });
  add({ type: 'run_started', from: 'l.instagram.com', attempt: 2, after: 'win', wait: 5 });
  add({ type: 'run_started', from: '', source: 'bagikan', attempt: 1, wait: 30 });
  add({ type: 'run_started', from: '', source: 'bagikan', attempt: 2, after: 'restart' });
  add({ type: 'hidden', screen: 'title', visible: 4, part: 1 });
  add({ type: 'hidden', screen: 'result', visible: 90, part: 1 });
  add({ type: 'hidden', screen: 'playing', visible: 40, part: 1 });
  add({ type: 'hidden', screen: 'playing', visible: 20, part: 2 });
  add({ type: 'shared', via: 'shared' });
  add({ type: 'share_missed', via: 'cancelled' });
  add({ type: 'share_missed', via: 'cancelled' });
  add({ type: 'share_missed', via: 'failed' });

  const stats = store.stats(1);
  assert.deepEqual(plain(stats.sources), [
    { site: 'instagram', visits: 2, runs: 2, finished: 1 },
    { site: 'direct', visits: 1, runs: 2, finished: 0 },
  ]);
  assert.deepEqual(plain(stats.campaigns), [
    { source: 'bagikan', campaign: null, visits: 1, runs: 2, finished: 0 },
    { source: 'ig_story', campaign: 'rilis', visits: 1, runs: 0, finished: 0 },
  ]);
  assert.deepEqual(stats.leaving, {
    visits: 3,
    screens: [
      { screen: 'title', n: 1 },
      { screen: 'playing', n: 1 },
      { screen: 'paused', n: 0 },
      { screen: 'result', n: 1 },
    ],
    visible: 40,
    returned: 1,
  });
  assert.deepEqual(stats.cards, {
    title: { runs: 2, wait: 21 },
    result: { runs: 1, wait: 5 },
    restarts: 1,
  });
  assert.deepEqual(plain(stats.shareMisses), [
    { via: 'cancelled', n: 2 },
    { via: 'failed', n: 1 },
  ]);
  store.close();
});

/* ---------- Speed, sound and where errors happen ---------- */

test('a visit says how fast it was ready; a run how it was drawn and heard; an error where it happened', () => {
  const visit = normaliseEvent({ type: 'visit', ready: 1840.6, net: '3g', saveData: true, lang: 'id' });
  assert.deepEqual([visit.ready, visit.net, visit.saveData, visit.lang], [1841, '3g', 1, 'id']);
  const odd = normaliseEvent({ type: 'visit', ready: -5, net: '5g', saveData: 'on', lang: 'Bahasa Indonesia' });
  assert.deepEqual([odd.ready, odd.net, odd.saveData, odd.lang], [0, null, null, null]);

  const run = normaliseEvent({
    type: 'run_ended',
    cause: 'finished',
    fps: 58,
    slow: 7,
    audio: 'running',
    full: true,
    turns: 1,
  });
  assert.deepEqual([run.fps, run.slow, run.audio, run.full, run.turns], [58, 7, 'running', 1, 1]);
  assert.equal(normaliseEvent({ type: 'run_ended', audio: 'loud' }).audio, null);
  assert.equal(normaliseEvent({ type: 'run_ended', slow: 400 }).slow, 100);

  assert.equal(normaliseEvent({ type: 'error', message: 'boom', screen: 'paused' }).screen, 'paused');
  assert.equal(normaliseEvent({ type: 'error', message: 'boom', screen: 'menu' }).screen, null);
});

test('the statistics say how fast the game is ready, how smoothly it runs and whether it is heard', () => {
  const store = openStore(':memory:');
  const add = (event, ua = IPHONE) => store.insert(normaliseEvent(event, readAgent(ua)));
  add({ type: 'visit', ready: 900, net: '4g', saveData: false, lang: 'id' });
  add({ type: 'visit', ready: 2100, net: '4g', lang: 'id' });
  add({ type: 'visit', ready: 5000, net: '3g', saveData: true, lang: 'en' });
  add({ type: 'visit', ready: 700 }, `Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/${build(131)}`);
  const run = { type: 'run_ended', cause: 'abandoned', full: false, turns: 0 };
  add({ ...run, cause: 'finished', fps: 60, slow: 2, audio: 'running', full: true });
  add({ ...run, fps: 58, slow: 4, audio: 'running', turns: 2 });
  add({ ...run, fps: 30, slow: 40, audio: 'suspended' });
  add(
    { ...run, cause: 'finished', fps: 120, slow: 0, audio: 'none' },
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/${build(131)}`,
  );
  add({ type: 'error', message: 'boom', screen: 'playing' });
  add({ type: 'error', message: 'boom', screen: 'playing' });
  add({ type: 'error', message: 'boom', screen: 'result' }, SAMSUNG);

  const stats = store.stats(1);
  assert.deepEqual(stats.speed, {
    visits: 4,
    ready: 1500,
    nets: [
      { net: '4g', visits: 2, ready: 1500 },
      { net: '3g', visits: 1, ready: 5000 },
    ],
    saveData: { said: 2, yes: 1 },
  });
  assert.deepEqual(stats.frames, {
    runs: 4,
    fps: 59,
    smooth: { runs: 3, finished: 2 },
    choppy: { runs: 1, finished: 0 },
    byForm: [
      { form: 'phone', runs: 3, fps: 58 },
      { form: 'desktop', runs: 1, fps: 120 },
    ],
  });
  assert.deepEqual(stats.sounds, [
    { audio: 'running', runs: 2 },
    { audio: 'suspended', runs: 1 },
    { audio: 'none', runs: 1 },
  ]);
  assert.deepEqual(stats.display, { runs: 4, fullscreen: 1, turned: 1 });
  assert.deepEqual(plain(stats.languages), [
    { name: 'id', n: 2 },
    { name: 'en', n: 1 },
  ]);
  assert.deepEqual(stats.errors[0].screens, [
    { name: 'playing', n: 2 },
    { name: 'result', n: 1 },
  ]);
  assert.deepEqual(stats.errors[0].browsers, [
    { name: 'Safari', n: 2 },
    { name: 'Samsung Internet', n: 1 },
  ]);
  store.close();
});

/* ---------- The GeoIP lookup ---------- */

const temp = (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'korupsi-collector-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

/** Encodes a value the way a MaxMind DB stores it: enough of the format for a small fixture. */
function field(value) {
  const head = (type, size) => (type <= 7 ? Buffer.from([(type << 5) | size]) : Buffer.from([size, type - 7]));
  if (typeof value === 'string') {
    const text = Buffer.from(value, 'utf8');
    return Buffer.concat([head(2, text.length), text]);
  }
  if (typeof value === 'number') {
    const bytes = Buffer.alloc(4);
    bytes.writeUInt32BE(value);
    return Buffer.concat([head(6, 4), bytes]);
  }
  if (Array.isArray(value)) return Buffer.concat([head(11, value.length), ...value.map(field)]);
  const entries = Object.entries(value);
  return Buffer.concat([head(7, entries.length), ...entries.flatMap(([k, v]) => [field(k), field(v)])]);
}

/** Writes a MaxMind DB with the given IPv4 networks, each `a.b.c` (a /24) -> record. */
function geoFixture(path, networks) {
  const nodes = [[null, null]];
  const data = [];
  let offset = 0;
  for (const [network, record] of Object.entries(networks)) {
    const bytes = network.split('.').map(Number);
    let node = 0;
    for (let i = 0; i < 24; i++) {
      const bit = (bytes[i >> 3] >> (7 - (i & 7))) & 1;
      if (i === 23) {
        nodes[node][bit] = { data: offset };
      } else {
        if (nodes[node][bit] === null) nodes[node][bit] = nodes.push([null, null]) - 1;
        node = nodes[node][bit];
      }
    }
    const encoded = field(record);
    data.push(encoded);
    offset += encoded.length;
  }
  const tree = Buffer.alloc(nodes.length * 6);
  nodes.forEach((pair, n) => {
    pair.forEach((record, side) => {
      const value =
        record === null ? nodes.length : typeof record === 'number' ? record : nodes.length + 16 + record.data;
      tree.writeUIntBE(value, n * 6 + side * 3, 3);
    });
  });
  const meta = field({ node_count: nodes.length, record_size: 24, ip_version: 4, build_epoch: 1793491200 });
  writeFileSync(
    path,
    Buffer.concat([tree, Buffer.alloc(16), ...data, Buffer.from('\xab\xcd\xefMaxMind.com', 'latin1'), meta]),
  );
}

const PLACES = {
  '203.0.113': {
    country: { iso_code: 'ID' },
    subdivisions: [{ names: { en: 'Jambi' } }],
    city: { names: { en: 'Sungai Penuh' } },
    location: { latitude: 2 },
  },
  '198.51.100': { country: { iso_code: 'US' } },
};

test('an address is looked up to a country, a province and a town, and nothing else', (t) => {
  const file = join(temp(t), 'city.mmdb');
  geoFixture(file, PLACES);
  const geo = openGeo(file);
  t.after(() => geo.close());

  assert.equal(geo.built, '2026-11-01');
  assert.deepEqual(geo.lookup('203.0.113.77'), { country: 'ID', region: 'Jambi', city: 'Sungai Penuh' });
  assert.deepEqual(geo.lookup('::ffff:203.0.113.77'), { country: 'ID', region: 'Jambi', city: 'Sungai Penuh' });
  assert.deepEqual(geo.lookup('198.51.100.1'), { country: 'US', region: null, city: null });
  assert.equal(geo.lookup('192.0.2.1'), null, 'an address the database does not know');
  assert.equal(geo.lookup('2001:db8::1'), null, 'an IPv6 address in an IPv4 database');
  for (const junk of ['', 'nonsense', [999, 1, 1, 1].join('.'), null, undefined, '203.0.113']) {
    assert.equal(geo.lookup(junk), null);
  }
});

test('a missing or broken GeoIP file means no lookup, not a crash', (t) => {
  const dir = temp(t);
  assert.equal(openGeo(join(dir, 'nothing.mmdb')), null);
  writeFileSync(join(dir, 'junk.mmdb'), 'not a database');
  const error = t.mock.method(console, 'error', () => {});
  assert.equal(openGeo(join(dir, 'junk.mmdb')), null);
  assert.equal(error.mock.callCount(), 1);
});

test('IPv6 addresses are read in every spelling', () => {
  assert.deepEqual([...addressBytes('192.0.2.1')], [192, 0, 2, 1]);
  assert.deepEqual([...addressBytes('::ffff:192.0.2.1')], [192, 0, 2, 1]);
  assert.deepEqual([...addressBytes('2001:db8::1')], [0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  assert.deepEqual([...addressBytes('::1')].slice(-2), [0, 1]);
  assert.equal(addressBytes('2001:db8::g'), null);
});

test('a place is kept as a country code and two names, and counted for Indonesia', () => {
  const event = normaliseEvent({ type: 'visit' }, {}, { country: 'ID', region: 'Jambi', city: 'Sungai Penuh' });
  assert.deepEqual([event.country, event.region, event.city], ['ID', 'Jambi', 'Sungai Penuh']);
  const odd = normaliseEvent({ type: 'visit' }, {}, { country: 'Indonesia', region: 42, city: 'x'.repeat(200) });
  assert.deepEqual([odd.country, odd.region, odd.city.length], [null, null, 60]);
  assert.equal(normaliseEvent({ type: 'visit' }).country, null, 'no lookup, no place');

  const store = openStore(':memory:');
  const add = (where) => store.insert(normaliseEvent({ type: 'visit' }, {}, where));
  add({ country: 'ID', region: 'Jambi', city: 'Sungai Penuh' });
  add({ country: 'ID', region: 'Jambi', city: 'Jambi' });
  add({ country: 'ID', region: 'DKI Jakarta', city: 'Jakarta' });
  add({ country: 'US', region: 'Ohio', city: 'Columbus' });
  add(null);
  const stats = store.stats(1, { built: '2026-11-01' });
  assert.deepEqual(plain(stats.countries), [
    { name: 'ID', n: 3 },
    { name: 'US', n: 1 },
  ]);
  assert.deepEqual(plain(stats.regions), [
    { name: 'Jambi', n: 2 },
    { name: 'DKI Jakarta', n: 1 },
  ]);
  assert.equal(stats.cities.length, 3, 'only towns in Indonesia');
  assert.deepEqual(stats.geo, { available: true, built: '2026-11-01' });
  assert.deepEqual(store.stats(1).geo, { available: false, built: null });
  store.close();
});

/* ---------- The collector as a service ---------- */

/** Starts the collector on a free port with an empty database, and waits until it answers. */
async function collector(t, env = {}) {
  const dir = temp(t);
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [fileURLToPath(new URL('../server/index.mjs', import.meta.url))], {
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      DB_PATH: join(dir, 'stats.db'),
      GEO_DB: join(dir, 'none.mmdb'),
      ...env,
    },
    stdio: 'ignore',
  });
  t.after(() => child.kill());
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
  assert.deepEqual(stats.geo, { available: false, built: null }, 'no GeoIP file, no places');
});

test('the collector looks the address up, and keeps the place but not the address', async (t) => {
  const file = join(temp(t), 'city.mmdb');
  geoFixture(file, PLACES);
  const base = await collector(t, { GEO_DB: file });
  const status = await fetch(`${base}/api/beacon`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': IPHONE, 'x-real-ip': '203.0.113.77' },
    body: JSON.stringify({ type: 'visit' }),
  }).then((response) => response.status);
  assert.equal(status, 204);

  const stats = await (await fetch(`${base}/api/stats?days=1`)).json();
  assert.deepEqual(stats.regions, [{ name: 'Jambi', n: 1 }]);
  assert.deepEqual(stats.cities, [{ name: 'Sungai Penuh', n: 1 }]);
  assert.deepEqual(stats.geo, { available: true, built: '2026-11-01' });
  assert.ok(!JSON.stringify(stats).includes('203.0.113'), 'the address appears nowhere in the statistics');
});
