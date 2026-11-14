/**
 * Where a visit came from, as the page says it: the host of the site that
 * linked to the game, and the marks the link carried (utm_source and the
 * like). The host is reduced to a site, never more: a path or a query string
 * could say what someone was reading.
 */

/** Sites that send many players, under the names the panel uses for them. */
const SITES = [
  ['instagram', /(^|\.)instagram\.com$/],
  ['facebook', /(^|\.)(facebook\.com|fb\.com|fb\.me)$/],
  ['tiktok', /(^|\.)tiktok\.com$/],
  ['x', /(^|\.)(x\.com|twitter\.com|t\.co)$/],
  ['whatsapp', /(^|\.)(whatsapp\.com|wa\.me)$/],
  ['telegram', /(^|\.)(t\.me|telegram\.org|telegram\.me)$/],
  ['youtube', /(^|\.)(youtube\.com|youtu\.be)$/],
  ['threads', /(^|\.)threads\.(net|com)$/],
  ['line', /(^|\.)line\.me$/],
  ['reddit', /(^|\.)reddit\.com$/],
  ['linkedin', /(^|\.)(linkedin\.com|lnkd\.in)$/],
  ['google', /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/],
  ['bing', /(^|\.)bing\.com$/],
  ['duckduckgo', /(^|\.)duckduckgo\.com$/],
  ['yahoo', /(^|\.)yahoo\.com$/],
];

/** Second-level names under which a site is the label before them: example.co.id, not co.id. */
const SECOND_LEVEL = new Set([
  'co',
  'ac',
  'or',
  'go',
  'web',
  'my',
  'sch',
  'net',
  'com',
  'org',
  'biz',
  'desa',
  'ponpes',
]);

/**
 * The site a host belongs to: a known name, or the registrable domain
 * (news.example.co.id -> example.co.id). `direct` when nothing linked here;
 * null for anything that is not a host name.
 */
export function siteOf(host) {
  if (host === '') return 'direct';
  if (typeof host !== 'string') return null;
  const name = host.trim().toLowerCase().replace(/\.$/, '');
  if (!/^[a-z0-9.-]{3,253}$/.test(name) || !name.includes('.') || /^[\d.]+$/.test(name)) return null;
  // The game's own pages are not a source; the page does not send them anyway.
  if (name === 'korupsi.web.id' || name.endsWith('.korupsi.web.id')) return 'direct';
  for (const [site, pattern] of SITES) if (pattern.test(name)) return site;
  const labels = name.split('.').filter(Boolean);
  const keep = labels.length > 2 && SECOND_LEVEL.has(labels[labels.length - 2]) ? 3 : 2;
  return labels.slice(-keep).join('.');
}

/** A mark from a link, kept as a short plain word, or null. */
export function mark(value) {
  if (typeof value !== 'string') return null;
  const word = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_.-]{0,39}$/.test(word) ? word : null;
}
