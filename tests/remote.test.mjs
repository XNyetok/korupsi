import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const SCRIPT = new URL('../deploy/remote.sh', import.meta.url).pathname;

/** The script relies on GNU `mv -T`. macOS has it only as `gmv` (coreutils). */
function gnuMv() {
  if (spawnSync('mv', ['--version']).status === 0) return 'mv';
  if (spawnSync('gmv', ['--version']).status === 0) return 'gmv';
  return null;
}
const MV = gnuMv();
const skip = MV ? false : 'needs GNU mv (coreutils)';

/**
 * A fake server: two roots, and stand-ins for sudo and curl. The fake
 * collector answers health with the RELEASE file of whatever "current" points
 * at, and fails when that file says "broken".
 */
function server() {
  const dir = mkdtempSync(join(tmpdir(), 'korupsi-remote-'));
  const site = join(dir, 'www', 'site');
  const collector = join(dir, 'opt', 'collector');
  const bin = join(dir, 'bin');
  const log = join(dir, 'restarts.log');
  for (const d of [join(site, 'releases'), join(collector, 'releases'), bin]) mkdirSync(d, { recursive: true });

  const shim = (name, body) => {
    writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  };
  shim('sudo', `[ "$1" = -n ] && shift; echo "$*" >> "${log}"`);
  shim(
    'curl',
    `rel=$(cat "${collector}/current/RELEASE" 2>/dev/null || echo dev)
[ "$rel" = broken ] && exit 7
printf '{"ok":true,"release":"%s","uptime":1}' "$rel"`,
  );
  if (MV === 'gmv') shim('mv', 'exec gmv "$@"');
  // What `systemctl cat` prints once the unit runs the code through "current".
  const unit = join(dir, 'unit');
  writeFileSync(unit, `ExecStart=/usr/bin/node ${collector}/current/index.mjs\n`);
  shim('systemctl', `cat "${unit}"`);

  const release = (name, { collectorRelease = name, siteFile = true } = {}) => {
    const s = join(site, 'releases', name);
    const c = join(collector, 'releases', name);
    mkdirSync(s, { recursive: true });
    mkdirSync(c, { recursive: true });
    if (siteFile) writeFileSync(join(s, 'index.html'), name);
    writeFileSync(join(c, 'index.mjs'), '');
    writeFileSync(join(c, 'RELEASE'), collectorRelease);
  };

  const run = (args, env = {}) =>
    spawnSync('bash', ['-s', '--', ...args], {
      input: readFileSync(SCRIPT),
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        KORUPSI_NODE: process.execPath,
        KORUPSI_HEALTH_TRIES: '2',
        ...env,
      },
    });

  const link = (root, name) => (existsSync(join(root, name)) ? readlinkSync(join(root, name)) : null);
  const restarts = () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : []);

  return {
    dir,
    site,
    collector,
    release,
    run,
    link,
    restarts,
    activate: (name, env) => run(['activate', site, collector, name], env),
    rollback: (env) => run(['rollback', site, collector], env),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

test('activate switches the collector, then the site, and records previous', { skip }, () => {
  const s = server();
  try {
    // The layout after the one-time migration: the old code in a legacy folder.
    s.release('legacy', { collectorRelease: '' });
    symlinkSync('releases/legacy', join(s.site, 'current'));
    symlinkSync('releases/legacy', join(s.collector, 'current'));

    s.release('20261110000000-abcdef1');
    const result = s.activate('20261110000000-abcdef1');
    assert.equal(result.status, 0, result.stderr);

    assert.equal(s.link(s.site, 'current'), 'releases/20261110000000-abcdef1');
    assert.equal(s.link(s.collector, 'current'), 'releases/20261110000000-abcdef1');
    assert.equal(s.link(s.site, 'previous'), 'releases/legacy');
    assert.equal(s.link(s.collector, 'previous'), 'releases/legacy');
    assert.deepEqual(s.restarts(), ['/usr/bin/systemctl restart korupsi-stats']);
  } finally {
    s.cleanup();
  }
});

test('a collector that fails its health check leaves the site alone', { skip }, () => {
  const s = server();
  try {
    s.release('20261110000000-abcdef1');
    assert.equal(s.activate('20261110000000-abcdef1').status, 0);

    s.release('20261110010000-1234567', { collectorRelease: 'broken' });
    const result = s.activate('20261110010000-1234567');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /failed its health check/);

    assert.equal(s.link(s.site, 'current'), 'releases/20261110000000-abcdef1', 'the site moved');
    assert.equal(s.link(s.collector, 'current'), 'releases/20261110000000-abcdef1', 'the collector was not restored');
    assert.equal(s.restarts().length, 3, 'deploy, failed restart, restore');
  } finally {
    s.cleanup();
  }
});

