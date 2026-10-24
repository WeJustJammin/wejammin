#!/bin/bash
# Slice 12 then Slice 11 ledger evidence reruns after the 2026-10-24 re-citations, each followed at once by its ledger
# guard (PAT-035: a PASS runner is not a green guard). Usage: run-s12-s11-evidence.sh <log-dir>
set -u
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin
export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
L=$1; mkdir -p $L
echo "node $(node --version) start $(date -u +%FT%TZ)" | tee -a $L/summary.txt
( flock --wait 3600 9 && pnpm db:start ) 9>/tmp/wejammin-supabase-ci.lock > $L/db-start.log 2>&1; echo "DBSTART $?" | tee -a $L/summary.txt
for s in 12 11; do
  node scripts/evidence/run-slice-evidence.mjs --slice $s > $L/slice-$s.log 2>&1
  echo "SLICE$s $? $(date -u +%T)" | tee -a $L/summary.txt
  grep -E '^(PASSED|FAILED|ABORTED)|wrote [0-9]+ receipts' $L/slice-$s.log | grep -vE '^PASSED' | cut -c1-200 | tee -a $L/summary.txt
  grep -cE '^PASSED' $L/slice-$s.log | sed 's/^/passed steps /' | tee -a $L/summary.txt
  pnpm exec vitest run tests/contracts/phase-02-slice-$s-evidence-guard.test.ts > $L/guard-$s.log 2>&1
  echo "GUARD$s $?" | tee -a $L/summary.txt
  grep -E 'evidence problem|Tests ' $L/guard-$s.log | cut -c1-200 | tee -a $L/summary.txt
done
echo "end $(date -u +%FT%TZ)" | tee -a $L/summary.txt
