/**
 * Anonymous, aggregate telemetry: what happened, never who. No cookie, no
 * stored address, no identifier. Do Not Track and Global Privacy Control turn
 * it off, and a failure here must never reach the player. Error messages are
 * redacted before they leave the page (see redact.ts).
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

/** What some browsers have that the standard types do not. */
interface NavigatorExtras {
  globalPrivacyControl?: boolean;
  /** Safari on iOS, opened from the home screen. */
  standalone?: boolean;
  /** Chrome's client hints: the phone's model only on request. */
  userAgentData?: { getHighEntropyValues?(hints: string[]): Promise<{ model?: string }> };
}

const nav = navigator as Navigator & NavigatorExtras;

const enabled =
  import.meta.env.PROD && location.protocol === 'https:' && nav.doNotTrack !== '1' && nav.globalPrivacyControl !== true;

/** How long a visit waits for Chrome to name the phone. */
const MODEL_WAIT_MS = 1500;

/** Marks a link may carry to say where it was posted: the first one present is the source. */
const SOURCE_MARKS = ['utm_source', 'ref', 'dari'];
/** Every mark of that kind, taken off the address once read. */
const MARKS = [...SOURCE_MARKS, 'utm_campaign', 'utm_medium', 'utm_content', 'utm_term'];

export interface Arrival {
  /** The host of the site that linked here, or '' when none did (typed, bookmarked, an app that hides it). */
  from: string;
  source?: string;
  campaign?: string;
}

let arrived: Arrival | null = null;

/**
 * Where the player arrived from: the host of the page that linked here, never
 * its path, and the marks the link carried. The marks are then taken off the
 * address, so a link copied from the address bar does not pass them on.
 */
export function arrival(): Arrival {
  if (arrived) return arrived;
  arrived = { from: '' };
  try {
    const referrer = document.referrer ? new URL(document.referrer) : null;
    if (referrer && referrer.origin !== location.origin) arrived.from = referrer.hostname;
    const url = new URL(location.href);
    const source = SOURCE_MARKS.map((name) => url.searchParams.get(name)).find(Boolean);
    const campaign = url.searchParams.get('utm_campaign');
    if (source) arrived.source = source;
    if (campaign) arrived.campaign = campaign;
    const marked = MARKS.filter((name) => url.searchParams.has(name));
    if (marked.length) {
      for (const name of marked) url.searchParams.delete(name);
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }
  } catch {
    /* nothing more to say */
  }
  return arrived;
}

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

/**
 * The page was opened: what it is shown on, and the player's clock. Chrome
 * names the phone's model only when asked, so ask, but never hold the visit
 * back for long, and send it anyway if the page goes first.
 */
export function trackVisit(data: Record<string, unknown>): void {
  if (!enabled) return;
  const visit = {
    ...data,
    ...arrival(),
    width: window.innerWidth,
    installed: window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true,
    // Minutes ahead of UTC: 420 is WIB. A rough region, without any address.
    zone: -new Date().getTimezoneOffset(),
  };
  let sentVisit = false;
  const send = (model?: string) => {
    if (sentVisit) return;
    sentVisit = true;
    track('visit', model ? { ...visit, model } : visit);
  };
  try {
    const ask = nav.userAgentData?.getHighEntropyValues;
    if (ask) {
      ask.call(nav.userAgentData, ['model']).then(
        (values) => send(values.model),
        () => send(),
      );
      window.setTimeout(send, MODEL_WAIT_MS);
      window.addEventListener('pagehide', () => send(), { once: true });
      return;
    }
  } catch {
    /* send what there is */
  }
  send();
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
