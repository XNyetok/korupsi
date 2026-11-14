import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readAgent } from './agent.mjs';
import { normaliseEvent, openStore } from './store.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '127.0.0.1';
const DB_PATH = process.env.DB_PATH ?? './data/stats.db';
const KEEP_DAYS = 90;
const MAX_BODY = 2048;

const PANEL_DIR = resolve(fileURLToPath(new URL('./panel/', import.meta.url)));
const store = openStore(DB_PATH);

/**
 * The deploy writes the release folder name into RELEASE, and checks it in the
 * health answer: a restart that left the old code running must not pass.
 */
const RELEASE = await readFile(new URL('./RELEASE', import.meta.url), 'utf8')
  .then((text) => text.trim() || 'dev')
  .catch(() => 'dev');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

const PANEL_HEADERS = {
  'content-type': 'text/plain; charset=utf-8',
  'content-security-policy':
    "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex, nofollow',
  'cache-control': 'no-store',
};

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...PANEL_HEADERS,
    'content-type': 'application/json; charset=utf-8',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const header = (req, name) => {
  const value = req.headers[name];
  return typeof value === 'string' ? value : '';
};

async function beacon(req, res) {
  let input;
  try {
    input = JSON.parse(await readBody(req));
  } catch {
    json(res, 400, { error: 'bad payload' });
    return;
  }

  // A browser that asks not to be tracked is not counted, and neither is a
  // crawler. The page checks the same before it sends; this is for the rest.
  const agent = readAgent(header(req, 'user-agent'));
  if (agent.bot || header(req, 'dnt') === '1' || header(req, 'sec-gpc') === '1') {
    res.writeHead(204, PANEL_HEADERS);
    res.end();
    return;
  }

  const event = normaliseEvent(input, agent);
  if (!event) {
    json(res, 422, { error: 'ignored' });
    return;
  }

  store.insert(event);
  res.writeHead(204, PANEL_HEADERS);
  res.end();
}

async function servePanel(pathname, res) {
  const rel = pathname.replace(/^\/panel\/?/, '') || 'index.html';
  const file = resolve(join(PANEL_DIR, rel));

  // Never serve anything outside the panel directory.
  if (file !== PANEL_DIR && !file.startsWith(PANEL_DIR + sep)) {
    json(res, 404, { error: 'not found' });
    return;
  }

  try {
    const body = await readFile(file);
    res.writeHead(200, {
      ...PANEL_HEADERS,
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    });
    res.end(body);
  } catch {
    json(res, 404, { error: 'not found' });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  try {
    if (req.method === 'POST' && url.pathname === '/api/beacon') {
      await beacon(req, res);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/stats') {
      const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days') ?? 30) || 30));
      json(res, 200, store.stats(days));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/favicon.ico') {
      res.writeHead(204, PANEL_HEADERS);
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/health') {
      json(res, 200, { ok: true, release: RELEASE, uptime: Math.round(process.uptime()) });
      return;
    }

    if (req.method === 'GET' && (url.pathname === '/panel' || url.pathname.startsWith('/panel/'))) {
      await servePanel(url.pathname, res);
      return;
    }

    json(res, 404, { error: 'not found' });
  } catch (error) {
    json(res, 500, { error: 'failed' });
    console.error('request failed', error instanceof Error ? error.message : error);
  }
});

const prune = () => {
  const removed = store.prune(KEEP_DAYS);
  if (removed) console.log(`pruned ${removed} events older than ${KEEP_DAYS} days`);
};
prune();
setInterval(prune, 6 * 3600_000).unref();

server.listen(PORT, HOST, () => {
  console.log(`korupsi stats listening on http://${HOST}:${PORT}`);
});

const shutdown = () => {
  server.close(() => {
    store.close();
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
