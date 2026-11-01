#!/usr/bin/env bash
# Staged pgTAP run on the ALT Supabase stack (project wejammin_ev, container supabase_db_wejammin_ev).
#
# Usage: lane-db-alt-staged.sh <worktree-abs-path> <lane> <supabase/tests/file.sql> [more test files]
# An explicitly named target ending .sqlinc switches pg_prove to explicit-entry mode: every named
# target must then be an existing regular file, and .sqlinc joins the .sql extension (recursive
# directory runs are unchanged and never pick up .sqlinc).
#
# Why: the ALT stack's supabase/migrations is a symlink into the worktree, so a reset applies every
# migration there. Parallel SQL lanes would break each other with in-progress migrations. Each lane
# keeps unpromoted migrations in <worktree>/supabase/migrations-wip/<lane>/. This runner builds a
# private directory holding the promoted migrations plus that lane's WIP migrations only, points the
# ALT migrations symlink at it for one reset + pg_prove, then restores the symlink before the ALT lock
# is released. The same lane name must be used for every run of a lane. Use lane "none" for a run of
# promoted migrations only.
#
# Locks, outermost first: /tmp/wejammin-supabase-ci.lock (exclusive), /tmp/wejammin-quiet.lock (shared),
# /tmp/wejammin-altdb.lock (exclusive), /tmp/wejammin-reset.lock (around the reset).
# One invocation is one run. Never loop this script. Do not wrap it in `timeout`: waits for the locks can
# be long; a killed run is repaired by the next run, but its result is lost.
set -uo pipefail
WT="$1"; LANE="$2"; shift 2
[ $# -ge 1 ] || { echo "[staged] name at least one test file"; exit 64; }
case "$LANE" in *[!a-z0-9_,-]*|'') echo "[staged] lane must match [a-z0-9_,-]+ (comma list stages several WIP lanes)"; exit 64;; esac

# Explicit-entry .sqlinc mode. Recursive .sql runs keep the hardcoded .sql extension and are
# unaffected: .sqlinc is only added when a named target explicitly ends in .sqlinc, and only for
# regular files. A directory or non-file target in that mode is rejected here, before staging and
# before the reset. The .sqlinc extension is appended at most once.
PG_EXTENSIONS=(--ext .sql)
SQLINC_TARGET=0
for p in "$@"; do case "$p" in *.sqlinc) SQLINC_TARGET=1;; esac; done
if [ "$SQLINC_TARGET" -eq 1 ]; then
  for p in "$@"; do
    [ -f "$WT/${p#./}" ] || { echo "[staged] explicit .sqlinc run requires every target to be an existing regular file: $p"; exit 64; }
  done
  PG_EXTENSIONS+=(--ext .sqlinc)
fi
ALT=/home/rob/.codex/worktrees/phase2-slice10/orchestration/altdb
SUPA=/home/rob/.codex/worktrees/phase2-slice11/WeJammin/node_modules/.bin/supabase
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
LOGS="$WT/.lane-logs"; mkdir -p "$LOGS"; STAMP=$(date +%H%M%S)-$$
PROMOTED="$WT/supabase/migrations"
LANES_LIST=$(printf '%s' "$LANE" | tr ',' ' ')
[ "$(readlink -f "$ALT/supabase/tests")" = "$(readlink -f "$WT/supabase/tests")" ] || { echo "[staged] ALT tests not linked to $WT"; exit 5; }

exec 6>/tmp/wejammin-supabase-ci.lock
echo "[staged] waiting for CI lock $(date +%T)"; flock --wait 7200 6 || { echo "[staged] CI lock timeout"; exit 3; }
exec 7>/tmp/wejammin-quiet.lock
flock -s --wait 7200 7 || { echo "[staged] quiet lock timeout"; exit 3; }
exec 9>/tmp/wejammin-altdb.lock
echo "[staged] waiting for ALT lock $(date +%T)"; flock --wait 7200 9 || { echo "[staged] ALT lock timeout"; exit 3; }
echo "[staged] ALT lock acquired $(date +%T) lane=$LANE"