test('rollback swaps current and previous, and a second rollback undoes it', { skip }, () => {
  const s = server();
  try {
    s.release('20261110000000-abcdef1');
    s.release('20261110010000-1234567');
    assert.equal(s.activate('20261110000000-abcdef1').status, 0);
    assert.equal(s.activate('20261110010000-1234567').status, 0);

    let result = s.rollback();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(s.link(s.site, 'current'), 'releases/20261110000000-abcdef1');
    assert.equal(s.link(s.collector, 'current'), 'releases/20261110000000-abcdef1');

    result = s.rollback();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(s.link(s.site, 'current'), 'releases/20261110010000-1234567');
  } finally {
    s.cleanup();
  }
});

test('rollback without a previous release refuses and changes nothing', { skip }, () => {
  const s = server();
  try {
    s.release('20261110000000-abcdef1');
    assert.equal(s.activate('20261110000000-abcdef1').status, 0);
    const result = s.rollback();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /no previous release/);
    assert.equal(s.link(s.site, 'current'), 'releases/20261110000000-abcdef1');
  } finally {
    s.cleanup();
  }
});

test('pruning keeps five releases plus whatever current and previous point at', { skip }, () => {
  const s = server();
  try {
    // Oldest first, so modification times put the first one at the bottom.
    const names = [
      '20260101000000-0000000',
      ...Array.from({ length: 7 }, (_, i) => `2026010${i + 2}000000-000000${i}`),
    ];
    names.forEach((name, i) => {
      s.release(name);
      const when = new Date(Date.UTC(2026, 0, 1 + i));
      utimesSync(join(s.site, 'releases', name), when, when);
      utimesSync(join(s.collector, 'releases', name), when, when);
    });
    symlinkSync('releases/20260101000000-0000000', join(s.site, 'current'));
    symlinkSync('releases/20260101000000-0000000', join(s.collector, 'current'));

    s.release('20261110000000-abcdef1');
    assert.equal(s.activate('20261110000000-abcdef1').status, 0);

    const left = readdirSync(join(s.site, 'releases')).sort();
    assert.ok(left.includes('20261110000000-abcdef1'), 'the new release was pruned');
    assert.ok(left.includes('20260101000000-0000000'), 'the previous release was pruned');
    assert.equal(left.length, 6, `kept: ${left.join(', ')}`);
  } finally {
    s.cleanup();
  }
});

test('bad input and an old Node are refused before anything moves', { skip }, () => {
  const s = server();
  try {
    s.release('20261110000000-abcdef1');
    assert.match(s.activate('20261110000000-abcdef1; rm -rf /').stderr, /bad release name/);
    assert.match(s.run(['activate', '/', s.collector, '20261110000000-abcdef1']).stderr, /bad root/);
    assert.match(s.activate('20261231000000-abcdef1').stderr, /was not uploaded/);

    const oldNode = join(s.dir, 'bin', 'old-node');
    writeFileSync(oldNode, '#!/usr/bin/env bash\necho "node 20.11.0 is older than 22.13" >&2\nexit 1\n');
    chmodSync(oldNode, 0o755);
    const result = s.activate('20261110000000-abcdef1', { KORUPSI_NODE: oldNode });
    assert.match(result.stderr, /needs Node 22\.13/);

    // The old unit still runs the code from the collector root itself.
    writeFileSync(join(s.dir, 'unit'), `ExecStart=/usr/bin/node ${s.collector}/index.mjs\n`);
    assert.match(s.activate('20261110000000-abcdef1').stderr, /one-time migration/);

    assert.equal(s.link(s.site, 'current'), null);
    assert.equal(s.link(s.collector, 'current'), null);
    assert.deepEqual(s.restarts(), []);
  } finally {
    s.cleanup();
  }
});
