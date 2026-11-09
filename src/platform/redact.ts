/**
 * Error messages are the one free-text field the telemetry sends. Browsers put
 * page URLs, extension IDs and sometimes query strings into them, so only the
 * first line is kept and anything that looks like an address is replaced.
 *
 * server/redact.mjs applies the same rules again on arrival; the two are tested
 * against the same cases in tests/redact.test.ts.
 */

export const MAX_MESSAGE = 300;

const URL_WITH_SCHEME = /\b[a-z][a-z0-9+.-]*:\/\/[^\s'"`<>()[\]{}]*/gi;
const INLINE_URI = /\b(?:data|blob|javascript):[^\s'"`<>()[\]{}]*/gi;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const BARE_HOST_PATH = /\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?\/[^\s'"`<>()[\]{}]*/gi;

export function redactMessage(input: unknown): string {
  const firstLine = String(input ?? '').split(/\r?\n/, 1)[0] ?? '';
  return firstLine
    .replace(INLINE_URI, '<url>')
    .replace(URL_WITH_SCHEME, '<url>')
    .replace(EMAIL, '<email>')
    .replace(BARE_HOST_PATH, '<url>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_MESSAGE);
}
