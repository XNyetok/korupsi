# Deploy

The game is a static site. The VPS runs nginx through aaPanel, the panel owns the vhost
and the certificate, and this repository owns what nginx actually serves.

```
/www/wwwroot/korupsi.web.id/
  .well-known/                 Let's Encrypt checks, managed by the panel
  releases/
    20261109194500-a1b2c3d/    one upload per deploy, kept for rollback
  current -> releases/...      switched atomically on deploy
```

`deploy/nginx/korupsi-rewrite.conf` is copied into
`/www/server/panel/vhost/rewrite/korupsi.web.id.conf`. Nothing else on the server changes.

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
6. **Rewrite rules** — paste `deploy/nginx/korupsi-rewrite.conf` into the panel's URL
   rewrite field for the site, then `sudo nginx -t && sudo nginx -s reload`.

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

A variable missing from GitHub is an empty string in the workflow, not an error. The first
step of the deploy job ("Check deploy settings") fails the run when any of them is empty or
malformed, and `DEPLOY_PATH` must be an absolute path at least two levels deep. The
remote script also refuses to switch `current` unless the new release directory exists.

The actual values live only in the repository settings and in the operator's notes, not
in this public file.

## What a deploy does

`.github/workflows/ci.yml` does this:

1. Scan the full git history for secrets, and check tracked files. A finding fails the run.
2. Type-check and build, then upload the artifact.
3. `rsync` the build into `releases/<UTC timestamp>-<sha>/`, leaving the live site alone
   while the upload runs.
4. Point `current.next` at the new directory, then `mv -Tf current.next current` in one
   step, so no request ever sees a half-written release.
5. Keep the five newest releases, delete the rest.
6. Smoke test: `/`, `/og.png` and `/sw.js` answer 200, the live page loads the script
   this run built, and `/sw.js` is the kill switch.

The deploy only runs on `main`, and only while the repository variable `DEPLOY_ENABLED` is
`true`. Pull requests get the secret scan, the file checks, and the build, but no deploy.

The build stamps the revision into the ready screen (`rev r12-2a7e3d3`), so it is obvious
which build a bug report came from.

## Telemetry collector

The game posts anonymous events to `/api/beacon`. A small Node service keeps them in SQLite
and serves a read-only panel.

```
/opt/korupsi-stats/            code, deployed by CI, owned by deploy
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

What is stored: event type, build revision, run outcome (cause, money, height, duration,
weight), and the first line of JavaScript errors. No address, no cookie, no identifier.
Rows older than 90 days are pruned every six hours.

## Rollback

```sh
cd /www/wwwroot/korupsi.web.id
ln -sfn releases/<previous> current.next && mv -Tf current.next current
```

No rebuild, no downtime, instant. This rolls back the site only: the collector has no
release folders yet, so it stays on the latest code (see `docs/plan.md`, D1).

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
