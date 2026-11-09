# Deploy

The game is a static site. The VPS runs nginx through aaPanel, the panel owns the vhost
and the certificate, and this repository owns what nginx actually serves.

```
/www/wwwroot/korupsi.web.id/
  .well-known/                 Let's Encrypt checks, managed by the panel
  releases/
    v0.3.0-a1b2c3d/            one folder per release, the newest five kept
  current -> releases/...      what is live, switched atomically on deploy
  previous -> releases/...     what a rollback goes back to
```

Three files on the server come from this repository and are installed by the deploy (see
*Server config*): `deploy/nginx/korupsi-rewrite.conf` as the site's rewrite rules,
`deploy/nginx/korupsi-limits.conf` as the rate limit zones, and
`deploy/systemd/korupsi-stats.service` as the collector's unit.

## One-time setup

1. **DNS** — `A korupsi.web.id → <server IP>`, `CNAME www → korupsi.web.id`.
2. **Site in aaPanel** — Website → Add site. Domain `korupsi.web.id`, root
   `/www/wwwroot/korupsi.web.id`, no PHP, no database, no FTP.
3. **Certificate in aaPanel** — Site → SSL → Let's Encrypt → file verification. The panel
   writes the certificate to `/www/server/panel/vhost/cert/korupsi.web.id/` and renews it.
4. **Deploy user** — the releases are uploaded by an unprivileged user:

   ```sh
   sudo useradd -m -s /bin/bash deploy
   sudo mkdir -p /www/wwwroot/korupsi.web.id/releases
   sudo chown -R deploy:deploy /www/wwwroot/korupsi.web.id
   ```

5. **SSH key for CI** — generate a dedicated keypair, put the public half in
   `/home/deploy/.ssh/authorized_keys`, and store the private half as the repository secret
   `DEPLOY_SSH_KEY`. Never commit it.
6. **Server config** — install the apply script and its sudoers rule (see *Server config*).
   The first deploy then installs the nginx files and the unit.

## Repository secrets and variables

| Name | Kind | Value |
| --- | --- | --- |
| `DEPLOY_SSH_KEY` | secret | private key of the deploy keypair |
| `DEPLOY_KNOWN_HOSTS` | secret | output of `ssh-keyscan <server>` |
| `DEPLOY_HOST` | secret | server address; a secret so Actions masks it in logs |
| `DEPLOY_USER` | variable | the unprivileged deploy user |
| `DEPLOY_PORT` | variable | SSH port |
| `DEPLOY_PATH` | variable | site root, for example `/www/wwwroot/korupsi.web.id` |
| `DEPLOY_ENABLED` | variable | `true`, or `false` to pause deploys |

The deploy job runs in the GitHub environment `production`, which allows deploys from
protected branches only. The job runs on `main` (the release workflow is started by the
push that merges the release PR), so do not limit the environment to tags: the tag is an
input of the job, not its ref. A required reviewer can be added there to approve each
deploy.

A variable missing from GitHub is an empty string in the workflow, not an error. The first
step of the deploy job ("Check deploy settings") fails the run when any of them is empty or
malformed, and `DEPLOY_PATH` must be an absolute path at least two levels deep. The
remote script also refuses to switch `current` unless the new release directory exists.

The actual values live only in the repository settings and in the operator's notes, not
in this public file.

## Releases

Production only ever runs a tagged release.

- `.github/workflows/ci.yml` runs on every push and pull request: secret scan, file checks,
  type-check, tests, build, browser smoke tests. It never deploys, and a release is only
  deployed when all of it passes on the tag.
- `.github/workflows/release.yml` runs release-please on every push to `main`. It keeps a
  release PR open that bumps `package.json` and writes `CHANGELOG.md` from the
  Conventional Commits since the last tag. Merging that PR creates the tag and the GitHub
  Release, and the same run deploys it through `deploy.yml`.
- `.github/workflows/deploy.yml` can also be started by hand with a tag, to redeploy it or
  to roll back through CI. Use v0.3.0 or later: older tags predate the collector's release
  folders and still install the old service worker.

