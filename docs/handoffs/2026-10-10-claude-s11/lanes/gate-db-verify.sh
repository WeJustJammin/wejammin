#!/usr/bin/env bash
# Canonical `pnpm db:verify` for the Slice 11 worktree: exclusive quiet lock (no lane runs beside it),
# shared CI lock, post-reset, log + SHA-256 under .lane-logs/. Usage: gate-db-verify.sh
set -uo pipefail
W=/home/rob/.codex/worktrees/phase2-slice11/WeJammin
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
pnpm db:reset > "${LOG%.log}-postreset.log" 2>&1; echo "[dbverify] postReset exit=$?" >> "$LOG"
sha256sum "$LOG" > "${LOG%.log}.sha256"; echo "LOG=$LOG RC=$RC"
