#!/usr/bin/env bash
# Canonical `pnpm validate` for the Slice 11 closure: exclusive quiet lock, CI lock (the browser gates use
# the shared local stack), a fresh db:reset before the run, log + SHA-256 under .lane-logs/.
#
# Fail-closed contract:
#   * The prior proven canonical-validate record is read-only here. The run never rewrites it (no
#     pre-stamp); a fresh successful record is written by the owner only after this gate is green.
#   * A failed pre-reset stops before `pnpm validate` (a run over an unknown database state is not a
#     canonical run).
#   * A non-zero `pnpm validate` is propagated as the run's exit code, and a failed post-reset is
#     propagated when validate passed. The final `[validate] gate RC=` line names both apart.
#   * A failed evidence hash write fails the run (exit 5) even when validate and both resets pass.
#   * The log is complete before it is hashed, so the recorded SHA-256 covers the final log.
#
# Usage: gate-validate.sh [checkout]
#   checkout defaults to the canonical Slice 11 worktree; pass it only to point the runner at a
#   different checkout (for example a test fixture).
set -uo pipefail
W="${1:-/home/rob/.codex/worktrees/phase2-slice11/WeJammin}"
REC=.memory/pipeline/progress/verification/2026-10-12-slice-11-red-green-record.md
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
STAMP=$(date +%Y%m%d-%H%M%S); LOG=$W/.lane-logs/claude-validate-$STAMP.log; mkdir -p "$W/.lane-logs"
cd "$W" || exit 4
exec 7>/tmp/wejammin-quiet.lock; flock --wait 7200 7 || { echo "quiet lock timeout" > "$LOG"; exit 3; }
exec 9>/tmp/wejammin-supabase-ci.lock; flock --wait 3600 9 || { echo "CI lock timeout" > "$LOG"; exit 3; }
pnpm db:reset > "${LOG%.log}-prereset.log" 2>&1; PRE=$?
DAY=$(date -u +%F); HM=$(date -u +%H:%M)
{ echo "[validate] HEAD=$(git rev-parse HEAD) dirty: $(git status --porcelain | tr '\n' ' ')"
  echo "[validate] node=$(node --version) pnpm=$(pnpm --version) preReset=$PRE recorded=$DAY $HM load: $(cut -d' ' -f1-3 /proc/loadavg)"
  grep -m1 '^- canonical validate:' "$REC"; } > "$LOG" 2>&1
if [ "$PRE" -ne 0 ]; then
  echo "[validate] preReset failed (exit=$PRE); not running pnpm validate" >> "$LOG"
  echo "[validate] gate RC=$PRE (preReset=$PRE)" >> "$LOG"
  if sha256sum "$LOG" > "${LOG%.log}.sha256"; then HASH=ok; else HASH=FAILED; fi
  echo "LOG=$LOG RC=$PRE hash=$HASH"
  if [ "$HASH" = "FAILED" ]; then exit 5; fi
  exit "$PRE"
fi
S=$(date +%s); pnpm validate >> "$LOG" 2>&1; RC=$?
echo "[validate] exit=$RC elapsed=$(( $(date +%s)-S ))s end=$(date -u +%FT%TZ)" >> "$LOG"
pnpm db:reset > "${LOG%.log}-postreset.log" 2>&1; POST=$?
echo "[validate] postReset exit=$POST" >> "$LOG"
GATE=0
if [ "$RC" -ne 0 ]; then GATE="$RC"; elif [ "$POST" -ne 0 ]; then GATE="$POST"; fi
echo "[validate] gate RC=$GATE (validate=$RC postReset=$POST)" >> "$LOG"
if sha256sum "$LOG" > "${LOG%.log}.sha256"; then HASH=ok; else HASH=FAILED; fi
echo "LOG=$LOG RC=$GATE hash=$HASH"
if [ "$HASH" = "FAILED" ]; then exit 5; fi
exit "$GATE"