Before merging a release PR, edit its `CHANGELOG.md` entry into player language: what
changed in the game, not how. Operational notes (a migration, a config to reinstall) go
in this file instead.

If the organisation does not allow GitHub Actions to create pull requests, the "open the
release PR" step fails on its own and tagging still works. Open the release PR from a
machine logged in with `gh` instead:

```sh
npx release-please@17 release-pr --token="$(gh auth token)" \
  --repo-url=XNyetok/korupsi --config-file=release-please-config.json \
  --manifest-file=.release-please-manifest.json
```

GitHub starts no workflows for anything created with `GITHUB_TOKEN`. That is why the
deploy runs inside the release workflow instead of listening for the release event, and
why the release workflow starts CI on the release PR branch itself: the PR needs its
required checks to be mergeable.

One version identity, everywhere:

| Where | Format | Example |
| --- | --- | --- |
| Ready screen and telemetry, release build | `X.Y.Z+<sha7>` | `0.3.0+a1b2c3d` |
| Ready screen and telemetry, any other CI build | `X.Y.Z-dev+<sha7>` | `0.3.0-dev+9f8e7d6` |
| Local build or dev server | `X.Y.Z-dev` | `0.3.0-dev` |
| Release folders on the server | `vX.Y.Z-<sha7>` | `v0.3.0-a1b2c3d` |

`package.json` declares the Node versions it supports in `engines` (22.13 or newer, for
`node:sqlite`); CI builds with the version in `.nvmrc`.

## What a deploy does

`deploy.yml`, given a tag:

1. Check the tag looks like `vX.Y.Z`, then run the whole of `ci.yml` on it as a release
   build, and check the tag matches the version in `package.json`.
2. `rsync` the site into `releases/<release>/` under the site root and the collector into
   `releases/<release>/` under `/opt/korupsi-stats`. Nothing live changes during the upload.
3. Run `korupsi-apply-config <tag>` over SSH, which brings the nginx files and the unit
   to this release (see *Server config*). If it is not installed, the job warns and carries
   on with the files the server has.
4. Run `deploy/remote.sh activate` over SSH. It refuses to continue unless the server's
   Node is 22.13 or newer with `node:sqlite`, and the unit runs the collector through
   `current`. Then:
   - switch the collector's `current`, restart it, and wait until `/api/health` on
     `127.0.0.1` reports this release. If it does not, put the old collector back and stop,
     with the site untouched;
   - switch the site's `current` with `mv -Tf`, so no request sees a half switch;
   - record both old targets as `previous`, and keep the five newest releases plus
     whatever `current` and `previous` point at.
5. Smoke test: `/`, `/og.png` and `/sw.js` answer 200, the live page loads the script this
   run built, and `/sw.js` is the kill switch. If the smoke test fails, the job runs
   `deploy/remote.sh rollback` and fails.

The deploy only runs while the repository variable `DEPLOY_ENABLED` is `true`.

## Telemetry collector

The game posts anonymous events to `/api/beacon`. A small Node service keeps them in SQLite
and serves a read-only panel.

```
/opt/korupsi-stats/            owned by deploy
  releases/v0.3.0-a1b2c3d/     collector code for one release, with a RELEASE file
  current -> releases/...      what the unit runs
  previous -> releases/...     what a rollback goes back to
/var/lib/korupsi-stats/        stats.db, owned by the korupsi service user
/www/server/nginx/conf/.htpasswd-korupsi   panel credentials
/www/server/panel/vhost/nginx/0.korupsi-limits.conf   rate limit zone
```

- Unit: `deploy/systemd/korupsi-stats.service`, listening on `127.0.0.1:8787` only.
- nginx proxies `/api/` and `/panel/`; the panel sits behind basic auth.
- The panel password is kept in the operator's password manager, never in a file on the
  server or in this repository. Change it with `htpasswd -c <htpasswd file> <user>` (then
  `chown root:www`, `chmod 640`; nginx returns 500, not 403, when it cannot read the file).
- The deploy user may restart only this unit, through a single sudoers rule.
- A unit file change needs one manual `systemctl daemon-reload`; code changes deploy normally.

### One-time migration to collector release folders

