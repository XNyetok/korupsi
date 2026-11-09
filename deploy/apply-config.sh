#!/usr/bin/env bash
#
# Applies the server configuration of one release: the two nginx files and the
# collector's systemd unit. Installed once, by hand, as root:
#
#   install -o root -g root -m 755 deploy/apply-config.sh /usr/local/sbin/korupsi-apply-config
#
# and allowed to the deploy user through one sudoers rule (docs/deploy.md). The
# deploy runs it as:  sudo -n /usr/local/sbin/korupsi-apply-config v1.2.3
#
# The only input is a release tag. The files are downloaded from the public
# repository at that tag, never taken from the caller, so whoever holds the
# deploy key can choose which release's config is applied, but cannot write a
# config of their own. That keeps a leaked key from becoming root.
#
# On any failure the previous files are put back and nginx is left running the
# config it had. The script reads no environment variables on purpose.

set -euo pipefail
umask 022

# Tests replace this one line with a temporary directory. Nothing else changes.
PREFIX=''

REPO=XNyetok/korupsi
BACKUPS="$PREFIX/var/backups/korupsi-config"
KEEP_BACKUPS=10

# repository path | installed path
FILES=(
  "deploy/nginx/korupsi-limits.conf|$PREFIX/www/server/panel/vhost/nginx/0.korupsi-limits.conf"
  "deploy/nginx/korupsi-rewrite.conf|$PREFIX/www/server/panel/vhost/rewrite/korupsi.web.id.conf"
  "deploy/systemd/korupsi-stats.service|$PREFIX/etc/systemd/system/korupsi-stats.service"
)

die() {
  echo "apply-config: $*" >&2
  exit 1
}

[ -n "$PREFIX" ] || [ "$(id -u)" = 0 ] || die "must run as root"
[ $# -eq 1 ] || die "usage: korupsi-apply-config vX.Y.Z"
tag=$1
[[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "not a release tag: $tag"

nginx_bin=''
for candidate in "$PREFIX/www/server/nginx/sbin/nginx" "$PREFIX/usr/sbin/nginx" "$PREFIX/usr/bin/nginx"; do
  if [ -x "$candidate" ]; then nginx_bin=$candidate; break; fi
done
[ -n "$nginx_bin" ] || die "nginx not found"

work=$(mktemp -d)
chmod 700 "$work"
trap 'rm -rf -- "$work"' EXIT

# 1. Download every file first; a partial download changes nothing.
for entry in "${FILES[@]}"; do
  src=${entry%%|*}
  out="$work/new/$src"
  mkdir -p "$(dirname "$out")"
  curl -fsSL --proto '=https' --tlsv1.2 --max-time 20 --max-filesize 65536 \
    -o "$out" "https://raw.githubusercontent.com/$REPO/refs/tags/$tag/$src" \
    || die "could not download $src at $tag"
  [ -s "$out" ] || die "$src at $tag is empty"
done

# 2. Nothing to do when the server already has these exact files.
changed=()
for entry in "${FILES[@]}"; do
  src=${entry%%|*}
  dest=${entry#*|}
  cmp -s "$work/new/$src" "$dest" 2>/dev/null || changed+=("$entry")
done
if [ ${#changed[@]} -eq 0 ]; then
  echo "apply-config: $tag matches what is installed"
  exit 0
fi

# 3. Back up what is there now, including the files that will not change, so a
#    restore puts back one consistent set.
mkdir -p "$BACKUPS"
chmod 700 "$BACKUPS"
backup=$(mktemp -d "$BACKUPS/$(date -u +%Y%m%dT%H%M%SZ)-$tag.XXXX")
for entry in "${FILES[@]}"; do
  dest=${entry#*|}
  if [ -e "$dest" ]; then cp -p -- "$dest" "$backup/$(basename "$dest")"; fi
done

restore() {
  local entry dest saved
  for entry in "${FILES[@]}"; do
    dest=${entry#*|}
    saved="$backup/$(basename "$dest")"
    if [ -e "$saved" ]; then cp -p -- "$saved" "$dest"; else rm -f -- "$dest"; fi
  done
  systemctl daemon-reload || true
  if "$nginx_bin" -t >/dev/null 2>&1; then
    echo "apply-config: restored the previous files from $backup" >&2
  else
    echo "apply-config: restored $backup, but nginx -t still fails: check by hand" >&2
  fi
}

# 4. Install, then let nginx and systemd judge the result before anything reloads.
unit_changed=false
for entry in "${changed[@]}"; do
  src=${entry%%|*}
  dest=${entry#*|}
  mkdir -p -- "$(dirname "$dest")"
  install -m 644 -- "$work/new/$src" "$dest"
  echo "apply-config: installed $src"
  [[ "$dest" == *.service ]] && unit_changed=true
done

if ! "$nginx_bin" -t; then
  restore
  die "nginx -t rejected the config of $tag"
fi

if $unit_changed; then
  if ! systemd-analyze verify "$PREFIX/etc/systemd/system/korupsi-stats.service"; then
    restore
    die "systemd-analyze rejected the unit of $tag"
  fi
  systemctl daemon-reload
fi

# 5. Reload nginx. A config that passed -t can still fail to load (a missing
#    certificate, a port in use); in that case go back.
if ! "$nginx_bin" -s reload; then
  restore
  "$nginx_bin" -s reload || true
  die "nginx did not reload the config of $tag"
fi

# 6. Old backups go; the newest few stay for a manual look.
# shellcheck disable=SC2012 # backup names are timestamps and tags only
ls -1dt "$BACKUPS"/*/ | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -rf --

echo "apply-config: applied $tag (backup in $backup)"
