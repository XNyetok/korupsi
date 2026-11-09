/**
 * Anonymous, aggregate telemetry: what happened, never who. No cookie, no
 * stored address, no identifier. Do Not Track turns it off, and a failure here
 * must never reach the player.
 */

const ENDPOINT = '/api/beacon';
const MAX_PER_PAGE = 40;

const enabled =
  import.meta.env.PROD && location.protocol === 'https:' && navigator.doNotTrack !== '1';

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

export function trackErrors(): void {
  window.addEventListener('error', (event) => {
    if (!event.message) return;
    track('error', { message: event.message });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    track('error', { message: reason instanceof Error ? reason.message : String(reason) });
  });
}
