import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { cleanModel, IN_APP } from './agent.mjs';
import { redactMessage } from './redact.mjs';

export const EVENT_TYPES = new Set(['visit', 'run_started', 'run_ended', 'shared', 'error', 'band_warned']);

// `finished` is a floor cleared, `abandoned` a run the player left. The others
// are how runs of the first version of the game ended; its rows are still stored.
const CAUSES = new Set(['finished', 'abandoned', 'auditor', 'band', 'fall']);

/** Numbers arrive from the network, so every one of them is bounded here. Missing stays missing. */
const clampInt = (value, min, max) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n)));
};

const flag = (value) => (typeof value === 'boolean' ? Number(value) : null);

const clip = (value, max) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed ? trimmed.slice(0, max) : null;
};

const DEVICES = new Set(['touch', 'keys']);
const LAYOUTS = new Set(['window', 'fill-tall', 'fill-wide']);
const SHARE_VIA = new Set(['shared', 'saved', 'show', 'copied']);

const oneOf = (set, value) => (set.has(value) ? value : null);

/** A hazard is named by what it is and the ledge it is on (src/core/tower.ts), or `jatuh` for a fall. */
const HAZARD = /^(?:(?:auditor|stempel):\d{1,3}|jatuh)$/;
const MAX_HAZARDS = 24;

/**
 * How often each hazard caught the player in one run, as a small JSON object
 * with its keys in order, or null. Anything that is not a known hazard name
 * with a sane count is dropped.
 */
function hazardTally(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const clean = {};
  for (const key of Object.keys(input)
    .sort()
    .slice(0, MAX_HAZARDS * 4)) {
    if (!HAZARD.test(key)) continue;
    const n = clampInt(input[key], 0, 999);
    if (!n) continue;
    clean[key] = n;
    if (Object.keys(clean).length >= MAX_HAZARDS) break;
  }
  return Object.keys(clean).length ? JSON.stringify(clean) : null;
}

// How a run was played (src/core/report.ts). Each part is checked on its own
// and kept as a small JSON value; a part that is not what the game sends is
// dropped, and the rest of the run is still stored.

/** Checkpoints after the lobby, catch positions and ledges a run can report at most. */
const MAX_STOPS = 8;
const MAX_SPOTS = 30;
const MAX_LEDGES = 64;
const RECORDS = new Set(['time', 'money', 'both']);

/** Run-clock seconds at which each checkpoint was reached, in order; null where one was skipped. */
function splitList(input) {
  if (!Array.isArray(input) || !input.length) return null;
  return JSON.stringify(input.slice(0, MAX_STOPS).map((t) => clampInt(t, 0, 3600)));
}

/** Where catches happened: [x, y, envelopes carried] in game pixels. */
function spotList(input) {
  if (!Array.isArray(input)) return null;
  const clean = [];
  for (const spot of input.slice(0, MAX_SPOTS)) {
    if (!Array.isArray(spot) || spot.length !== 3) continue;
    const point = [clampInt(spot[0], 0, 999), clampInt(spot[1], 0, 9999), clampInt(spot[2], 0, 99)];
    if (point.every((n) => n != null)) clean.push(point);
  }
  return clean.length ? JSON.stringify(clean) : null;
}

/** Envelope indices, each once and in order. An empty list is an answer too: none. */
function indexList(input) {
  if (!Array.isArray(input)) return null;
  const clean = new Set(input.slice(0, 64).filter((i) => Number.isInteger(i) && i >= 0 && i < 64));
  return JSON.stringify([...clean].sort((a, b) => a - b));
}

/** One number per weight carried, from nothing up: seconds, or catches. */
function weightList(input, top) {
  if (!Array.isArray(input) || !input.length) return null;
  return JSON.stringify(input.slice(0, 16).map((n) => clampInt(n, 0, top) ?? 0));
}

/** Seconds stood on each ledge, by its index in the floor's `ledges`. */
function dwellMap(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const clean = {};
  for (const key of Object.keys(input).slice(0, MAX_LEDGES * 4)) {
    if (!/^\d{1,2}$/.test(key)) continue;
    const seconds = clampInt(input[key], 0, 3600);
    if (seconds) clean[Number(key)] = seconds;
    if (Object.keys(clean).length >= MAX_LEDGES) break;
  }
  return Object.keys(clean).length ? JSON.stringify(clean) : null;
}

/**
 * What a browser reports instead of an error thrown by a script from another
 * origin: no detail, no file, no line. The game loads no such script; these
 * come from what extensions and in-app browsers add to the page. The game no
 * longer sends them, but a page opened before that still can.
 */
const HIDDEN_ERROR = /^Script error\.?$/;

/** The message to keep for an error, or null when it says nothing worth keeping. */
function errorMessage(raw) {
  const message = redactMessage(raw);
  return message && !HIDDEN_ERROR.test(message) ? message : null;
}

