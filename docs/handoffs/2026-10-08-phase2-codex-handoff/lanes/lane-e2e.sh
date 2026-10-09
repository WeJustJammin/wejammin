#!/usr/bin/env bash
# Serialized real-route browser run for one checkout (lane P). Usage: lane-e2e.sh <checkout-abs-path> <command...>
# Same lock + reset semantics as lane-db.sh/lane-api.sh: takes /tmp/wejammin-supabase-ci.lock for the WHOLE run, resets the
# SHARED local Supabase DB to the checkout's migrations, then runs the given command (e.g. a focused playwright invocation)
# from the checkout (LANE_E2E_NO_RESET=1 skips the reset for quick debug probes). The lock is held until the command exits, so lane H cannot reset the DB under a running browser suite.
set -uo pipefail
LANE="$1"; shift
SUPA=/home/rob/.codex/worktrees/phase2-slice11/WeJammin/node_modules/.bin/supabase
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
LOGS="$LANE/.lane-logs"; mkdir -p "$LOGS"; STAMP=$(date +%H%M%S)
exec 9>/tmp/wejammin-supabase-ci.lock
echo "[lane-e2e] waiting for lock $(date +%T)"; flock --wait 3600 9 || { echo "[lane-e2e] lock timeout"; exit 3; }
echo "[lane-e2e] lock acquired $(date +%T)"; cd "$LANE" || exit 4
if [ "${LANE_E2E_NO_RESET:-0}" = "1" ]; then
  echo "[lane-e2e] reset skipped (LANE_E2E_NO_RESET=1; debug runs only) $(date +%T)"
else
  "$SUPA" db reset --local --workdir "$LANE" > "$LOGS/e2e-reset-$STAMP.log" 2>&1 || { echo "[lane-e2e] RESET FAILED"; tail -25 "$LOGS/e2e-reset-$STAMP.log"; exit 2; }
  echo "[lane-e2e] reset ok $(date +%T)"
fi
"$@"; RC=$?
echo "[lane-e2e] command exit=$RC $(date +%T)"
exit $RC
