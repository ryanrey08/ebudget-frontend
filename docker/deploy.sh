#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# eBudget frontend: deploy or roll back one release on the server.
#
# Called over SSH by .github/workflows/deploy.yml and rollback.yml. The Actions
# key is pinned to an installed copy of this script in root's
# ~/.ssh/authorized_keys, so it cannot open a shell:
#
#   command="sh /usr/local/sbin/ebudget-frontend-deploy",restrict ssh-ed25519 AAAA... github-actions-deploy
#
# The copy lives outside the checkout on purpose: a rollback checks out an
# older commit, which must not replace the script doing the rollback.
# Reinstall it when this file changes (a deploy warns when they differ):
#
#   install -m 0755 /root/ebudget-frontend/docker/deploy.sh /usr/local/sbin/ebudget-frontend-deploy
#
# Commands (the SSH command, or arguments when run by hand as root):
#   <sha>                          deploy <sha>
#   deploy <sha> [label]           deploy a commit CI built an image for
#   rollback [<sha>|previous] [label]
#                                  go back to an earlier release; the default
#                                  is the release before the live one
#   releases                       print the live release, the default
#                                  rollback target and recent history
#
#   <sha> is a full 40-character commit id. [label] names who asked, e.g.
#   actions-42 (letters, digits, . _ # -; at most 64 characters).
#
# stdin (deploy / rollback): line 1 registry user, line 2 a short-lived
# read-only registry token, kept out of argv, logs and ~/.docker. Needed only
# when the image is not on the server yet, so a rollback to a recent release
# works while GitHub is unreachable.
#
# Nothing is built here: GitHub Actions builds the image
# (ghcr.io/ryanrey08/ebudget-frontend:sha-<commit>) and this script pulls it,
# checks out the same commit (compose files), starts it and waits for the
# /login health check. If the new release is unhealthy, the previous commit
# and image are started again. Every attempt is appended to
# /var/lib/ebudget-frontend/releases.
# ─────────────────────────────────────────────────────────────────────────────

# Everything runs inside main(): the shell parses the whole function before
# running it, so a checkout replacing this file mid-run cannot affect it.
main() {
  set -eu

  APP_DIR=${EBUDGET_FRONTEND_DIR:-/root/ebudget-frontend}
  STATE_DIR=${EBUDGET_FRONTEND_STATE_DIR:-/var/lib/ebudget-frontend}
  RELEASES=$STATE_DIR/releases
  LOCK_FILE=${EBUDGET_FRONTEND_LOCK_FILE:-/run/lock/ebudget-frontend-deploy.lock}
  REGISTRY=ghcr.io
  REMOTE_IMAGE=ghcr.io/ryanrey08/ebudget-frontend
  CONTAINER=ebudget-frontend
  # Release images kept on the server for rollbacks without the registry.
  KEEP_RELEASES=5

  # sshd passes the pinned key's command in SSH_ORIGINAL_COMMAND. Split it
  # into words without globbing; every word is validated below.
  if [ -n "${SSH_ORIGINAL_COMMAND:-}" ]; then
    set -f
    # shellcheck disable=SC2086
    set -- $SSH_ORIGINAL_COMMAND
    set +f
  fi

  action=${1:-}
  target=
  label=
  case $action in
    deploy)
      if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then usage; fi
      target=$2
      label=${3:-}
      is_sha "$target" || fail 2 "expected a 40-character commit id, got '$target'"
      ;;
    rollback)
      if [ "$#" -gt 3 ]; then usage; fi
      target=${2:-previous}
      label=${3:-}
      [ "$target" = previous ] || is_sha "$target" \
        || fail 2 "expected a 40-character commit id or 'previous', got '$target'"
      ;;
    releases)
      if [ "$#" -ne 1 ]; then usage; fi
      cd "$APP_DIR"
      show_releases
      return 0
      ;;
    *)
      if [ "$#" -ne 1 ] || ! is_sha "$action"; then usage; fi
      target=$action
      action=deploy
      ;;
  esac
  case $label in
    *[!A-Za-z0-9._#-]*) fail 2 "label may only contain letters, digits and . _ # -" ;;
  esac
  [ "${#label}" -le 64 ] || fail 2 "label is longer than 64 characters"

  registry_user=
  registry_token=
  if [ ! -t 0 ]; then
    IFS= read -r registry_user || true
    IFS= read -r registry_token || true
  fi

  cd "$APP_DIR"
  [ -f .env.docker ] || fail 1 "$APP_DIR/.env.docker is missing (see docker/README.md)"
  mkdir -p "$STATE_DIR"

  # One deploy or rollback at a time.
  exec 9>"$LOCK_FILE"
  flock 9

  prev_sha=$(git rev-parse HEAD)
  prev_image=$(docker inspect --format '{{.Config.Image}}' "$CONTAINER" 2>/dev/null || true)
  switching=0

  # The first run starts the history with what is live. Its image (built on
  # the server before images came from CI) gets the release tag, so it can
  # be rolled back to like any other release.
  if [ ! -s "$RELEASES" ] && [ -n "$prev_image" ]; then
    if ! docker image inspect "$REMOTE_IMAGE:sha-$prev_sha" >/dev/null 2>&1; then
      docker tag "$prev_image" "$REMOTE_IMAGE:sha-$prev_sha"
    fi
    record deploy "$prev_sha" already-live
  fi

  if [ "$action" = rollback ]; then
    if [ "$target" = previous ]; then
      target=$(previous_release "$prev_sha")
      [ -n "$target" ] || fail 1 "no earlier release in $RELEASES to roll back to"
    fi
    [ "$target" != "$prev_sha" ] || fail 1 "$target is already live"
  fi

  DOCKER_CONFIG=$(mktemp -d)
  export DOCKER_CONFIG
  trap cleanup EXIT

  echo "deploy: $action to $target (live: $prev_sha)"
  ensure_image "$target"
  ensure_commit "$target"

  switching=1

  echo "deploy: checking out $target"
  # .env.docker is git-ignored, so it is kept.
  git reset --quiet --hard "$target"

  echo "deploy: starting $REMOTE_IMAGE:sha-$target"
  # The shell's value wins over .env.docker when Compose resolves the image.
  FRONTEND_IMAGE=$REMOTE_IMAGE:sha-$target
  export FRONTEND_IMAGE
  compose up -d --no-build --wait --wait-timeout 180

  switching=0
  record "$action" "$target" "${label:--}"
  echo "deploy: $target is live ($action)"
  compose ps

  prune_images "$target"
  if [ "$action" = deploy ] && ! cmp -s "$0" "$APP_DIR/docker/deploy.sh"; then
    echo "deploy: WARNING $0 differs from docker/deploy.sh in this release." >&2
    echo "deploy: reinstall it: install -m 0755 $APP_DIR/docker/deploy.sh $0" >&2
  fi
}

