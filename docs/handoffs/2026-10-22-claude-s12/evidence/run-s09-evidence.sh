#!/bin/bash
# Slice 09 marker receipts from real runs (root, 2026-10-23). Every input is written OUTSIDE test-results/: each
# Playwright run empties test-results/ when it starts, which deleted the first attempt's Vitest, pgTAP and race inputs
# (run-final-evidence.sh, logs final-evidence-20261023T224619Z). The AC-269 gate report keeps its file NAME
# vitest-evidence-s09.json, which the receipt merge recognises (receipts-lib.mjs SKIP_REPLACEMENTS).
# Usage: run-s09-evidence.sh <out-dir> [existing vitest-all.json]
set -u
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin
export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
S=$1; mkdir -p $S
LOCK=/tmp/wejammin-supabase-ci.lock
locked() { ( flock --wait 3600 9 && "$@" ) 9>$LOCK; }
echo "node $(node --version) start $(date -u +%FT%TZ)" | tee -a $S/summary.txt
if [ -n "${2:-}" ]; then
  [ "$2" = "$S/vitest-all.json" ] || cp "$2" $S/vitest-all.json
  echo "VITEST_ALL reused $2" | tee -a $S/summary.txt
else
  pnpm exec vitest run --reporter=default --reporter=json --outputFile.json=$S/vitest-all.json > $S/vitest-all.log 2>&1
  echo "VITEST_ALL $?" | tee -a $S/summary.txt
fi
pnpm test:evidence:s09 > $S/test-evidence-s09.log 2>&1; echo "TEST_EVIDENCE_S09 $?" | tee -a $S/summary.txt
cp test-results/vitest-evidence-s09.json $S/vitest-evidence-s09.json; echo "COPY_GATE $?" | tee -a $S/summary.txt
locked bash -c "pnpm db:reset && pnpm db:test:tap" > $S/db-test.tap 2> $S/db-test-tap.err; echo "DB_TEST_TAP $?" | tee -a $S/summary.txt
locked bash -c "pnpm db:reset && pnpm db:races" > $S/db-races.out 2>&1; echo "DB_RACES $?" | tee -a $S/summary.txt
PLAYWRIGHT_JSON_OUTPUT_NAME=$S/e2e-functional.json pnpm exec playwright test --reporter=json > $S/e2e-functional.log 2>&1; echo "E2E_FUNCTIONAL $?" | tee -a $S/summary.txt
locked bash -c "node infra/reset-local-database.mjs && PLAYWRIGHT_JSON_OUTPUT_NAME=$S/e2e-s09-real.json pnpm exec playwright test --config=playwright.s09-real.config.ts --reporter=json" > $S/e2e-s09-real.log 2>&1; echo "E2E_S09_REAL $?" | tee -a $S/summary.txt
/bin/ls -la $S | tee -a $S/summary.txt
node scripts/evidence/collect-receipts.mjs --vitest $S/vitest-all.json --vitest $S/vitest-evidence-s09.json --pgtap $S/db-test.tap --playwright $S/e2e-functional.json --playwright $S/e2e-s09-real.json --races $S/db-races.out > $S/collect-s09.log 2>&1; echo "COLLECT_S09 $?" | tee -a $S/summary.txt
tail -3 $S/collect-s09.log | tee -a $S/summary.txt
echo "end $(date -u +%FT%TZ)" | tee -a $S/summary.txt
