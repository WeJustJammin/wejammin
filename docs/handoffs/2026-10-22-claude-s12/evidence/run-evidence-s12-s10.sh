#!/bin/bash
# Slices 12 and 10 again after the 2026-10-29 title re-points (root): run-slice-evidence for each, then every guard. Derived from run-evidence-all.sh;
# run-slice-evidence.mjs (canonical race mode for the Slice 12 race citations), each followed at once by its guard
# (PAT-035), then Slice 09 pass 1 (fresh inputs outside test-results/, PAT-034) and pass 2 (the AC-1144 self-receipt
# bootstrap), then every guard and the reconciliation, inventory and documentation tests together.
# Usage: run-evidence-all.sh <log-dir>
set -u
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin
export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
export WEJAMMIN_CANONICAL_RACE=1
L=$1; mkdir -p $L
EV=docs/handoffs/2026-10-22-claude-s12/evidence
echo "node $(node --version) HEAD $(git rev-parse --short HEAD) start $(date -u +%FT%TZ)" | tee -a $L/summary.txt
( flock --wait 3600 9 && pnpm db:start ) 9>/tmp/wejammin-supabase-ci.lock > $L/db-start.log 2>&1; echo "DBSTART $?" | tee -a $L/summary.txt
for s in 12 10; do
  node scripts/evidence/run-slice-evidence.mjs --slice $s > $L/slice-$s.log 2>&1
  echo "SLICE$s $? $(date -u +%T)" | tee -a $L/summary.txt
  grep -E '^(PASSED|FAILED|ABORTED)|wrote [0-9]+ receipts' $L/slice-$s.log | grep -vE '^PASSED' | cut -c1-200 | tee -a $L/summary.txt
  grep -cE '^PASSED' $L/slice-$s.log | sed 's/^/passed steps /' | tee -a $L/summary.txt
  pnpm exec vitest run tests/contracts/phase-02-slice-$s-evidence-guard.test.ts > $L/guard-$s.log 2>&1
  echo "GUARD$s $?" | tee -a $L/summary.txt
  grep -E 'evidence problem|Tests ' $L/guard-$s.log | cut -c1-200 | tee -a $L/summary.txt
done
pnpm exec vitest run tests/contracts/phase-02-slice-09-receipts-guard.test.ts tests/contracts/phase-02-slice-10-evidence-guard.test.ts tests/contracts/phase-02-slice-11-evidence-guard.test.ts tests/contracts/phase-02-slice-12-evidence-guard.test.ts tests/documentation-boundaries.test.ts tests/contracts/phase-02-slice-12-unit-citation-reconciliation.test.ts tests/contracts/phase-02-slice-12-ledger-inventory.test.ts > $L/guards-all.log 2>&1
echo "GUARDS_ALL $?" | tee -a $L/summary.txt; grep -E 'Test Files|Tests |evidence problem|stale or missing' $L/guards-all.log | cut -c1-200 | tee -a $L/summary.txt
echo "end $(date -u +%FT%TZ)" | tee -a $L/summary.txt
