#!/bin/bash
# Final evidence regeneration for Phase 2 Slices 09-12 (root, 2026-10-23). Receipts pin file SHA-256, so run this
# only after every code change is final. Takes the shared CI lock for each database step.
set -u
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin
export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
L=.lane-logs/canonical/final-evidence-$STAMP; mkdir -p $L
E=test-results/s09-evidence; mkdir -p $E
LOCK=/tmp/wejammin-supabase-ci.lock
locked() { ( flock --wait 3600 9 && "$@" ) 9>$LOCK; }
echo "node $(node --version) stamp $STAMP" | tee $L/summary.txt
locked pnpm db:start > $L/db-start.log 2>&1; echo "DBSTART $?" | tee -a $L/summary.txt
for s in 12 11 10; do
  node scripts/evidence/run-slice-evidence.mjs --slice $s > $L/slice-$s.log 2>&1
  echo "SLICE$s $?" | tee -a $L/summary.txt
  grep -E '^(PASSED|FAILED|ABORTED)|wrote [0-9]+ receipts' $L/slice-$s.log | cut -c1-160 | tee -a $L/summary.txt
done
# Slice 09 marker receipts (inputs from real runs)
pnpm exec vitest run --reporter=json --outputFile=$E/vitest-all.json > $L/vitest-all.log 2>&1; echo "VITEST_ALL $?" | tee -a $L/summary.txt
pnpm test:evidence:s09 > $L/test-evidence-s09.log 2>&1; echo "TEST_EVIDENCE_S09 $?" | tee -a $L/summary.txt
locked bash -c "pnpm db:reset && pnpm db:test:tap" > $E/db-test.tap 2> $L/db-test-tap.err; echo "DB_TEST_TAP $?" | tee -a $L/summary.txt
locked bash -c "pnpm db:reset && pnpm db:races" > $E/db-races.out 2>&1; echo "DB_RACES $?" | tee -a $L/summary.txt
PLAYWRIGHT_JSON_OUTPUT_NAME=$E/e2e-functional.json pnpm exec playwright test --reporter=json > $L/e2e-functional.log 2>&1; echo "E2E_FUNCTIONAL $?" | tee -a $L/summary.txt
locked bash -c "node infra/reset-local-database.mjs && PLAYWRIGHT_JSON_OUTPUT_NAME=$E/e2e-s09-real.json pnpm exec playwright test --config=playwright.s09-real.config.ts --reporter=json" > $L/e2e-s09-real.log 2>&1; echo "E2E_S09_REAL $?" | tee -a $L/summary.txt
node scripts/evidence/collect-receipts.mjs --vitest $E/vitest-all.json --vitest test-results/vitest-evidence-s09.json --pgtap $E/db-test.tap --playwright $E/e2e-functional.json --playwright $E/e2e-s09-real.json --races $E/db-races.out > $L/collect-s09.log 2>&1; echo "COLLECT_S09 $?" | tee -a $L/summary.txt
tail -3 $L/collect-s09.log | tee -a $L/summary.txt
echo "logs: $L" | tee -a $L/summary.txt
