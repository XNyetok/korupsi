/**
 * Anonymous, aggregate telemetry: what happened, never who. No cookie, no
 * stored address, no identifier. Do Not Track turns it off, and a failure here
 * must never reach the player. Error messages are redacted before they leave
 * the page (see redact.ts).
 */

import { redactMessage } from './redact.ts';

const ENDPOINT = '/api/beacon';
const MAX_PER_PAGE = 40;

/**
 * The folder the game's own scripts are served from: `/assets/` in a build,
 * where every script is. Extensions and in-app browsers add scripts of their
 * own to the page, and an error thrown by one of those is not the game's:
 * from another origin it even arrives as "Script error." with no file, line
 * or detail, so there is nothing to act on.
 */
const OWN_SCRIPTS = import.meta.url.replace(/[^/]*$/, '');

const enabled = import.meta.env.PROD && location.protocol === 'https:' && navigator.doNotTrack !== '1';

let sent = 0;

export function track(type: string, data: Record<string, unknown> = {}): void {
  if (!enabled || sent >= MAX_PER_PAGE) return;
  sent += 1;

  try {
    const body = JSON.stringify({ type, rev: __BUILD_LABEL__, ...data });

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }

    void fetch(ENDPOINT, {
      method: 'POST',
      body,
      keepalive: true,
      headers: { 'content-type': 'application/json' },
    }).catch(() => {});
  } catch {
    /* a beacon is never worth breaking the game for */
  }
}

function trackError(raw: unknown): void {
  const message = redactMessage(raw);
  if (message) track('error', { message });
}

export function trackErrors(): void {
  window.addEventListener('error', (event) => {
    // Only errors thrown by the game's own code. Safari names the file of
    // code evaluated into the page "undefined", so this asks where an error
    // comes from rather than whether it has a file.
    if (event.message && event.filename.startsWith(OWN_SCRIPTS)) trackError(event.message);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    trackError(reason instanceof Error ? reason.message : reason);
  });
}
