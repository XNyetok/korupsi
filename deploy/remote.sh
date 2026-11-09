#!/usr/bin/env bash
#
# Runs on the server as the deploy user. The deploy workflow feeds it over SSH:
#
#   ssh ... bash -s -- activate <site-root> <collector-root> <release> < deploy/remote.sh
#   ssh ... bash -s -- rollback <site-root> <collector-root>           < deploy/remote.sh
#
# Both roots hold releases/<name>/ plus two symlinks: current (what is live)
# and previous (what rollback goes back to). An operator can run the same file
# by hand: bash deploy/remote.sh rollback <site-root> <collector-root>

set -euo pipefail

HEALTH_URL=${KORUPSI_HEALTH_URL:-http://127.0.0.1:8787/api/health}
NODE=${KORUPSI_NODE:-/usr/bin/node}
KEEP=5

die() {
  echo "remote: $*" >&2
  exit 1
}

check_root() {
  # Absolute, at least two levels deep, no "..", no shell characters.
  [[ "$1" =~ ^/[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)+$ && "$1" != *..* ]] || die "bad root: $1"
  [ -d "$1/releases" ] || die "$1/releases does not exist"
}

# Point <root>/<link> at <target> in one step, so no request sees a half switch.
relink() {
  ln -sfn "$3" "$1/$2.next"
  mv -Tf "$1/$2.next" "$1/$2"
}

target() {
  readlink "$1/$2" 2>/dev/null || true
}

check_node() {
  [ -x "$NODE" ] || die "$NODE does not exist"
  # shellcheck disable=SC2016 # the backticks are JavaScript, not shell
  "$NODE" --no-warnings -e '
    const [major, minor] = process.versions.node.split(".").map(Number);
    if (major < 22 || (major === 22 && minor < 13)) {
      console.error(`node ${process.versions.node} is older than 22.13`);
      process.exit(1);
    }
    require("node:sqlite");
  ' || die "the collector needs Node 22.13 or newer, with node:sqlite"
}

restart_collector() {
  sudo -n /usr/bin/systemctl restart korupsi-stats
}

# Healthy, and when a release is named, running that release.
collector_healthy() {
  local want=$1 body
  for _ in $(seq 1 "${KORUPSI_HEALTH_TRIES:-20}"); do
    body=$(curl -fsS --max-time 2 "$HEALTH_URL" 2>/dev/null || true)
    if [[ "$body" == *'"ok":true'* ]] && { [ -z "$want" ] || [[ "$body" == *"\"release\":\"$want\""* ]]; }; then
      return 0
    fi
    sleep 0.5
  done
  echo "remote: last health answer: ${body:-none}" >&2
  return 1
}

# Keep the newest releases, and never the ones current or previous point at.
prune() {
  local root=$1 keep_current keep_previous dir name
  keep_current=$(target "$root" current)
  keep_previous=$(target "$root" previous)
  # shellcheck disable=SC2012 # release names are checked to be [A-Za-z0-9.-] only
  while IFS= read -r dir; do
    dir=${dir%/}
    name="releases/${dir##*/}"
    if [ "$name" = "$keep_current" ] || [ "$name" = "$keep_previous" ]; then continue; fi
    rm -rf -- "$dir"
  done < <(ls -1dt "$root"/releases/*/ | tail -n +$((KEEP + 1)))
}

activate() {
  local site=$1 collector=$2 release=$3 old_site old_collector
  [[ "$release" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?-[0-9a-f]{7}$ ]] || die "bad release name: $release"
  check_root "$site"
  check_root "$collector"
  [ -f "$site/releases/$release/index.html" ] || die "site release $release was not uploaded"
  [ -f "$collector/releases/$release/index.mjs" ] || die "collector release $release was not uploaded"
  check_node
  # The unit has to run the code through "current", or a switch changes nothing.
  systemctl cat korupsi-stats 2>/dev/null | grep -qF "$collector/current/" \
    || die "korupsi-stats does not run $collector/current yet: do the one-time migration in docs/deploy.md"

  old_site=$(target "$site" current)
  old_collector=$(target "$collector" current)

  # 1. The collector first: if it does not come up, the site stays where it was.
  relink "$collector" current "releases/$release"
  restart_collector || true
  if ! collector_healthy "$release"; then
    echo "remote: collector $release failed its health check" >&2
    if [ -n "$old_collector" ]; then
      relink "$collector" current "$old_collector"
      restart_collector || true
      collector_healthy "" && echo "remote: collector restored to $old_collector" >&2 \
        || echo "remote: the restored collector is not healthy either" >&2
    fi
    exit 1
  fi

  # 2. The site.
  relink "$site" current "releases/$release"

  # 3. Remember what to go back to, then tidy up.
  if [ -n "$old_site" ] && [ "$old_site" != "releases/$release" ]; then relink "$site" previous "$old_site"; fi
  if [ -n "$old_collector" ] && [ "$old_collector" != "releases/$release" ]; then
    relink "$collector" previous "$old_collector"
  fi
  prune "$site"
  prune "$collector"

  echo "Live: $release (previous site: ${old_site:-none}, previous collector: ${old_collector:-none})"
}

# Swap current and previous in both roots: running it twice undoes it.
rollback() {
  local site=$1 collector=$2 root cur prev failed=0
  check_root "$site"
  check_root "$collector"
  for root in "$collector" "$site"; do
    [ -n "$(target "$root" previous)" ] || die "no previous release recorded in $root"
  done

  for root in "$collector" "$site"; do
    cur=$(target "$root" current)
    prev=$(target "$root" previous)
    relink "$root" current "$prev"
    if [ -n "$cur" ]; then relink "$root" previous "$cur"; fi
    echo "Rolled back $root: $cur -> $prev"
    if [ "$root" = "$collector" ]; then
      restart_collector || true
      # Keep going: the site goes back even when the collector does not come up.
      collector_healthy "" || { echo "remote: the collector is not healthy after the rollback" >&2; failed=1; }
    fi
  done
  return "$failed"
}

command=${1:-}
shift || true
case "$command" in
  activate) [ $# -eq 3 ] || die "usage: activate <site-root> <collector-root> <release>"; activate "$@" ;;
  rollback) [ $# -eq 2 ] || die "usage: rollback <site-root> <collector-root>"; rollback "$@" ;;
  *) die "usage: activate|rollback ..." ;;
esac
