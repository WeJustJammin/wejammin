#!/usr/bin/env bash
# Regenerate Slice 09 marker receipts and Slice 10 identity receipts from real runs on the integration checkout.
set -uo pipefail
LANE=/home/rob/.codex/worktrees/phase2-slice11/WeJammin
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
cd "$LANE" || exit 4
R=/home/rob/.codex/worktrees/phase2-slice10/orchestration/receipts-run; rm -rf $R; mkdir -p $R
LOG=/home/rob/.codex/worktrees/phase2-slice10/orchestration/logs/refresh-$(date +%H%M%S).log
exec > >(tee -a "$LOG") 2>&1
echo "[refresh] start $(date -u +%T)"
pnpm exec vitest run --reporter=json --outputFile=$R/vitest.json > $R/vitest.log 2>&1; echo "[refresh] vitest exit=$?"
pnpm test:evidence:s09 > $R/evidence-s09.log 2>&1; echo "[refresh] test:evidence:s09 exit=$?"
exec 9>/tmp/wejammin-supabase-ci.lock
flock --wait 3600 9 || { echo "[refresh] lock timeout"; exit 3; }
pnpm db:reset > $R/reset1.log 2>&1 && node infra/run-pgtap-verbose.mjs --out $R/db.tap > /dev/null 2>&1; echo "[refresh] pgtap exit=$?"
pnpm db:reset > $R/reset2.log 2>&1 && pnpm db:races > $R/races.out 2>&1; echo "[refresh] races exit=$?"
pnpm db:reset > $R/reset3.log 2>&1
PLAYWRIGHT_JSON_OUTPUT_NAME=$R/pw-functional.json PLAYWRIGHT_JSON_OUTPUT_FILE=$R/pw-functional.json pnpm exec playwright test --reporter=json --output=$R/pw-artifacts-functional > $R/pw-functional.log 2>&1; echo "[refresh] pw functional exit=$?"
pnpm db:reset > $R/reset4.log 2>&1
PLAYWRIGHT_JSON_OUTPUT_NAME=$R/pw-real.json PLAYWRIGHT_JSON_OUTPUT_FILE=$R/pw-real.json pnpm exec playwright test --config=playwright.s09-real.config.ts --reporter=json --output=$R/pw-artifacts-real > $R/pw-real.log 2>&1; echo "[refresh] pw real exit=$?"
flock -u 9
pnpm evidence:collect --vitest $R/vitest.json --vitest test-results/vitest-evidence-s09.json --pgtap $R/db.tap --playwright $R/pw-functional.json --playwright $R/pw-real.json --races $R/races.out > $R/collect-s09.log 2>&1; echo "[refresh] collect s09 exit=$?"; tail -3 $R/collect-s09.log
node scripts/evidence/run-slice-evidence.mjs --slice 10 > $R/run-s10.log 2>&1; echo "[refresh] run-slice-evidence s10 exit=$?"; tail -4 $R/run-s10.log
pnpm exec vitest run tests/contracts/phase-02-slice-09-receipts-guard.test.ts tests/contracts/phase-02-slice-10-evidence-guard.test.ts > $R/guards.log 2>&1; echo "[refresh] guards exit=$?"; grep -E '×|Test Files|Tests  ' $R/guards.log | head
echo "[refresh] done $(date -u +%T)"