/** The columns of the first schema. */
const FIRST_COLUMNS = ['type', 'rev', 'cause', 'money', 'weight', 'height', 'duration', 'message'];

/** The columns added after the first schema, with their types: old databases get them on opening. */
const ADDED_COLUMNS = {
  deaths: 'INTEGER',
  checkpoint: 'INTEGER',
  hazards: 'TEXT',
  title: 'TEXT',
  muted: 'INTEGER',
  device: 'TEXT',
  layout: 'TEXT',
  via: 'TEXT',
  splits: 'TEXT',
  spots: 'TEXT',
  lastHazard: 'TEXT',
  sinceCaught: 'INTEGER',
  picked: 'TEXT',
  kept: 'TEXT',
  lost: 'INTEGER',
  carried: 'TEXT',
  caughtWith: 'TEXT',
  jumps: 'INTEGER',
  dashes: 'INTEGER',
  dwell: 'TEXT',
  attempt: 'INTEGER',
  pauses: 'INTEGER',
  away: 'INTEGER',
  finishedBefore: 'INTEGER',
  record: 'TEXT',
  browser: 'TEXT',
  browserVersion: 'INTEGER',
  os: 'TEXT',
  form: 'TEXT',
  model: 'TEXT',
  installed: 'INTEGER',
  width: 'INTEGER',
  zone: 'INTEGER',
  country: 'TEXT',
  region: 'TEXT',
  city: 'TEXT',
};

/** Every column an event fills, in the order they are inserted. */
const COLUMNS = [...FIRST_COLUMNS, ...Object.keys(ADDED_COLUMNS)];

/**
 * Returns the row to store, or null when the event is not worth keeping.
 * Everything that is not on this list is dropped, including extra fields.
 *
 * `agent` is what server/agent.mjs read from the User-Agent header, and
 * `where` what server/geo.mjs found for the address the beacon came from;
 * neither the header nor the address is part of the row.
 */
export function normaliseEvent(input, agent = {}, where = null) {
  if (!input || typeof input !== 'object') return null;
  if (!EVENT_TYPES.has(input.type)) return null;

  const event = Object.fromEntries(COLUMNS.map((column) => [column, null]));
  event.type = input.type;
  event.rev = clip(input.rev, 40);
  // What the player holds, and how the game sits on their screen: said with
  // a visit and with a run, so a run can be read by device.
  event.device = oneOf(DEVICES, input.device);
  event.layout = oneOf(LAYOUTS, input.layout);
  // What it was played in, read from the request rather than said by the page.
  event.browser = agent.browser ?? null;
  event.browserVersion = agent.version ?? null;
  event.os = agent.os ?? null;
  event.form = agent.form ?? null;
  event.model = agent.model ?? null;
  event.country = typeof where?.country === 'string' && /^[A-Z]{2}$/.test(where.country) ? where.country : null;
  event.region = clip(where?.region, 60);
  event.city = clip(where?.city, 60);

  if (input.type === 'visit') {
    // Chrome names the phone only when the page asks, so the page may say it.
    event.model = cleanModel(input.model) ?? event.model;
    event.installed = flag(input.installed);
    event.width = clampInt(input.width, 100, 9999);
    // Minutes ahead of UTC on the player's clock: 420 is WIB, 480 WITA, 540 WIT.
    event.zone = clampInt(input.zone, -720, 840);
    event.finishedBefore = flag(input.finishedBefore);
  }

  if (input.type === 'run_started' || input.type === 'run_ended') {
    // Which run of the visit this is, the first being 1: counted in the page, never stored there.
    event.attempt = clampInt(input.attempt, 1, 999);
  }

  if (input.type === 'run_ended') {
    event.cause = CAUSES.has(input.cause) ? input.cause : null;
    event.money = clampInt(input.money, 0, 1_000_000_000);
    event.weight = clampInt(input.weight, 0, 99);
    event.height = clampInt(input.height, 0, 200_000);
    event.duration = clampInt(input.duration, 0, 3600);
    event.deaths = clampInt(input.deaths, 0, 9999);
    event.checkpoint = clampInt(input.checkpoint, 0, 99);
    event.hazards = hazardTally(input.hazards);
    event.title = typeof input.title === 'string' && /^[a-z]{2,16}$/.test(input.title) ? input.title : null;
    event.muted = flag(input.muted);

    event.splits = splitList(input.splits);
    event.spots = spotList(input.spots);
    event.lastHazard = typeof input.lastHazard === 'string' && HAZARD.test(input.lastHazard) ? input.lastHazard : null;
    event.sinceCaught = clampInt(input.sinceCaught, 0, 3600);
    event.picked = indexList(input.picked);
    event.kept = indexList(input.kept);
    event.lost = clampInt(input.lost, 0, 999);
    event.carried = weightList(input.carried, 3600);
    event.caughtWith = weightList(input.caughtWith, 9999);
    event.jumps = clampInt(input.jumps, 0, 99_999);
    event.dashes = clampInt(input.dashes, 0, 99_999);
    event.dwell = dwellMap(input.dwell);
    event.pauses = clampInt(input.pauses, 0, 999);
    event.away = clampInt(input.away, 0, 999);
    event.finishedBefore = flag(input.finishedBefore);
    event.record = event.cause === 'finished' ? oneOf(RECORDS, input.record) : null;
  }

  if (input.type === 'shared') event.via = oneOf(SHARE_VIA, input.via);

  if (input.type === 'error') {
    event.message = errorMessage(input.message);
    if (!event.message) return null;
  }

  return event;
}

