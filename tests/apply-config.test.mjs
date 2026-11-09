import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

const SCRIPT = readFileSync(new URL('../deploy/apply-config.sh', import.meta.url), 'utf8');

const SOURCES = {
  'deploy/nginx/korupsi-limits.conf': 'www/server/panel/vhost/nginx/0.korupsi-limits.conf',
  'deploy/nginx/korupsi-rewrite.conf': 'www/server/panel/vhost/rewrite/korupsi.web.id.conf',
  'deploy/systemd/korupsi-stats.service': 'etc/systemd/system/korupsi-stats.service',
};

/**
 * A fake server under a temporary root. "GitHub" is a local folder per tag;
 * curl, nginx, systemctl and systemd-analyze are stubs that log what they did.
 * nginx -t fails when any installed file contains BROKEN_NGINX, and the unit
 * check fails on BROKEN_UNIT.
 */
function server() {
  const root = mkdtempSync(join(tmpdir(), 'korupsi-apply-'));
  const bin = join(root, 'bin');
  const remote = join(root, 'github');
  const log = join(root, 'calls.log');
  mkdirSync(bin);

  const shim = (name, body) => {
    writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  };
  const installed = Object.values(SOURCES)
    .map((p) => `"${join(root, p)}"`)
    .join(' ');

  shim(
    'curl',
    `out=''; url=''
while [ $# -gt 0 ]; do case "$1" in -o) out=$2; shift 2;; -*) shift;; *) url=$1; shift;; esac; done
path=\${url#https://raw.githubusercontent.com/XNyetok/korupsi/refs/tags/}
[ -f "${remote}/$path" ] || exit 22
cp "${remote}/$path" "$out"`,
  );
  mkdirSync(join(root, 'usr/sbin'), { recursive: true });
  writeFileSync(
    join(root, 'usr/sbin/nginx'),
    `#!/usr/bin/env bash
echo "nginx $*" >> "${log}"
if [ "$1" = -t ]; then ! grep -qs BROKEN_NGINX ${installed}; exit; fi
if [ "$1" = -s ] && [ -f "${root}/reload-fails" ]; then exit 1; fi
exit 0
`,
  );
  chmodSync(join(root, 'usr/sbin/nginx'), 0o755);
  shim('systemctl', `echo "systemctl $*" >> "${log}"`);
  shim('systemd-analyze', `echo "systemd-analyze $*" >> "${log}"; ! grep -qs BROKEN_UNIT "$2"`);

  const publish = (tag, overrides = {}) => {
    for (const src of Object.keys(SOURCES)) {
      const file = join(remote, tag, src);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, overrides[src] ?? `${src} at ${tag}\n`);
    }
  };

  const run = (...args) =>
    spawnSync('bash', ['-s', '--', ...args], {
      input: SCRIPT.replace("PREFIX=''", `PREFIX='${root}'`),
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    });

  const read = (src) => {
    const file = join(root, SOURCES[src]);
    return existsSync(file) ? readFileSync(file, 'utf8') : null;
  };
  const calls = () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : []);
  const resetCalls = () => rmSync(log, { force: true });

  return { root, publish, run, read, calls, resetCalls, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const REWRITE = 'deploy/nginx/korupsi-rewrite.conf';
const UNIT = 'deploy/systemd/korupsi-stats.service';

test('apply installs every file, checks nginx and the unit, then reloads', () => {
  const s = server();
  try {
    s.publish('v0.3.0');
    const result = s.run('v0.3.0');
    assert.equal(result.status, 0, result.stderr);

    for (const src of Object.keys(SOURCES)) assert.equal(s.read(src), `${src} at v0.3.0\n`);
    const calls = s.calls();
    assert.ok(calls.indexOf('nginx -t') < calls.indexOf('nginx -s reload'), 'reload before the check');
    assert.ok(calls.some((c) => c.startsWith('systemd-analyze verify')));
    assert.ok(calls.includes('systemctl daemon-reload'));
  } finally {
    s.cleanup();
  }
});

test('the same release twice changes nothing the second time', () => {
  const s = server();
  try {
    s.publish('v0.3.0');
    assert.equal(s.run('v0.3.0').status, 0);
    s.resetCalls();

    const result = s.run('v0.3.0');
    assert.equal(result.status, 0);
    assert.match(result.stdout, /matches what is installed/);
    assert.deepEqual(s.calls(), [], 'nginx or systemd was touched');
  } finally {
    s.cleanup();
  }
});

test('a config nginx rejects is replaced by the previous files', () => {
  const s = server();
  try {
    s.publish('v0.3.0');
    assert.equal(s.run('v0.3.0').status, 0);
    s.publish('v0.3.1', { [REWRITE]: 'location { BROKEN_NGINX\n' });
    s.resetCalls();

    const result = s.run('v0.3.1');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /nginx -t rejected/);
    assert.equal(s.read(REWRITE), `${REWRITE} at v0.3.0\n`, 'the old rewrite rules are not back');
    assert.ok(!s.calls().includes('nginx -s reload'), 'a rejected config was reloaded');
  } finally {
    s.cleanup();
  }
});

