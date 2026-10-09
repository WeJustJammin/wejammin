#!/usr/bin/env bash
# Serialized PostgREST (real stack) vitest run. Usage: lane-api.sh <checkout-abs-path> [tests/postgrest/<file>.apispec.ts ...]
# Resets the shared DB to the checkout's migrations under the CI lock, then runs vitest with vitest.postgrest.config.ts.
set -uo pipefail
LANE="$1"; shift
SUPA=/home/rob/.codex/worktrees/phase2-slice11/WeJammin/node_modules/.bin/supabase
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
LOGS="$LANE/.lane-logs"; mkdir -p "$LOGS"; STAMP=$(date +%H%M%S)
exec 9>/tmp/wejammin-supabase-ci.lock
flock --wait 3600 9 || { echo "[lane-api] lock timeout"; exit 3; }
cd "$LANE" || exit 4
"$SUPA" db reset --local --workdir "$LANE" > "$LOGS/api-reset-$STAMP.log" 2>&1 || { echo "[lane-api] RESET FAILED"; tail -25 "$LOGS/api-reset-$STAMP.log"; exit 2; }
pnpm exec vitest run --config vitest.postgrest.config.ts "$@" > "$LOGS/api-$STAMP.log" 2>&1; RC=$?
echo "[lane-api] exit=$RC full log: $LOGS/api-$STAMP.log"
grep -E '×|FAIL|Test Files|Tests  ' "$LOGS/api-$STAMP.log" | head -60
exit $RC