compose() {
  docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml "$@"
}

usage() {
  fail 2 "usage: <sha> | deploy <sha> [label] | rollback [<sha>|previous] [label] | releases"
}

fail() {
  code=$1
  shift
  echo "deploy: $*" >&2
  exit "$code"
}

is_sha() {
  case $1 in
    "" | *[!0-9a-f]*) return 1 ;;
  esac
  [ "${#1}" -eq 40 ]
}

# Appends one line: time, action, commit, label.
record() {
  printf '%s %s %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" "$3" >>"$RELEASES"
}

# The release deployed before the live one. Only successful deploys count, so
# repeated rollbacks keep walking back: deploy A, B, C, rollback (to B),
# rollback (to A).
previous_release() {
  [ -f "$RELEASES" ] || return 0
  awk -v live="$1" '
    $2 == "deploy" && $3 != last { n++; s[n] = $3; last = $3 }
    END {
      for (i = n; i >= 1; i--) if (s[i] == live) { if (i > 1) print s[i - 1]; exit }
      for (i = n; i >= 1; i--) if (s[i] != live) { print s[i]; exit }
    }' "$RELEASES"
}

show_releases() {
  live=$(git rev-parse HEAD)
  echo "live=$live"
  echo "previous=$(previous_release "$live")"
  echo "history (newest last):"
  if [ -f "$RELEASES" ]; then tail -n 20 "$RELEASES"; fi
}

ensure_image() {
  ref=$REMOTE_IMAGE:sha-$1
  if docker image inspect "$ref" >/dev/null 2>&1; then
    echo "deploy: using $ref already on the server"
    return 0
  fi
  if [ -z "$registry_user" ] || [ -z "$registry_token" ]; then
    fail 2 "$ref is not on the server; send a registry user and token on stdin to pull it"
  fi
  echo "deploy: pulling $ref"
  printf '%s' "$registry_token" | docker login "$REGISTRY" -u "$registry_user" --password-stdin >/dev/null
  docker pull --quiet "$ref" >/dev/null
}

ensure_commit() {
  if ! git cat-file -e "$1^{commit}" 2>/dev/null; then
    git fetch --quiet origin
    git cat-file -e "$1^{commit}" 2>/dev/null || fail 1 "commit $1 is not on origin"
  fi
}

# Starts the commit and image that were live before this run again.
restore_previous() {
  echo "deploy: failed, restoring $prev_sha" >&2
  compose logs --tail 50 frontend >&2 || true
  git reset --quiet --hard "$prev_sha"
  if [ -n "$prev_image" ]; then
    FRONTEND_IMAGE=$prev_image
    export FRONTEND_IMAGE
    if compose up -d --no-build --wait --wait-timeout 180; then
      echo "deploy: $prev_sha restored" >&2
    else
      echo "deploy: RESTORE FAILED, check 'docker compose ps' on the server" >&2
    fi
  fi
}

cleanup() {
  status=$?
  rm -rf "$DOCKER_CONFIG"
  if [ "$status" -ne 0 ] && [ "$switching" -eq 1 ]; then
    switching=0
    record "$action-failed" "$target" "${label:--}"
    restore_previous
  fi
  exit "$status"
}

# Keeps the images of the live release and the last few releases, so they can
# be rolled back to without the registry; removes other release images.
prune_images() {
  keep=$(awk -v n="$KEEP_RELEASES" '
    $2 == "deploy" || $2 == "rollback" { s[++c] = $3 }
    END { for (i = c; i >= 1 && k < n; i--) if (!(s[i] in seen)) { seen[s[i]] = 1; k++; print s[i] } }' "$RELEASES")
  docker image ls "$REMOTE_IMAGE" --format '{{.Tag}}' | grep '^sha-' | while read -r tag; do
    sha=${tag#sha-}
    if [ "$sha" != "$1" ] && ! printf '%s\n' "$keep" | grep -qx "$sha"; then
      docker image rm "$REMOTE_IMAGE:$tag" >/dev/null 2>&1 || true
    fi
  done
  docker image prune -f >/dev/null || true
}

main "$@"
