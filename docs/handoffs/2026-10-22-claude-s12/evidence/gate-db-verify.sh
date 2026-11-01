#!/usr/bin/env bash
# Canonical `pnpm db:verify` (root) under the quiet and CI locks, log + SHA-256 under .lane-logs/canonical/.
set -uo pipefail
W=/home/rob/.codex/worktrees/phase2-slice12/WeJammin
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
STAMP=$(date -u +%Y%m%dT%H%M%SZ); LOG=$W/.lane-logs/canonical/db-verify-$STAMP.log; mkdir -p "$W/.lane-logs/canonical"
cd "$W" || exit 4
# Lock order is the lane runner's (lane-db-alt-staged.sh): CI lock first, then the quiet lock. The reverse order
# deadlocked against a queued ALT run on 2026-10-29 (it held CI and waited for quiet; this held quiet and waited for CI).
exec 9>/tmp/wejammin-supabase-ci.lock; flock --wait 3600 9 || { echo "CI lock timeout" > "$LOG"; exit 3; }
exec 7>/tmp/wejammin-quiet.lock; flock --wait 7200 7 || { echo "quiet lock timeout" > "$LOG"; exit 3; }
{ echo "[db-verify] HEAD=$(git rev-parse HEAD) dirty-count: $(git status --porcelain | wc -l) start=$(date -u +%FT%TZ)"; } > "$LOG"
S=$(date +%s); pnpm db:verify >> "$LOG" 2>&1; RC=$?
echo "[db-verify] exit=$RC elapsed=$(( $(date +%s)-S ))s end=$(date -u +%FT%TZ)" >> "$LOG"
sha256sum "$LOG" > "${LOG%.log}.sha256"; echo "LOG=$LOG RC=$RC"
