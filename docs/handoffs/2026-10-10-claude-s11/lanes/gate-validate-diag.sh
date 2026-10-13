#!/usr/bin/env bash
# Diagnostic `pnpm validate`: every step, continuing past failures, exclusive quiet lock. Usage: gate-validate-diag.sh
W=/home/rob/.codex/worktrees/phase2-slice11/WeJammin
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
D=$W/.lane-logs/claude-validate-diag-$(date +%Y%m%d-%H%M%S); mkdir -p "$D"; cd "$W" || exit 4
exec 7>/tmp/wejammin-quiet.lock; flock --wait 7200 7 || { echo "quiet timeout"; exit 3; }
echo "HEAD $(git rev-parse HEAD) dirty=$(git status --porcelain | wc -l) load=$(cut -d' ' -f1-3 /proc/loadavg) start=$(date -u +%T)" > "$D/summary.txt"
for s in contracts:check db:types:check progress:check format:check lint type-check test:coverage test:evidence:s09 test:e2e build bundle:check performance:smoke; do
  t=$(date +%s); pnpm "$s" > "$D/${s//:/-}.log" 2>&1; echo "$s exit=$? $(( $(date +%s)-t ))s" >> "$D/summary.txt"; done
echo "end=$(date -u +%T)" >> "$D/summary.txt"; cat "$D/summary.txt"; echo "DIR=$D"
