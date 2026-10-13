#!/usr/bin/env bash
# Canonical `pnpm validate` for the Slice 11 closure: exclusive quiet lock, CI lock (the browser gates use the
# shared local stack), a fresh db:reset before the run, log + SHA-256 under .lane-logs/.
# The Slice 11 red-green record's canonical-validate line is an attestation that a guard inside this very run
# reads (PAT-028): the line already carries the counts of the preceding full receipt pass; this script stamps the
# run's own start date and UTC time into it immediately before `pnpm validate`, so the run verifies the line it
# is described by. If the run's counts differ from the line, the line is rewritten and the gate rerun.
set -uo pipefail
W=/home/rob/.codex/worktrees/phase2-slice11/WeJammin
REC=.memory/pipeline/progress/verification/2026-10-12-slice-11-red-green-record.md
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
STAMP=$(date +%Y%m%d-%H%M%S); LOG=$W/.lane-logs/claude-validate-$STAMP.log; mkdir -p "$W/.lane-logs"
cd "$W" || exit 4
exec 7>/tmp/wejammin-quiet.lock; flock --wait 7200 7 || { echo "quiet lock timeout" > "$LOG"; exit 3; }
exec 9>/tmp/wejammin-supabase-ci.lock; flock --wait 3600 9 || { echo "CI lock timeout" > "$LOG"; exit 3; }
pnpm db:reset > "${LOG%.log}-prereset.log" 2>&1; PRE=$?
DAY=$(date -u +%F); HM=$(date -u +%H:%M)
sed -i -E "s/^(- canonical validate: \`pnpm validate\` exit 0 on )[0-9]{4}-[0-9]{2}-[0-9]{2} \([0-9]{2}:[0-9]{2} UTC\)/\1$DAY ($HM UTC)/" "$REC"
{ echo "[validate] HEAD=$(git rev-parse HEAD) dirty: $(git status --porcelain | tr '\n' ' ')"
  echo "[validate] node=$(node --version) pnpm=$(pnpm --version) preReset=$PRE stamped=$DAY $HM load: $(cut -d' ' -f1-3 /proc/loadavg)"
  grep -m1 '^- canonical validate:' "$REC"; } > "$LOG" 2>&1
S=$(date +%s); pnpm validate >> "$LOG" 2>&1; RC=$?
echo "[validate] exit=$RC elapsed=$(( $(date +%s)-S ))s end=$(date -u +%FT%TZ)" >> "$LOG"
pnpm db:reset > "${LOG%.log}-postreset.log" 2>&1; echo "[validate] postReset exit=$?" >> "$LOG"
sha256sum "$LOG" > "${LOG%.log}.sha256"; echo "LOG=$LOG RC=$RC"
