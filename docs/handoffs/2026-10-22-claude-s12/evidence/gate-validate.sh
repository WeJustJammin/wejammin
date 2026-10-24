#!/usr/bin/env bash
# Canonical `pnpm validate` for the Slice 12 checkpoint commit (root, 2026-10-24), after the Slice 09-12 receipts passes:
# exclusive quiet lock, CI lock (the browser gates use the shared local stack), a fresh db:reset before and after, log +
# SHA-256 under .lane-logs/canonical/. Modelled on docs/handoffs/2026-10-10-claude-s11/lanes/gate-validate.sh without its
# Slice 11 attestation stamp (that line records the Slice 11 closure run and stays as it is).
set -uo pipefail
W=/home/rob/.codex/worktrees/phase2-slice12/WeJammin
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
STAMP=$(date -u +%Y%m%dT%H%M%SZ); LOG=$W/.lane-logs/canonical/validate-$STAMP.log; mkdir -p "$W/.lane-logs/canonical"
cd "$W" || exit 4
exec 7>/tmp/wejammin-quiet.lock; flock --wait 7200 7 || { echo "quiet lock timeout" > "$LOG"; exit 3; }
exec 9>/tmp/wejammin-supabase-ci.lock; flock --wait 3600 9 || { echo "CI lock timeout" > "$LOG"; exit 3; }
pnpm db:reset > "${LOG%.log}-prereset.log" 2>&1; PRE=$?
{ echo "[validate] HEAD=$(git rev-parse HEAD) dirty-count: $(git status --porcelain | wc -l)"
  echo "[validate] node=$(node --version) pnpm=$(pnpm --version) preReset=$PRE start=$(date -u +%FT%TZ) load: $(cut -d' ' -f1-3 /proc/loadavg)"; } > "$LOG" 2>&1
S=$(date +%s); pnpm validate >> "$LOG" 2>&1; RC=$?
echo "[validate] exit=$RC elapsed=$(( $(date +%s)-S ))s end=$(date -u +%FT%TZ)" >> "$LOG"
pnpm db:reset > "${LOG%.log}-postreset.log" 2>&1; echo "[validate] postReset exit=$?" >> "$LOG"
sha256sum "$LOG" > "${LOG%.log}.sha256"; echo "LOG=$LOG RC=$RC"
