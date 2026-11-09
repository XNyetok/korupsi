import { DatabaseSync } from 'node:sqlite';

import { redactMessage } from './redact.mjs';

export const EVENT_TYPES = new Set(['visit', 'run_started', 'run_ended', 'shared', 'error']);

const CAUSES = new Set(['auditor', 'band', 'fall', 'abandoned']);

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
  };

  if (input.type === 'run_ended') {
    event.cause = CAUSES.has(input.cause) ? input.cause : null;
    event.money = clampInt(input.money, 0, 1_000_000_000);
    event.weight = clampInt(input.weight, 0, 99);
    event.height = clampInt(input.height, 0, 200_000);
    event.duration = clampInt(input.duration, 0, 3600);
  }

  if (input.type === 'error') {
    event.message = redactMessage(input.message) || null;
    if (!event.message) return null;
  }

  return event;
}

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
    `INSERT INTO events (ts, day, type, rev, cause, money, weight, height, duration, message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          acc.shared += row.shared;
          acc.errors += row.errors;
          return acc;
        },
        { visits: 0, runs: 0, ended: 0, shared: 0, errors: 0 },
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
          `SELECT money, height, duration
             FROM events
            WHERE type = 'run_ended' AND day >= ?
            ORDER BY id DESC
            LIMIT 50000`,
        )
        .all(since);

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
        days,
        since,
        daily,
        totals,
        causes,
        medians: {
          money: median(runs.map((r) => r.money).filter((v) => v != null)),
          height: median(runs.map((r) => r.height).filter((v) => v != null)),
          duration: median(runs.map((r) => r.duration).filter((v) => v != null)),
          samples: runs.length,
        },
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
