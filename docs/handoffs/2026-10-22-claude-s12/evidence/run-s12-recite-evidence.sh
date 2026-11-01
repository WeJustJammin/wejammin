#!/bin/bash
# Slice 12 ledger evidence after the 2026-10-24 refuted re-citation (root): race citations need canonical race mode
# (WEJAMMIN_CANONICAL_RACE=1, infra/database-races/canonical-mode.mjs); then all four slice guards and the
# documentation and reconciliation tests. Usage: run-s12-recite-evidence.sh <log-dir>
set -u
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin
export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
export WEJAMMIN_CANONICAL_RACE=1
L=$1; mkdir -p $L
echo "node $(node --version) start $(date -u +%FT%TZ)" | tee -a $L/summary.txt
( flock --wait 3600 9 && pnpm db:start ) 9>/tmp/wejammin-supabase-ci.lock > $L/db-start.log 2>&1; echo "DBSTART $?" | tee -a $L/summary.txt
node scripts/evidence/run-slice-evidence.mjs --slice 12 > $L/slice-12.log 2>&1
echo "SLICE12 $? $(date -u +%T)" | tee -a $L/summary.txt
grep -E '^(PASSED|FAILED|ABORTED)|wrote [0-9]+ receipts' $L/slice-12.log | cut -c1-200 | tee -a $L/summary.txt
pnpm exec vitest run tests/contracts/phase-02-slice-09-receipts-guard.test.ts tests/contracts/phase-02-slice-10-evidence-guard.test.ts tests/contracts/phase-02-slice-11-evidence-guard.test.ts tests/contracts/phase-02-slice-12-evidence-guard.test.ts tests/documentation-boundaries.test.ts tests/contracts/phase-02-slice-12-unit-citation-reconciliation.test.ts tests/contracts/phase-02-slice-12-ledger-inventory.test.ts > $L/guards.log 2>&1
echo "GUARDS $?" | tee -a $L/summary.txt; grep -E 'Test Files|Tests |evidence problem|stale or missing' $L/guards.log | cut -c1-200 | tee -a $L/summary.txt
echo "end $(date -u +%FT%TZ)" | tee -a $L/summary.txt