Before the first deploy of v0.3.0 the unit has to run the collector through `current`. The
deploy refuses to switch anything until it does, so a forgotten step fails safely.

With `korupsi-apply-config` installed (next section), the deploy installs the new unit
itself. Optionally, move the running code into a folder of its own first, so the first
release has something to roll back to:

```sh
cd /opt/korupsi-stats
sudo -u deploy mkdir -p releases/legacy
sudo -u deploy mv index.mjs store.mjs panel releases/legacy/
sudo -u deploy ln -sfn releases/legacy current
```

Without the apply script, install `deploy/systemd/korupsi-stats.service` by hand, then
`systemctl daemon-reload`.

What is stored: event type, build revision, run outcome (cause, money, height, duration,
weight), and the first line of JavaScript errors. Error messages are redacted twice, in the
page (`src/platform/redact.ts`) and again on arrival (`server/redact.mjs`): URLs, inline URIs, email
addresses and host-and-path strings become `<url>` or `<email>`. Rows stored before the
redaction existed are cleaned when the collector starts. No address, no cookie, no
identifier. Rows older than 90 days are pruned every six hours.

`/api/health` is not public: nginx answers 404 for every `/api/` path except the beacon and
the authenticated stats. The deploy checks health over SSH on `127.0.0.1`.

## Server config

`deploy/apply-config.sh` brings the nginx files and the unit on the server to one release.
It is installed once, as root, and is the only thing the deploy user may run as root
besides restarting the collector:

```sh
sudo install -o root -g root -m 755 deploy/apply-config.sh /usr/local/sbin/korupsi-apply-config
echo 'deploy ALL=(root) NOPASSWD: /usr/local/sbin/korupsi-apply-config' \
  | sudo tee /etc/sudoers.d/korupsi-apply-config >/dev/null
sudo chmod 440 /etc/sudoers.d/korupsi-apply-config && sudo visudo -c
```

Its only input is a release tag. It downloads the three files from this public repository
at that tag over HTTPS, so the deploy key can choose a release but cannot supply a config
of its own; a leaked key does not become root. Then it:

1. does nothing if the server already has exactly those files;
2. backs up the current set to `/var/backups/korupsi-config/` (the newest ten are kept);
3. installs the files, runs `nginx -t`, and `systemd-analyze verify` when the unit changed;
4. reloads nginx and, for a unit change, runs `systemctl daemon-reload`. The collector is
   restarted afterwards by the deploy, on the new code.

If a check or the reload fails, it puts the backed-up set back and fails the deploy before
any release is switched. The script reads no environment variables, so `sudo` cannot be
steered into installing something else.

When `deploy/apply-config.sh` itself changes, reinstall it by hand with the first command
above: the deploy never replaces the script that runs as root.

A rollback switches code, not config: after rolling back past a config change, run
`sudo korupsi-apply-config <older tag>` too.

## Rollback

The site and the collector roll back together. On the server, as the deploy user, from a
checkout of this repository or with the script copied over:

```sh
bash deploy/remote.sh rollback /www/wwwroot/korupsi.web.id /opt/korupsi-stats
```

It swaps `current` and `previous` in both roots and restarts the collector, so running it
a second time undoes it. No rebuild, no downtime. Through CI instead: run the Deploy
workflow by hand with the older tag, which rebuilds it and deploys it like any release.

## Notes

- The CSP allows no inline script or style: Vite emits external files, and the few colours
  that used to be inline attributes live in the stylesheet. Adding an inline handler later
  will break on the live site before it breaks locally, which is the point.
- Caching: pages are `no-cache` so a deploy shows up on the next refresh; anything under
  `/assets/` is immutable for a year because the filenames are content-hashed.
- No service worker: v0.3.0 removed offline play because the old worker kept serving
  stale builds and cached the panel. `public/sw.js` is now a kill switch that deletes every
  cache, unregisters itself and reloads the tab. It must stay at `/sw.js`, uncached, until
  the old worker is gone from the wild (about three months, until 2027-02); after that,
  delete the file, its nginx location, and the smoke test line.
- TLS 1.1 is disabled on the host by hand. If the panel ever re-saves the site's SSL
  settings, check that it is still off.
