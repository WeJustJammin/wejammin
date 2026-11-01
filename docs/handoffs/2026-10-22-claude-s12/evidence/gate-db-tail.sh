#!/usr/bin/env bash
# The tail of canonical `pnpm db:verify` (root): db:reset, db:api-test, db:races, db:types:check, under the quiet and CI
# locks. Use only when db:lint and db:test already passed on the same migration bytes in this session's db:verify log
# (2026-10-29: db:test PASS 489/31,660, then two never-run latency apispecs failed on test defects, fixed).
set -uo pipefail
W=/home/rob/.codex/worktrees/phase2-slice12/WeJammin
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
STAMP=$(date -u +%Y%m%dT%H%M%SZ); LOG=$W/.lane-logs/canonical/db-tail-$STAMP.log; mkdir -p "$W/.lane-logs/canonical"
cd "$W" || exit 4
# Lock order is the lane runner's (lane-db-alt-staged.sh): CI lock first, then the quiet lock. The reverse order
# deadlocked against a queued ALT run on 2026-10-29 (it held CI and waited for quiet; this held quiet and waited for CI).
exec 9>/tmp/wejammin-supabase-ci.lock; flock --wait 7200 9 || { echo "CI lock timeout" > "$LOG"; exit 3; }
exec 7>/tmp/wejammin-quiet.lock; flock --wait 7200 7 || { echo "quiet lock timeout" > "$LOG"; exit 3; }
echo "[db-tail] HEAD=$(git rev-parse HEAD) migrations-sha=$(cat supabase/migrations/*.sql | sha256sum | cut -c1-16) start=$(date -u +%FT%TZ)" > "$LOG"
S=$(date +%s)
pnpm db:reset >> "$LOG" 2>&1 && pnpm db:api-test >> "$LOG" 2>&1 && pnpm db:races >> "$LOG" 2>&1 && pnpm db:types:check >> "$LOG" 2>&1; RC=$?
echo "[db-tail] exit=$RC elapsed=$(( $(date +%s)-S ))s end=$(date -u +%FT%TZ)" >> "$LOG"
sha256sum "$LOG" > "${LOG%.log}.sha256"; echo "LOG=$LOG RC=$RC"
