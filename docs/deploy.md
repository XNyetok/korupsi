# Deploy

The game is a static site plus a small telemetry collector. It deploys the way Nyetok does:
a push to `main` that passes every check is built by GitHub Actions and copied to the VPS
over SSH, into a fresh release folder, and `current` is switched to it. The VPS runs nginx
through aaPanel; the panel owns the vhost and the certificate.

```
push to main ─► GitHub Actions: secret scan, file checks, lint, type-check, tests,
                build, size budget, browser smoke tests
                     │
                     ▼  rsync over SSH (user "deploy")
VPS  /www/wwwroot/korupsi.web.id/releases/20261110000000-a1b2c3d/   the site
     /opt/korupsi-stats/releases/20261110000000-a1b2c3d/            the collector
                     │
                     ▼  deploy/remote.sh: collector first, health check, then the site
     current ─► the new release, previous ─► the one before
```

```
/www/wwwroot/korupsi.web.id/
  .well-known/                 Let's Encrypt checks, managed by the panel
  releases/
    20261110000000-a1b2c3d/    one folder per deploy (UTC time, commit), newest five kept
  current -> releases/...      what is live, switched atomically on deploy
  previous -> releases/...     what a rollback goes back to
```

Three files on the server come from this repository but are installed by hand, like
Nyetok's: `deploy/nginx/korupsi-rewrite.conf` as the site's rewrite rules,
`deploy/nginx/korupsi-limits.conf` as the rate limit zones, and
`deploy/systemd/korupsi-stats.service` as the collector's unit. A push never touches the
server's nginx or systemd config (see *Changing the server config*).

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
6. **Server config** — install the nginx files and the unit by hand (see *Changing the
   server config*).

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
protected branches only, so only `main` can deploy.

A variable missing from GitHub is an empty string in the workflow, not an error. The first
step of the deploy job ("Check deploy settings") fails the run when any of them is empty or
malformed, and `DEPLOY_PATH` must be an absolute path at least two levels deep. The
remote script also refuses to switch `current` unless the new release directory exists.

The actual values live only in the repository settings and in the operator's notes, not
in this public file.

## Deploying

- **Change the game:** merge to `main`. When every check passes, it is live about two
  minutes later. Pull requests get every check but no deploy.
- **Deploy again without a change:** Actions → Build & deploy → Run workflow, on `main`.
- **Pause deploying:** set the repository variable `DEPLOY_ENABLED` to `false`.
- **Version number:** `package.json` holds it and the ready screen shows it. Change it by
  hand in a PR when a version is worth naming; a tag and a GitHub Release are optional.

The build stamps its identity into the ready screen and telemetry:

| Build | Label | Example |
| --- | --- | --- |
| Deployed from `main` | `X.Y.Z+<sha7>` | `0.3.0+a1b2c3d` |
| Any other CI build | `X.Y.Z-dev+<sha7>` | `0.3.0-dev+9f8e7d6` |
| Local build or dev server | `X.Y.Z-dev` | `0.3.0-dev` |

`package.json` declares the Node versions it supports in `engines` (22.13 or newer, for
`node:sqlite`); CI builds with the version in `.nvmrc`.

## What a deploy does

The `deploy` job in `.github/workflows/ci.yml`, after every other job has passed:

1. Check the deploy settings, then `rsync` the site into `releases/<release>/` under the
   site root and the collector into `releases/<release>/` under `/opt/korupsi-stats`.
   Nothing live changes during the upload.
2. Run `deploy/remote.sh activate` over SSH. It refuses to continue unless the server's
   Node is 22.13 or newer with `node:sqlite`, and the unit runs the collector through
   `current`. Then:
   - switch the collector's `current`, restart it, and wait until `/api/health` on
     `127.0.0.1` reports this release. If it does not, put the old collector back and stop,
     with the site untouched;
   - switch the site's `current` with `mv -Tf`, so no request sees a half switch;
   - record both old targets as `previous`, and keep the five newest releases plus
     whatever `current` and `previous` point at.
3. Smoke test: `/`, `/og.png` and `/sw.js` answer 200, the live page loads the script this
   run built, and `/sw.js` is the kill switch. If the smoke test fails, the job runs
   `deploy/remote.sh rollback` and fails.

## Telemetry collector

The game posts anonymous events to `/api/beacon`. A small Node service keeps them in SQLite
and serves a read-only panel.

```
/opt/korupsi-stats/            owned by deploy
  releases/20261110000000-a1b2c3d/  collector code for one deploy, with a RELEASE file
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

Since 2026-11-10 the unit runs the collector through `current`; the code that ran before
the release folders existed is kept as `releases/legacy`.

What is stored: event type, build revision, run outcome (cause, money, height, duration,
weight), and the first line of JavaScript errors. Error messages are redacted twice, in the
page (`src/platform/redact.ts`) and again on arrival (`server/redact.mjs`): URLs, inline URIs, email
addresses and host-and-path strings become `<url>` or `<email>`. Rows stored before the
redaction existed are cleaned when the collector starts. No address, no cookie, no
identifier. Rows older than 90 days are pruned every six hours.

`/api/health` is not public: nginx answers 404 for every `/api/` path except the beacon and
the authenticated stats. The deploy checks health over SSH on `127.0.0.1`.

## Changing the server config

Edit the file in `deploy/`, merge it (CI runs `nginx -t` on the repository's nginx files),
then install it from the admin account on the VPS. Other sites share this nginx: keep a
dated copy, and always run `nginx -t` before reloading.

```sh
# rewrite rules
F=/www/server/panel/vhost/rewrite/korupsi.web.id.conf
sudo cp -p "$F" "$F.bak-$(date +%F-%H%M%S)"
sudo install -m 644 /tmp/korupsi-rewrite.conf "$F"     # copied over with scp
sudo nginx -t && sudo nginx -s reload

# collector unit
sudo install -m 644 /tmp/korupsi-stats.service /etc/systemd/system/korupsi-stats.service
sudo systemctl daemon-reload && sudo systemctl restart korupsi-stats
```

## Rollback

The site and the collector roll back together. On the server, as the deploy user, from a
checkout of this repository or with the script copied over:

```sh
bash deploy/remote.sh rollback /www/wwwroot/korupsi.web.id /opt/korupsi-stats
```

It swaps `current` and `previous` in both roots and restarts the collector, so running it
a second time undoes it. No rebuild, no downtime. The next push deploys `main` again, so
revert the bad commit too.

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
