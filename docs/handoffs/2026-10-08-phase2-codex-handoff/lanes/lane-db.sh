#!/usr/bin/env bash
# Serialized DB check for one checkout. Usage: lane-db.sh <checkout-abs-path> [supabase/tests/<file>.sql ...]
# Resets the SHARED local Supabase DB to the checkout's migrations, then runs the given pgTAP files (all when none).
# Holds /tmp/wejammin-supabase-ci.lock (also taken by CI's infra/verify-database.sh) for the whole reset+test.
set -uo pipefail
LANE="$1"; shift
SUPA=/home/rob/.codex/worktrees/phase2-slice11/WeJammin/node_modules/.bin/supabase
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
LOGS="$LANE/.lane-logs"; mkdir -p "$LOGS"; STAMP=$(date +%H%M%S)
exec 9>/tmp/wejammin-supabase-ci.lock
echo "[lane-db] waiting for lock $(date +%T)"; flock --wait 3600 9 || { echo "[lane-db] lock timeout"; exit 3; }
echo "[lane-db] lock acquired $(date +%T)"; cd "$LANE" || exit 4
if ! "$SUPA" db reset --local --workdir "$LANE" > "$LOGS/reset-$STAMP.log" 2>&1; then
  echo "[lane-db] RESET FAILED — last lines:"; grep -v '^$' "$LOGS/reset-$STAMP.log" | tail -25; exit 2; fi
echo "[lane-db] reset ok $(date +%T)"
TAP="$LOGS/tap-$STAMP.tap"
node "$LANE/infra/run-pgtap-verbose.mjs" --out "$TAP" "$@"; RC=$?
echo "[lane-db] pg_prove exit=$RC  full TAP: $TAP"
grep -E '^\s*not ok' "$TAP" | sed "s#$LANE/supabase/tests/##" | head -80
grep -E 'ERROR:|psql:.*FATAL' "$TAP" | sed "s#$LANE/supabase/tests/##" | head -20
awk '/Test Summary Report/,0' "$TAP" | grep -v 'NOTICE\|WARNING' | sed "s#$LANE/supabase/tests/##" | head -40
grep -E '^Files=|^Result:|^All tests successful' "$TAP" | tail -3
exit $RC