/**
 * The floor the numbers are about (written by scripts/floor.mjs from
 * src/core/tower.ts). Sent with the statistics, so positions and ledge
 * numbers can be read without the source. Without the file, it is null.
 */
function readFloor() {
  try {
    return JSON.parse(readFileSync(new URL('./floor.json', import.meta.url), 'utf8'));
  } catch {
    return null;
  }
}

/** Bumped when the shape of the statistics changes, so a reader knows what it is holding. */
const STATS_FORMAT = 5;

/**
 * What every part of the statistics means, sent with them. The answer is read
 * by people through the panel and by programs as it is; this is for the
 * programs, and for anyone who opens the file a month later.
 */
const ABOUT = {
  purpose:
    'Anonymous, aggregate telemetry of the browser game Korupsi (korupsi.web.id) for the last `days` days, starting on `since` (UTC days). No cookies, no addresses, no identifiers: nothing here can be tied to a person, and two rows cannot be tied to the same player.',
  units:
    'Durations are seconds. Heights are metres above the lobby floor (12 game pixels to the metre); the door of the first floor is at about 42 m. Money is rupiah: 500000 per envelope. Medians are null when there are no rows to take them from.',
  totals:
    'visits: page loads. runs: presses of Mulai or Main lagi, so one visit can start several. ended: runs that reported an ending. finished: runs that reached the door. shared: uses of Bagikan hasil. errors: JavaScript errors from the game in players\u2019 browsers.',
  daily: 'The same counts per UTC day. Days without events are absent, not zero.',
  causes:
    'How runs ended. finished: reached the door. abandoned: the page was closed, or the run restarted, before the door. auditor, band, fall: endings of the one-tap game before v0.5.0, kept until they age out.',
  finished:
    'Runs that reached the door: how many, and the median duration, money, envelopes (weight) and times caught (deaths).',
  abandoned: 'Runs left before the door: how many, and the median duration, highest point reached and times caught.',
  quit: 'Abandoned runs by the highest point reached, in bands of metres; `to` is null for the open-ended last band.',
  sections:
    'Abandoned runs by the last checkpoint reached: 0 is the lobby, before any clock-in machine; 1 and 2 are the machines in src/core/tower.ts, in order. Says which stretch of the floor makes people leave.',
  hazards:
    'Which hazards catch players. hazard is `kind:ledge`, the ledge being the index in the floor\u2019s `ledges` array in src/core/tower.ts, or `jatuh` for a fall below the audit tape. catches: total times it caught someone. runs: runs in which it caught someone at least once.',
  titles: 'The title (src/core/gelar.ts) each finished run earned.',
  devices:
    'Counts by what the player holds: touch (a phone or tablet) or keys (a keyboard). Compare finished against runs to see whether the game is harder on a phone.',
  layouts:
    'Visits by how the game sat on the screen: window (boxed, with a mouse), fill-tall (a phone upright), fill-wide (a phone on its side).',
  shares:
    'How results were shared: shared (the phone\u2019s share sheet), saved (downloaded), show (shown for a long press), copied (text to the clipboard).',
  sound: 'Of the runs that said so, how many ended with the sound switched off.',
  errors:
    'Errors thrown by the game\u2019s own code, and unhandled promise rejections, by message, most frequent first, with the last time seen and a build that showed it. Errors from scripts that extensions or in-app browsers add to the page are left out. Addresses are removed before storage.',
  revs: 'Events per build label (`version+commit`), to tell which release the data comes from.',
  floor:
    'The floor the numbers are about, in game pixels as in src/core/tower.ts: ledges (x the left edge, y the height above the ground floor, w the width; a troli rolls `travel` either side of x), the auditors\u2019 beats between `from` and `to`, the stamps, the envelopes (`amplop`, by index), the clock-in machines (`checkpoints`, the first being where a run starts) and the door (`exit`). Read `spots`, `dwell`, `envelopes` and `hazards` against it.',
  route:
    'The floor stretch by stretch: `stretches[i].to` is the checkpoint that ends it (1, 2...) or `door`. reached: runs that got there, of `runs`. seconds: median time the runs that crossed the stretch took to cross it.',
  spots:
    'Where players were caught, in squares 8 game pixels wide: x and y are the centre of a square (y is height above the ground floor, as in src/core/tower.ts), n the catches in it. A run sends all its catches up to 30, and an even sample of 30 beyond that.',
  carrying:
    'By the number of envelopes carried: seconds players spent free to move with that many, and the catches that happened with that many. Catches per minute is catches / (seconds / 60): the envelopes shorten the jump, and this says what that costs.',
  lastCatch:
    'Of the `left` runs left before the door: what had caught the player last (hazard, kind, ledge as in `hazards`), and of those, `soon`: left within `soon` seconds of that catch. uncaught: runs left without ever being caught.',
  envelopes:
    'Per envelope, by its index in the floor\u2019s `amplop` in src/core/tower.ts: picked, runs that picked it up at least once, of `runs`; kept, finished runs that carried it to the door, of `finished`. lost: envelopes put back by catches in all, in `lostRuns` runs.',
  moves:
    'Of `runs`: the median jumps and dashes (ngeles) per run, and `dashed`, the runs that dashed at least once, to tell whether players find the dash.',
  dwell:
    'Per ledge (index in `ledges`): runs that stood on it for a second or more, the median seconds those runs stood there, and the total. Long waits mark a ledge where players hesitate or wait for a hazard.',
  breaks:
    'Of `runs`: paused, the runs the player paused at least once; away, the runs whose page was left mid-run (another app, a notification) and come back to.',
  attempts:
    'By which run of the visit it was, counted in the page: the first, the second, up to five and more together (`to` null). started counts run_started, ended and finished count run_ended. Once every visit comes from a build that counts attempts, visits minus first runs started is the visits that never started a run.',
  returning:
    'Runs by players who had finished the floor on that device before (`returning`) and by those who had not (`new`), read from the record the game keeps on the device: runs, finished, and records, finishes that beat the player\u2019s own record.',
  browsers:
    'Per browser, read from the User-Agent header (which is not stored): visits, runs started, runs finished, and the oldest and the most common major version seen on a visit. inApp marks another app showing the page inside itself (Instagram, TikTok, WhatsApp...): the player opened a link in that app. Android WebView is such an app that does not say which.',
  systems: 'Visits by operating system, read from the User-Agent header.',
  forms:
    'Visits, runs started and runs finished by kind of device, read from the User-Agent header: phone, tablet or desktop. An iPad asking for the desktop site counts as desktop; `devices` says touch or keys from the page itself.',
  models:
    'Visits by phone model, where the browser names it. Chrome on Android names it only when the page asks, and the page asks; Safari says no more than iPhone or iPad.',
  widths:
    'Visits by the width of the page in CSS pixels: narrow (under 360), phone (360 to 479), wide (480 to 839: a big phone on its side or a small tablet) and desktop (840 and up).',
  visitors:
    'Of the visits that said so (`said`): installed, opened from the home screen; finishedBefore, from a device on which the floor had been finished, read from the record the game keeps there.',
  hours: 'Visits by hour of the day on the player\u2019s own clock, 0 to 23.',
  weekdays: 'Visits by day of the week on the player\u2019s own clock: 0 is Sunday, 6 is Saturday.',
  zones:
    'Visits by the time zone of the player\u2019s clock, in minutes ahead of UTC: 420 is WIB, 480 WITA, 540 WIT. A rough region, without any address.',
  countries: 'Visits by country (ISO 3166 code), looked up from the address the beacon came from.',
  regions:
    'Visits from Indonesia by province, as the GeoIP database names it. The address is used for this lookup once and then forgotten.',
  cities:
    'Visits from Indonesia by town or regency. Mobile networks often show up as Jakarta or another big city wherever the phone is, so read this as a hint, not a census.',
  geo: 'Whether the GeoIP database (DB-IP IP to City Lite, CC BY 4.0) was there when these numbers were read, and the date it was built. Without it, no visit has a place.',
  missing:
    'Rows recorded before v0.7.0 have no deaths, checkpoint, hazards, title, muted, device, layout or via; rows from builds before the details of play were sent (route, spots, carrying, lastCatch, envelopes, moves, dwell, breaks, attempts, returning) have none of those. They count in the totals and are left out of those breakdowns, whose own counts say how many rows they rest on. Rows stored before the collector read the User-Agent have no browser, system, form or model, and visits from builds before the page said them have no width, installed, zone or finishedBefore. Rows stored before addresses were looked up, or while the GeoIP database was missing, have no country, region or city.',
};

