#!/usr/bin/env bash
# Canonical `pnpm db:verify` for the Slice 11 worktree: exclusive quiet lock (no lane runs beside it),
# shared CI lock, post-reset, log + SHA-256 under .lane-logs/.
#
# Fail-closed contract:
#   * A non-zero `pnpm db:verify` is propagated as the run's exit code, and a failed post-reset is
#     propagated when db:verify passed. The final `[dbverify] gate RC=` line names both apart.
#   * A failed evidence hash write fails the run (exit 5) even when db:verify and the post-reset pass.
#   * The log is complete before it is hashed, so the recorded SHA-256 covers the final log.
#
# Usage: gate-db-verify.sh [checkout]
set -uo pipefail
W="${1:-/home/rob/.codex/worktrees/phase2-slice11/WeJammin}"
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
STAMP=$(date +%Y%m%d-%H%M%S); LOG=$W/.lane-logs/claude-dbverify-$STAMP.log; mkdir -p "$W/.lane-logs"
cd "$W" || exit 4
{ echo "[dbverify] HEAD=$(git rev-parse HEAD) dirty: $(git status --porcelain | tr '\n' ' ')"
  echo "[dbverify] node=$(node --version) pnpm=$(pnpm --version) active CI: $(gh run list --repo WeJustJammin/wejammin --status in_progress --json databaseId --jq length 2>/dev/null)"; } > "$LOG" 2>&1
exec 7>/tmp/wejammin-quiet.lock; flock --wait 7200 7 || { echo "quiet lock timeout" >> "$LOG"; exit 3; }
exec 9>/tmp/wejammin-supabase-ci.lock; flock --wait 3600 9 || { echo "CI lock timeout" >> "$LOG"; exit 3; }
echo "[dbverify] locks $(date -u +%FT%TZ) load: $(cut -d' ' -f1-3 /proc/loadavg)" >> "$LOG"
S=$(date +%s); pnpm db:verify >> "$LOG" 2>&1; RC=$?
echo "[dbverify] exit=$RC elapsed=$(( $(date +%s)-S ))s end=$(date -u +%FT%TZ)" >> "$LOG"
pnpm db:reset > "${LOG%.log}-postreset.log" 2>&1; POST=$?
echo "[dbverify] postReset exit=$POST" >> "$LOG"
GATE=0
if [ "$RC" -ne 0 ]; then GATE="$RC"; elif [ "$POST" -ne 0 ]; then GATE="$POST"; fi
echo "[dbverify] gate RC=$GATE (dbverify=$RC postReset=$POST)" >> "$LOG"
if sha256sum "$LOG" > "${LOG%.log}.sha256"; then HASH=ok; else HASH=FAILED; fi
echo "LOG=$LOG RC=$GATE hash=$HASH"
if [ "$HASH" = "FAILED" ]; then exit 5; fi
exit "$GATE"