test('a unit systemd rejects is replaced by the previous unit', () => {
  const s = server();
  try {
    s.publish('v0.3.0');
    assert.equal(s.run('v0.3.0').status, 0);
    s.publish('v0.3.1', { [UNIT]: '[Service]\nBROKEN_UNIT\n' });

    const result = s.run('v0.3.1');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /systemd-analyze rejected/);
    assert.equal(s.read(UNIT), `${UNIT} at v0.3.0\n`);
    assert.equal(s.read(REWRITE), `${REWRITE} at v0.3.0\n`);
  } finally {
    s.cleanup();
  }
});

test('a failed reload puts the previous files back and reloads them', () => {
  const s = server();
  try {
    s.publish('v0.3.0');
    assert.equal(s.run('v0.3.0').status, 0);
    s.publish('v0.3.1');
    writeFileSync(join(s.root, 'reload-fails'), '');

    const result = s.run('v0.3.1');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /did not reload/);
    assert.equal(s.read(REWRITE), `${REWRITE} at v0.3.0\n`);
  } finally {
    s.cleanup();
  }
});

test('a first install that fails removes the files it added', () => {
  const s = server();
  try {
    s.publish('v0.3.0', { [REWRITE]: 'BROKEN_NGINX\n' });
    assert.notEqual(s.run('v0.3.0').status, 0);
    for (const src of Object.keys(SOURCES)) assert.equal(s.read(src), null, `${src} was left behind`);
  } finally {
    s.cleanup();
  }
});

test('only a release tag is accepted, and a missing file changes nothing', () => {
  const s = server();
  try {
    s.publish('v0.3.0');
    for (const bad of ['main', 'v0.3', 'v0.3.0; id', '../v0.3.0', 'v0.3.0/../../x', '']) {
      const result = s.run(bad);
      assert.notEqual(result.status, 0, `accepted ${JSON.stringify(bad)}`);
    }
    assert.notEqual(s.run('v0.3.0', 'v0.3.1').status, 0, 'two arguments were accepted');

    assert.match(s.run('v9.9.9').stderr, /could not download/);
    for (const src of Object.keys(SOURCES)) assert.equal(s.read(src), null);
    assert.deepEqual(s.calls(), []);
  } finally {
    s.cleanup();
  }
});

test('backups are kept, the newest ten', () => {
  const s = server();
  try {
    for (let i = 0; i < 12; i++) {
      s.publish(`v0.3.${i}`);
      assert.equal(s.run(`v0.3.${i}`).status, 0);
    }
    const backups = readdirSync(join(s.root, 'var/backups/korupsi-config'));
    assert.equal(backups.length, 10, backups.join(', '));
  } finally {
    s.cleanup();
  }
});

test('the script ignores the environment it is given', () => {
  // sudo keeps a few variables; none of them may steer where files go.
  assert.doesNotMatch(SCRIPT, /\$\{?(HOME|PATH|USER|REPO_URL|KORUPSI_[A-Z_]+)\b/);
  assert.match(SCRIPT, /^PREFIX=''$/m, 'PREFIX must be a constant');
});
