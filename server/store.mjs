import { DatabaseSync } from 'node:sqlite';

import { redactMessage } from './redact.mjs';

export const EVENT_TYPES = new Set(['visit', 'run_started', 'run_ended', 'shared', 'error', 'band_warned']);

// `finished` is a floor cleared, `abandoned` a run the player left. The others
// are how runs of the first version of the game ended; its rows are still stored.
const CAUSES = new Set(['finished', 'abandoned', 'auditor', 'band', 'fall']);

/** Numbers arrive from the network, so every one of them is bounded here. */
const clampInt = (value, min, max) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n)));
};

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
};

/**
 * Returns the row to store, or null when the event is not worth keeping.
 * Everything that is not on this list is dropped, including extra fields.
 */
export function normaliseEvent(input) {
  if (!input || typeof input !== 'object') return null;
  if (!EVENT_TYPES.has(input.type)) return null;

  const event = {
    type: input.type,
    rev: clip(input.rev, 40),
    cause: null,
    money: null,
    weight: null,
    height: null,
    duration: null,
    message: null,
    deaths: null,
    checkpoint: null,
    hazards: null,
    title: null,
    muted: null,
    // What the player holds, and how the game sits on their screen: said with
    // a visit and with a run, so a run can be read by device.
    device: oneOf(DEVICES, input.device),
    layout: oneOf(LAYOUTS, input.layout),
    via: null,
  };

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
    event.muted = typeof input.muted === 'boolean' ? Number(input.muted) : null;
  }

  if (input.type === 'shared') event.via = oneOf(SHARE_VIA, input.via);

  if (input.type === 'error') {
    event.message = redactMessage(input.message) || null;
    if (!event.message) return null;
  }

  return event;
}

/** Bumped when the shape of the statistics changes, so a reader knows what it is holding. */
const STATS_FORMAT = 2;

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
    'visits: page loads. runs: presses of Mulai or Main lagi, so one visit can start several. ended: runs that reported an ending. finished: runs that reached the door. shared: uses of Bagikan hasil. errors: JavaScript errors in players\u2019 browsers.',
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
    'JavaScript errors by message, most frequent first, with the last time seen and a build that showed it. Addresses are removed before storage.',
  revs: 'Events per build label (`version+commit`), to tell which release the data comes from.',
  missing:
    'Rows recorded before v0.7.0 have no deaths, checkpoint, hazards, title, muted, device, layout or via; they count in the totals and are left out of those breakdowns.',
};

/** How far up abandoned runs got is reported in bands this many metres tall; the last band is open-ended. */
const QUIT_BAND = 10;
const QUIT_BANDS = 5;

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

export function openStore(path) {
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

  // Rows stored before messages were redacted get the same treatment, so the
  // promise holds for old data too. Cheap: errors are few and expire in 90 days.
  const update = db.prepare('UPDATE events SET message = ? WHERE id = ?');
  const remove = db.prepare('DELETE FROM events WHERE id = ?');
  for (const row of db.prepare("SELECT id, message FROM events WHERE type = 'error'").all()) {
    const clean = redactMessage(row.message);
    if (!clean) remove.run(row.id);
    else if (clean !== row.message) update.run(clean, row.id);
  }

  const insertStmt = db.prepare(
    `INSERT INTO events (ts, day, type, rev, cause, money, weight, height, duration, message,
                         deaths, checkpoint, hazards, title, muted, device, layout, via)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  return {
    insert(event, now = Date.now()) {
      const day = new Date(now).toISOString().slice(0, 10);
      insertStmt.run(
        now,
        day,
        event.type,
        event.rev ?? null,
        event.cause ?? null,
        event.money ?? null,
        event.weight ?? null,
        event.height ?? null,
        event.duration ?? null,
        event.message ?? null,
        event.deaths ?? null,
        event.checkpoint ?? null,
        event.hazards ?? null,
        event.title ?? null,
        event.muted ?? null,
        event.device ?? null,
        event.layout ?? null,
        event.via ?? null,
      );
    },

    stats(days = 30) {
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
          `SELECT cause, money, weight, height, duration, deaths, checkpoint, hazards, title, muted, device
             FROM events
            WHERE type = 'run_ended' AND day >= ?
            ORDER BY id DESC
            LIMIT 50000`,
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
        .map((row) => {
          const [kind, ledge] = row.hazard.split(':');
          return { ...row, kind, ledge: ledge === undefined ? null : Number(ledge) };
        })
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