/** How far up abandoned runs got is reported in bands this many metres tall; the last band is open-ended. */
const QUIT_BAND = 10;
const QUIT_BANDS = 5;

/** The width of a page in CSS pixels, as a kind of screen. */
const widthClass = (width) => (width < 360 ? 'narrow' : width < 480 ? 'phone' : width < 840 ? 'wide' : 'desktop');

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

/** Leaving within this many seconds of a catch counts as leaving because of it. */
const SOON = 15;
/** Catch positions are counted in squares this many game pixels wide. */
const CELL = 8;
/** Attempts are counted one by one up to this one, then together. */
const ATTEMPTS = 5;

const parse = (text) => {
  if (typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/** `stempel:12` -> its kind and its ledge; `jatuh` has no ledge. */
const placed = (row) => {
  const [kind, ledge] = row.hazard.split(':');
  return { ...row, kind, ledge: ledge === undefined ? null : Number(ledge) };
};

/**
 * How runs were played, from the details a run reports about itself
 * (src/core/report.ts). Only rows that carry them count, which `jumps` marks:
 * every run that sends the details sends it. `starts` are run_started rows.
 */
function playStats(rows, starts) {
  const runs = rows
    .filter((r) => r.jumps != null)
    .map((r) => ({
      ...r,
      splits: parse(r.splits) ?? [],
      spots: parse(r.spots) ?? [],
      picked: parse(r.picked) ?? [],
      kept: parse(r.kept) ?? [],
      carried: parse(r.carried) ?? [],
      caughtWith: parse(r.caughtWith) ?? [],
      dwell: parse(r.dwell) ?? {},
    }));
  const finished = runs.filter((r) => r.cause === 'finished');
  const left = runs.filter((r) => r.cause === 'abandoned');

  // The route, stretch by stretch: lobby to the first machine, machine to
  // machine, the last machine to the door. How many got to the end of each,
  // and how long the ones who crossed it took.
  const stops = runs.length ? runs.reduce((most, r) => Math.max(most, r.splits.length), 0) : -1;
  const stretches = [];
  for (let k = 0; k <= stops; k++) {
    const door = k === stops;
    const times = [];
    let reached = 0;
    for (const r of runs) {
      const done = r.cause === 'finished';
      if (door ? done : done || (r.checkpoint ?? 0) > k) reached += 1;
      const from = k === 0 ? 0 : r.splits[k - 1];
      const to = door ? (done ? r.duration : null) : r.splits[k];
      if (from != null && to != null && to >= from) times.push(to - from);
    }
    stretches.push({ to: door ? 'door' : k + 1, reached, seconds: median(times) });
  }

  // Where the catches were, counted in squares of CELL pixels.
  const cells = new Map();
  for (const r of runs) {
    for (const [x, y] of r.spots) {
      const key = `${Math.floor(x / CELL)}:${Math.floor(y / CELL)}`;
      cells.set(key, (cells.get(key) ?? 0) + 1);
    }
  }
  const spots = [...cells]
    .map(([key, n]) => {
      const [col, row] = key.split(':').map(Number);
      return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2, n };
    })
    .sort((a, b) => b.n - a.n || a.y - b.y || a.x - b.x)
    .slice(0, 600);

  // Time free to move, and catches, at each number of envelopes carried.
  const carrying = [];
  const weightRow = (w) => {
    for (let i = carrying.length; i <= w; i++) carrying.push({ envelopes: i, seconds: 0, catches: 0 });
    return carrying[w];
  };
  for (const r of runs) {
    r.carried.forEach((seconds, w) => {
      weightRow(w).seconds += seconds;
    });
    r.caughtWith.forEach((n, w) => {
      weightRow(w).catches += n;
    });
  }

  // What had caught the players who left, last, and how many left soon after.
  const lastMap = new Map();
  for (const r of left) {
    if (!r.lastHazard) continue;
    const row = lastMap.get(r.lastHazard) ?? { hazard: r.lastHazard, runs: 0, soon: 0 };
    row.runs += 1;
    if (r.sinceCaught != null && r.sinceCaught <= SOON) row.soon += 1;
    lastMap.set(r.lastHazard, row);
  }

  // Each envelope: picked up in how many runs, carried out by how many who finished.
  const envelopeCount = runs.reduce((most, r) => Math.max(most, r.carried.length - 1), 0);
  const list = Array.from({ length: envelopeCount }, (_, i) => ({ envelope: i, picked: 0, kept: 0 }));
  for (const r of runs) {
    for (const i of r.picked) if (list[i]) list[i].picked += 1;
    if (r.cause === 'finished') for (const i of r.kept) if (list[i]) list[i].kept += 1;
  }

  // How long players stand on each ledge, among the runs that stood there a second or more.
  const ledgeMap = new Map();
  for (const r of runs) {
    for (const [ledge, seconds] of Object.entries(r.dwell)) {
      const row = ledgeMap.get(ledge) ?? { ledge: Number(ledge), runs: 0, total: 0, times: [] };
      row.runs += 1;
      row.total += seconds;
      row.times.push(seconds);
      ledgeMap.set(ledge, row);
    }
  }

  // Which run of the visit this was: the first, the second... and five or more together.
  const attempts = Array.from({ length: ATTEMPTS }, (_, i) => ({
    from: i + 1,
    to: i + 1 === ATTEMPTS ? null : i + 1,
    started: 0,
    ended: 0,
    finished: 0,
  }));
  const bucket = (n) => attempts[Math.min(ATTEMPTS, n) - 1];
  for (const s of starts) bucket(s.attempt).started += 1;
  for (const r of runs) {
    if (r.attempt == null) continue;
    bucket(r.attempt).ended += 1;
    if (r.cause === 'finished') bucket(r.attempt).finished += 1;
  }

  const players = (rows) => ({
    runs: rows.length,
    finished: rows.filter((r) => r.cause === 'finished').length,
    records: rows.filter((r) => r.record != null).length,
  });

  return {
    route: { runs: runs.length, stretches },
    spots,
    carrying,
    lastCatch: {
      left: left.length,
      uncaught: left.filter((r) => !r.lastHazard).length,
      soon: SOON,
      hazards: [...lastMap.values()].map(placed).sort((a, b) => b.runs - a.runs || a.hazard.localeCompare(b.hazard)),
    },
    envelopes: {
      runs: runs.length,
      finished: finished.length,
      lost: runs.reduce((sum, r) => sum + (r.lost ?? 0), 0),
      lostRuns: runs.filter((r) => r.lost > 0).length,
      list,
    },
    moves: {
      runs: runs.length,
      dashed: runs.filter((r) => r.dashes > 0).length,
      jumps: median(runs.map((r) => r.jumps)),
      dashes: median(runs.map((r) => r.dashes)),
    },
    dwell: [...ledgeMap.values()]
      .map(({ times, ...row }) => ({ ...row, seconds: median(times) }))
      .sort((a, b) => a.ledge - b.ledge),
    breaks: {
      runs: runs.length,
      paused: runs.filter((r) => r.pauses > 0).length,
      away: runs.filter((r) => r.away > 0).length,
    },
    attempts,
    returning: {
      new: players(runs.filter((r) => r.finishedBefore === 0)),
      returning: players(runs.filter((r) => r.finishedBefore === 1)),
    },
  };
}

export function openStore(path) {
  const floor = readFloor();
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      day TEXT NOT NULL,
      type TEXT NOT NULL,
      rev TEXT,
      cause TEXT,
      money INTEGER,
      weight INTEGER,
      height INTEGER,
      duration INTEGER,
      message TEXT
    )
  `);
  // A database made by an earlier release gets the newer columns added. Its
  // old rows keep NULL there, which every query below reads as "not recorded".
  const present = new Set(
    db
      .prepare('PRAGMA table_info(events)')
      .all()
      .map((column) => column.name),
  );
  for (const [name, type] of Object.entries(ADDED_COLUMNS)) {
    if (!present.has(name)) db.exec(`ALTER TABLE events ADD COLUMN ${name} ${type}`);
  }

  db.exec('CREATE INDEX IF NOT EXISTS events_day ON events (day)');
  db.exec('CREATE INDEX IF NOT EXISTS events_type_day ON events (type, day)');

  // Rows stored under older rules get the current ones, so the promise holds
  // for old data too: no addresses, and nothing kept that says nothing.
  // Cheap: errors are few and expire in 90 days.
  const update = db.prepare('UPDATE events SET message = ? WHERE id = ?');
  const remove = db.prepare('DELETE FROM events WHERE id = ?');
  for (const row of db.prepare("SELECT id, message FROM events WHERE type = 'error'").all()) {
    const clean = errorMessage(row.message);
    if (!clean) remove.run(row.id);
    else if (clean !== row.message) update.run(clean, row.id);
  }

  const insertStmt = db.prepare(
    `INSERT INTO events (ts, day, ${COLUMNS.join(', ')}) VALUES (?, ?, ${COLUMNS.map(() => '?').join(', ')})`,
  );

  return {
    insert(event, now = Date.now()) {
      const day = new Date(now).toISOString().slice(0, 10);
      insertStmt.run(now, day, ...COLUMNS.map((column) => event[column] ?? null));
    },

    stats(days = 30, geo = null) {
      const since = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);

      const daily = db
        .prepare(
          `SELECT day,
                  SUM(type = 'visit')     AS visits,
                  SUM(type = 'run_started') AS runs,
                  SUM(type = 'run_ended')   AS ended,
                  SUM(type = 'run_ended' AND cause = 'finished') AS finished,
                  SUM(type = 'shared')    AS shared,
                  SUM(type = 'error')     AS errors
             FROM events
            WHERE day >= ?
            GROUP BY day
            ORDER BY day`,
        )
        .all(since);

      const totals = daily.reduce(
        (acc, row) => {
          acc.visits += row.visits;
          acc.runs += row.runs;
          acc.ended += row.ended;
          acc.finished += row.finished;
          acc.shared += row.shared;
          acc.errors += row.errors;
          return acc;
        },
        { visits: 0, runs: 0, ended: 0, finished: 0, shared: 0, errors: 0 },
      );

      const causes = db
        .prepare(
          `SELECT cause, COUNT(*) AS n
             FROM events
            WHERE type = 'run_ended' AND day >= ? AND cause IS NOT NULL
            GROUP BY cause
            ORDER BY n DESC`,
        )
        .all(since);

      const runs = db
        .prepare(
          `SELECT cause, money, weight, height, duration, deaths, checkpoint, hazards, title, muted, device,
                  splits, spots, lastHazard, sinceCaught, picked, kept, lost, carried, caughtWith,
                  jumps, dashes, dwell, attempt, pauses, away, finishedBefore, record
             FROM events
            WHERE type = 'run_ended' AND day >= ?
            ORDER BY id DESC
            LIMIT 50000`,
        )
        .all(since);
      const starts = db
        .prepare(
          `SELECT attempt FROM events WHERE type = 'run_started' AND day >= ? AND attempt IS NOT NULL LIMIT 50000`,
        )
        .all(since);

      // A run that reached the door and a run the player walked away from
      // answer different questions, so they are never averaged together.
      const finished = runs.filter((r) => r.cause === 'finished');
      const abandoned = runs.filter((r) => r.cause === 'abandoned');
      const middle = (rows, field) => median(rows.map((r) => r[field]).filter((v) => v != null));

      // Where the players who left had got to, in bands of QUIT_BAND metres.
      const bands = new Array(QUIT_BANDS).fill(0);
      for (const run of abandoned) {
        if (run.height == null) continue;
        bands[Math.min(QUIT_BANDS - 1, Math.floor(run.height / QUIT_BAND))] += 1;
      }

      // Which hazards catch people: how many catches in all, and in how many runs.
      const hazardMap = new Map();
      for (const run of runs) {
        if (!run.hazards) continue;
        let tally;
        try {
          tally = JSON.parse(run.hazards);
        } catch {
          continue;
        }
        for (const [hazard, n] of Object.entries(tally)) {
          const row = hazardMap.get(hazard) ?? { hazard, catches: 0, runs: 0 };
          row.catches += n;
          row.runs += 1;
          hazardMap.set(hazard, row);
        }
      }
      const hazards = [...hazardMap.values()]
        .map(placed)
        .sort((x, y) => y.catches - x.catches || x.hazard.localeCompare(y.hazard));

      // Which stretch of the floor the players who left were in: the last checkpoint they had reached.
      const sectionMap = new Map();
      for (const run of abandoned) {
        if (run.checkpoint == null) continue;
        sectionMap.set(run.checkpoint, (sectionMap.get(run.checkpoint) ?? 0) + 1);
      }
      const sections = [...sectionMap.entries()]
        .sort((x, y) => x[0] - y[0])
        .map(([checkpoint, n]) => ({ checkpoint, n }));

      const tallyBy = (rows, field) => {
        const counts = new Map();
        for (const row of rows) if (row[field] != null) counts.set(row[field], (counts.get(row[field]) ?? 0) + 1);
        return [...counts.entries()].sort((x, y) => y[1] - x[1] || String(x[0]).localeCompare(String(y[0])));
      };

      const titles = tallyBy(finished, 'title').map(([title, n]) => ({ title, n }));

      // Touch or keyboard: who comes, who plays, and who gets to the door.
      const byDevice = db
        .prepare(
          `SELECT device,
                  SUM(type = 'visit')       AS visits,
                  SUM(type = 'run_started') AS runs,
                  SUM(type = 'run_ended' AND cause = 'finished')  AS finished,
                  SUM(type = 'run_ended' AND cause = 'abandoned') AS abandoned
             FROM events
            WHERE day >= ? AND device IS NOT NULL
            GROUP BY device
            ORDER BY visits DESC, device`,
        )
        .all(since);

      const layouts = db
        .prepare(
          `SELECT layout, COUNT(*) AS visits
             FROM events
            WHERE type = 'visit' AND day >= ? AND layout IS NOT NULL
            GROUP BY layout
            ORDER BY visits DESC, layout`,
        )
        .all(since);

      const shares = db
        .prepare(
          `SELECT via, COUNT(*) AS n
             FROM events
            WHERE type = 'shared' AND day >= ? AND via IS NOT NULL
            GROUP BY via
            ORDER BY n DESC, via`,
        )
        .all(since);

      const heard = runs.filter((r) => r.muted != null);

      const errors = db
        .prepare(
          `SELECT message, COUNT(*) AS n, MAX(ts) AS last, MAX(rev) AS rev
             FROM events
            WHERE type = 'error' AND day >= ?
            GROUP BY message
            ORDER BY n DESC
            LIMIT 25`,
        )
        .all(since);

      // What the players came in: browser, system, kind of device, phone model.
      const browsers = db
        .prepare(
          `SELECT browser AS name,
                  SUM(type = 'visit')       AS visits,
                  SUM(type = 'run_started') AS runs,
                  SUM(type = 'run_ended' AND cause = 'finished') AS finished,
                  MIN(CASE WHEN type = 'visit' THEN browserVersion END) AS oldest
             FROM events
            WHERE day >= ? AND browser IS NOT NULL
            GROUP BY browser
            ORDER BY visits DESC, name
            LIMIT 25`,
        )
        .all(since)
        .map((row) => ({ ...row }));
      const commonVersion = db.prepare(
        `SELECT browserVersion AS version FROM events
          WHERE type = 'visit' AND day >= ? AND browser = ? AND browserVersion IS NOT NULL
          GROUP BY browserVersion ORDER BY COUNT(*) DESC, browserVersion DESC LIMIT 1`,
      );
      for (const row of browsers) {
        row.common = commonVersion.get(since, row.name)?.version ?? null;
        row.inApp = IN_APP.has(row.name);
      }

      const visitsBy = (column, limit, where = '') =>
        db
          .prepare(
            `SELECT ${column} AS name, COUNT(*) AS n
               FROM events
              WHERE type = 'visit' AND day >= ? AND ${column} IS NOT NULL ${where}
              GROUP BY ${column}
              ORDER BY n DESC, name
              LIMIT ${limit}`,
          )
          .all(since);

      const forms = db
        .prepare(
          `SELECT form,
                  SUM(type = 'visit')       AS visits,
                  SUM(type = 'run_started') AS runs,
                  SUM(type = 'run_ended' AND cause = 'finished') AS finished
             FROM events
            WHERE day >= ? AND form IS NOT NULL
            GROUP BY form
            ORDER BY visits DESC, form`,
        )
        .all(since);

      // What a visit says about itself: the screen, the home screen, the player's clock.
      const visitRows = db
        .prepare(
          `SELECT ts, width, installed, zone, finishedBefore
             FROM events
            WHERE type = 'visit' AND day >= ?
            ORDER BY id DESC
            LIMIT 100000`,
        )
        .all(since);
      const widths = { narrow: 0, phone: 0, wide: 0, desktop: 0 };
      const hours = new Array(24).fill(0);
      const weekdays = new Array(7).fill(0);
      const zones = new Map();
      for (const visit of visitRows) {
        if (visit.width != null) widths[widthClass(visit.width)] += 1;
        if (visit.zone == null) continue;
        const local = new Date(visit.ts + visit.zone * 60_000);
        hours[local.getUTCHours()] += 1;
        weekdays[local.getUTCDay()] += 1;
        zones.set(visit.zone, (zones.get(visit.zone) ?? 0) + 1);
      }
      const told = (field) => {
        const said = visitRows.filter((visit) => visit[field] != null);
        return { said: said.length, yes: said.filter((visit) => visit[field] === 1).length };
      };

      const revs = db
        .prepare(
          `SELECT rev, COUNT(*) AS n
             FROM events
            WHERE day >= ? AND rev IS NOT NULL
            GROUP BY rev
            ORDER BY n DESC
            LIMIT 10`,
        )
        .all(since);

      return {
        format: STATS_FORMAT,
        generated: new Date().toISOString(),
        about: ABOUT,
        days,
        since,
        daily,
        totals,
        causes,
        finished: {
          n: finished.length,
          duration: middle(finished, 'duration'),
          money: middle(finished, 'money'),
          weight: middle(finished, 'weight'),
          deaths: middle(finished, 'deaths'),
        },
        abandoned: {
          n: abandoned.length,
          duration: middle(abandoned, 'duration'),
          height: middle(abandoned, 'height'),
          deaths: middle(abandoned, 'deaths'),
        },
        quit: bands.map((n, i) => ({
          from: i * QUIT_BAND,
          to: i === QUIT_BANDS - 1 ? null : (i + 1) * QUIT_BAND - 1,
          n,
        })),
        sections,
        hazards,
        titles,
        devices: byDevice,
        layouts,
        shares,
        sound: { runs: heard.length, muted: heard.filter((r) => r.muted === 1).length },
        errors,
        revs,
        ...playStats(runs, starts),
        floor,
        browsers,
        systems: visitsBy('os', 20),
        forms,
        models: visitsBy('model', 25),
        widths: Object.entries(widths).map(([name, n]) => ({ name, n })),
        visitors: { installed: told('installed'), finishedBefore: told('finishedBefore') },
        hours: hours.map((n, hour) => ({ hour, n })),
        weekdays: weekdays.map((n, weekday) => ({ weekday, n })),
        zones: [...zones].map(([zone, n]) => ({ zone, n })).sort((a, b) => b.n - a.n || a.zone - b.zone),
        countries: visitsBy('country', 20),
        regions: visitsBy('region', 40, "AND country = 'ID'"),
        cities: visitsBy('city', 25, "AND country = 'ID'"),
        geo: { available: !!geo, built: geo?.built ?? null },
      };
    },

    prune(keepDays = 90) {
      const cutoff = Date.now() - keepDays * 86_400_000;
      const result = db.prepare('DELETE FROM events WHERE ts < ?').run(cutoff);
      return result.changes ?? 0;
    },

    close() {
      db.close();
    },
  };
}
