#!/usr/bin/env bash
# SQL-only pgTAP lane on the SECOND local Supabase stack (project wejammin_ev, DB port 55322).
# Usage: lane-db-alt.sh <checkout-abs-path> [supabase/tests/<file>.sql ...]
# The alt stack's supabase/{migrations,tests,seed.sql} are symlinks into the Slice 11 worktree,
# so it always resets to that worktree's current migrations. It has NO PostgREST/Kong: use it only
# for pgTAP files. API specs, races and full gates stay on the main stack via lane-db.sh/lane-api.sh.
# Holds /tmp/wejammin-altdb.lock for the whole reset+test; never touches the main stack's lock or DB.
set -uo pipefail
LANE="$1"; shift
ALT=/home/rob/.codex/worktrees/phase2-slice10/orchestration/altdb
SUPA=/home/rob/.codex/worktrees/phase2-slice11/WeJammin/node_modules/.bin/supabase
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
LOGS="$LANE/.lane-logs"; mkdir -p "$LOGS"; STAMP=$(date +%H%M%S)-$$
[ "$(readlink -f "$ALT/supabase/migrations")" = "$(readlink -f "$LANE/supabase/migrations")" ] || { echo "[alt] alt stack is not linked to $LANE"; exit 5; }
# Never run beside a canonical gate: wait while it holds /tmp/wejammin-quiet.lock exclusively.
exec 7>/tmp/wejammin-quiet.lock
flock -s --wait 7200 7 || { echo "[alt] quiet lock timeout"; exit 3; }
exec 9>/tmp/wejammin-altdb.lock
echo "[alt] waiting for lock $(date +%T)"; flock --wait 3600 9 || { echo "[alt] lock timeout"; exit 3; }
echo "[alt] lock acquired $(date +%T)"
if ! "$SUPA" db reset --local --workdir "$ALT" > "$LOGS/alt-reset-$STAMP.log" 2>&1; then
  echo "[alt] RESET FAILED — last lines:"; grep -v '^$' "$LOGS/alt-reset-$STAMP.log" | tail -25; exit 2; fi
echo "[alt] reset ok $(date +%T)"
IMAGE=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -m1 'supabase/pg_prove:')
PW=$(docker inspect supabase_db_wejammin_ev --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_PASSWORD=//p')
TARGETS=(); if [ $# -eq 0 ]; then TARGETS=(/w/supabase/tests); else for p in "$@"; do TARGETS+=("/w/${p#./}"); done; fi
TAP="$LOGS/alt-tap-$STAMP.tap"
PGPASSWORD="$PW" docker run --rm --network supabase_network_wejammin_ev -v "$LANE/supabase/tests:/w/supabase/tests:ro" \
  -e PGHOST=supabase_db_wejammin_ev -e PGUSER=postgres -e PGPASSWORD -e PGDATABASE=postgres \
  "$IMAGE" pg_prove -v -r --ext .sql "${TARGETS[@]}" > "$TAP" 2>&1; RC=$?
sed -i "s#/w/supabase/tests/#$LANE/supabase/tests/#g" "$TAP"
echo "[alt] pg_prove exit=$RC  full TAP: $TAP"
grep -E '^\s*not ok' "$TAP" | sed "s#$LANE/supabase/tests/##" | head -80
grep -E 'ERROR:|psql:.*FATAL' "$TAP" | sed "s#$LANE/supabase/tests/##" | head -20
awk '/Test Summary Report/,0' "$TAP" | grep -v 'NOTICE\|WARNING' | sed "s#$LANE/supabase/tests/##" | head -40
grep -E '^Files=|^Result:|^All tests successful' "$TAP" | tail -3
exit $RC
