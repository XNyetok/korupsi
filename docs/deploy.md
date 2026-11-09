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

1. **DNS** — `A korupsi.web.id → <server IP>`, `CNAME www → korupsi.web.id`. Done.
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
| `DEPLOY_KNOWN_HOSTS` | secret | output of `ssh-keyscan <server IP>` |
| `DEPLOY_HOST` | variable | `<server IP>` |
| `DEPLOY_USER` | variable | `deploy` |
| `DEPLOY_PORT` | variable | `22` |
| `DEPLOY_PATH` | variable | `/www/wwwroot/korupsi.web.id` |
| `DEPLOY_ENABLED` | variable | `true`, or `false` to pause deploys |

A variable missing from GitHub is an empty string in the workflow, not an error, so the
deploy job checks them before using them.

## What a deploy does

`.github/workflows/ci.yml` follows the pattern already used on `nyetok.id`:

1. Scan the full git history for secrets, and check tracked files. A finding fails the run.
2. Type-check and build, then upload the artifact.
3. `rsync` the build into `releases/<UTC timestamp>-<sha>/`, leaving the live site alone
   while the upload runs.
4. Point `current.next` at the new directory, then `mv -Tf current.next current` in one
   step, so no request ever sees a half-written release.
5. Keep the five newest releases, delete the rest.
6. Smoke test: `curl -fsS https://korupsi.web.id/`.

The deploy only runs on `main`, and only while the repository variable `DEPLOY_ENABLED` is
`true`. Pull requests get the secret scan, the file checks, and the build, but no deploy.

The build stamps the revision into the ready screen (`rev r12-2a7e3d3`), so it is obvious
which build a bug report came from.

## Rollback

```sh
cd /www/wwwroot/korupsi.web.id
ln -sfn releases/<previous> current.next && mv -Tf current.next current
```

No rebuild, no downtime, instant.

## Notes

- The CSP allows no inline script or style: Vite emits external files, and the few colours
  that used to be inline attributes live in the stylesheet. Adding an inline handler later
  will break on the live site before it breaks locally, which is the point.
- Caching: pages are `no-cache` so a deploy shows up on the next refresh; anything under
  `/assets/` is immutable for a year because the filenames are content-hashed. `/sw.js` is
  never cached, because that file is how the browser learns there is a new version.
- Offline: `dist/sw.js` is generated at build time with the file list baked in, so the
  whole game works without a network after the first visit. The offline shell is
  `/index.html`, which the worker refreshes on every successful navigation.
- The panel serves its own default page until the first deploy writes `current`.
