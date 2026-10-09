#!/usr/bin/env bash
# pgTAP runner on the SECOND, isolated Supabase DB stack (project wejammin_ev, port 55322) for evidence lanes.
# Usage: lane-db-ev.sh [supabase/tests/<file>.sql ...]   (always the integration checkout's migrations + tests)
# Own lock (/tmp/wejammin-ev-db.lock) — never contends with the main stack, CI, or the real-route e2e suite.
set -uo pipefail
LANE=/home/rob/.codex/worktrees/phase2-slice11/WeJammin
ALT=/home/rob/.codex/worktrees/phase2-slice10/orchestration/altdb
SUPA=$LANE/node_modules/.bin/supabase
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
LOGS=/home/rob/.codex/worktrees/phase2-slice10/orchestration/logs/ev; mkdir -p "$LOGS"; STAMP=$(date +%H%M%S)-$$
exec 9>/tmp/wejammin-ev-db.lock
flock --wait 3600 9 || { echo "[ev-db] lock timeout"; exit 3; }
echo "[ev-db] lock acquired $(date +%T)"
if ! "$SUPA" db reset --local --workdir "$ALT" > "$LOGS/reset-$STAMP.log" 2>&1; then
  echo "[ev-db] RESET FAILED"; grep -v '^$' "$LOGS/reset-$STAMP.log" | tail -25; exit 2; fi
IMG=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -m1 'supabase/pg_prove:')
PW=$(docker inspect supabase_db_wejammin_ev --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_PASSWORD=//p')
TARGETS=(); if [ $# -eq 0 ]; then TARGETS=(/w/supabase/tests); else for f in "$@"; do TARGETS+=("/w/${f#./}"); done; fi
TAP="$LOGS/tap-$STAMP.tap"
docker run --rm --network supabase_network_wejammin_ev -v "$LANE/supabase/tests:/w/supabase/tests:ro" \
  -e PGHOST=supabase_db_wejammin_ev -e PGUSER=postgres -e PGPASSWORD="$PW" -e PGDATABASE=postgres \
  "$IMG" pg_prove -v -r --ext .sql "${TARGETS[@]}" > "$TAP" 2>&1; RC=$?
sed -i "s#/w/supabase/tests/#$LANE/supabase/tests/#g" "$TAP"
echo "[ev-db] pg_prove exit=$RC  full TAP: $TAP"
grep -E '^\s*not ok' "$TAP" | sed "s#$LANE/supabase/tests/##" | head -80
grep -E 'ERROR:|FATAL' "$TAP" | sed "s#$LANE/supabase/tests/##" | head -20
awk '/Test Summary Report/,0' "$TAP" | grep -v 'NOTICE\|WARNING' | sed "s#$LANE/supabase/tests/##" | head -40
grep -E '^Files=|^Result:|^All tests successful' "$TAP" | tail -3
exit $RC
