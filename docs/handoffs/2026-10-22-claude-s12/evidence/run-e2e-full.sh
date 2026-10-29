#!/bin/bash
# Full browser gate (root): pnpm build, then under the CI lock a db reset, `pnpm test:e2e` (default config + the real-route
# s09-real suite), and a closing reset. Logs under .lane-logs/canonical/e2e-<stamp>/. Usage: run-e2e-full.sh
set -u
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin
export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
O=.lane-logs/canonical/e2e-$(date -u +%Y%m%dT%H%M%SZ); mkdir -p $O
pnpm build > $O/build.log 2>&1; echo "BUILD $?" | tee $O/summary.txt
( flock --wait 3600 9 && node infra/reset-local-database.mjs > $O/reset.log 2>&1 && pnpm test:e2e > $O/e2e.log 2>&1; echo "E2E $?" | tee -a $O/summary.txt; node infra/reset-local-database.mjs > $O/reset-after.log 2>&1 ) 9>/tmp/wejammin-supabase-ci.lock
grep -E "^\s+[0-9]+ (passed|failed|flaky|skipped)" $O/e2e.log | tee -a $O/summary.txt
echo "dir $O" | tee -a $O/summary.txt
