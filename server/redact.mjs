/**
 * Server-side copy of src/platform/redact.ts. The client already redacts, but anything
 * can post to the beacon, so the collector applies the same rules before a
 * message is stored. Keep the two in step: tests/redact.test.ts runs the same
 * cases against both.
 */

export const MAX_MESSAGE = 300;

const URL_WITH_SCHEME = /\b[a-z][a-z0-9+.-]*:\/\/[^\s'"`<>()[\]{}]*/gi;
const INLINE_URI = /\b(?:data|blob|javascript):[^\s'"`<>()[\]{}]*/gi;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const BARE_HOST_PATH = /\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?\/[^\s'"`<>()[\]{}]*/gi;

export function redactMessage(input) {
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