ORIG_LINK=$(readlink "$ALT/supabase/migrations")
# A previous staged run killed before its restore can leave the link on a temp stage dir. We hold the
# ALT lock, so no run is live: repair the link back to the promoted directory.
case "$ORIG_LINK" in /tmp/wejammin-alt-stage-*)
  echo "[staged] repairing stale stage link $ORIG_LINK"; ln -sfn "$PROMOTED" "$ALT/supabase/migrations"
  rm -rf "$ORIG_LINK"; ORIG_LINK=$(readlink "$ALT/supabase/migrations");;
esac
[ "$(readlink -f "$ORIG_LINK")" = "$(readlink -f "$PROMOTED")" ] || { echo "[staged] ALT migrations link is $ORIG_LINK, expected $PROMOTED; refusing"; exit 5; }
STAGE=$(mktemp -d /tmp/wejammin-alt-stage-XXXXXX)
restore() {
  ln -sfn "$ORIG_LINK" "$ALT/supabase/migrations"
  [ "$(readlink "$ALT/supabase/migrations")" = "$ORIG_LINK" ] || echo "[staged] WARNING: ALT migrations link NOT restored"
  rm -rf "$STAGE"
}
trap restore EXIT
trap 'exit 143' TERM HUP INT

cp -p "$PROMOTED"/*.sql "$STAGE"/ || { echo "[staged] copy of promoted migrations failed"; exit 4; }
NWIP=0
for L in $LANES_LIST; do
  [ "$L" = none ] && continue
  WIP="$WT/supabase/migrations-wip/$L"
  [ -d "$WIP" ] || { echo "[staged] no WIP directory for lane $L"; exit 4; }
  for f in "$WIP"/*.sql; do
    [ -e "$f" ] || continue
    b=$(basename "$f")
    [ -e "$STAGE/$b" ] && { echo "[staged] WIP $b collides with a promoted migration"; exit 4; }
    ts=${b%%_*}
    ls "$STAGE"/"$ts"_*.sql >/dev/null 2>&1 && { echo "[staged] WIP timestamp $ts already used"; exit 4; }
    cp -p "$f" "$STAGE/$b"; NWIP=$((NWIP+1))
  done
done
{ echo "lane=$LANE promoted=$(ls "$PROMOTED"/*.sql | wc -l) wip=$NWIP"; (cd "$STAGE" && sha256sum *.sql); } > "$LOGS/alt-staged-${LANE//,/+}-$STAMP.manifest"
ln -sfn "$STAGE" "$ALT/supabase/migrations"

if ! flock --wait 900 /tmp/wejammin-reset.lock "$SUPA" db reset --local --workdir "$ALT" > "$LOGS/alt-staged-${LANE//,/+}-$STAMP.reset.log" 2>&1; then
  echo "[staged] RESET FAILED — last lines:"; grep -v '^$' "$LOGS/alt-staged-${LANE//,/+}-$STAMP.reset.log" | tail -25; exit 2; fi
echo "[staged] reset ok $(date +%T) (wip migrations: $NWIP)"
IMAGE=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -m1 'supabase/pg_prove:')
PW=$(docker inspect supabase_db_wejammin_ev --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_PASSWORD=//p')
TARGETS=(); for p in "$@"; do TARGETS+=("/w/${p#./}"); done
TAP="$LOGS/alt-staged-${LANE//,/+}-$STAMP.tap"
PGPASSWORD="$PW" docker run --rm --network supabase_network_wejammin_ev -v "$WT/supabase/tests:/w/supabase/tests:ro" \
  -e PGHOST=supabase_db_wejammin_ev -e PGUSER=postgres -e PGPASSWORD -e PGDATABASE=postgres \
  "$IMAGE" pg_prove -v -r "${PG_EXTENSIONS[@]}" "${TARGETS[@]}" > "$TAP" 2>&1; RC=$?
sed -i "s#/w/supabase/tests/#$WT/supabase/tests/#g" "$TAP"
echo "[staged] pg_prove exit=$RC  TAP: $TAP  manifest: $LOGS/alt-staged-${LANE//,/+}-$STAMP.manifest"
grep -E '^\s*not ok' "$TAP" | sed "s#$WT/supabase/tests/##" | head -60
grep -E 'ERROR:|psql:.*FATAL' "$TAP" | sed "s#$WT/supabase/tests/##" | head -20
awk '/Test Summary Report/,0' "$TAP" | grep -v 'NOTICE\|WARNING' | sed "s#$WT/supabase/tests/##" | head -30
grep -E '^Files=|^Result:|^All tests successful' "$TAP" | tail -3
exit $RC
