#!/usr/bin/env bash
# Slice 11 closure: one quiet-host pass that is both the full-suite diagnostic and the receipt refresh.
# Runs the whole vitest suite with coverage (JSON + default reporters), the Slice 09 evidence gate, verbose
# pgTAP, the race runners and both Playwright configs, regenerates the Slice 09 marker receipts from those
# runs, regenerates the Slice 10 and Slice 11 identity receipts with run-slice-evidence (separate output
# directories), then runs the three guards. Every step continues past a failure; summary.txt has exit codes.
# Holds /tmp/wejammin-quiet.lock EXCLUSIVE for the whole run (no lane beside it, PAT-026) and the shared CI
# lock only around database steps (released before run-slice-evidence, which takes it itself).
# Usage: refresh-receipts.sh [--skip-full]   (--skip-full: only the S10/S11 runners and the guards)
set -uo pipefail
W=/home/rob/.codex/worktrees/phase2-slice11/WeJammin
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
cd "$W" || exit 4
STAMP=$(date +%Y%m%d-%H%M%S); R=$W/.lane-logs/claude-receipts-$STAMP; mkdir -p "$R"; S=$R/summary.txt
step() { local name=$1; shift; local t=$(date +%s); "$@" > "$R/$name.log" 2>&1; local rc=$?
  echo "$name exit=$rc $(( $(date +%s)-t ))s" >> "$S"; return 0; }
echo "HEAD $(git rev-parse HEAD) dirty=$(git status --porcelain | tr '\n' ' ') start=$(date -u +%FT%TZ)" > "$S"
exec 7>/tmp/wejammin-quiet.lock; flock --wait 7200 7 || { echo "quiet lock timeout" >> "$S"; exit 3; }
echo "quiet lock $(date -u +%FT%TZ) load: $(cut -d' ' -f1-3 /proc/loadavg)" >> "$S"
if [ "${1:-}" != "--skip-full" ]; then
  step vitest-coverage pnpm exec vitest run --coverage --reporter=default --reporter=json --outputFile.json="$R/vitest.json"
  step evidence-s09 pnpm test:evidence:s09
  exec 9>/tmp/wejammin-supabase-ci.lock; flock --wait 3600 9 || { echo "CI lock timeout" >> "$S"; exit 3; }
  echo "ci lock $(date -u +%FT%TZ)" >> "$S"
  step reset1 pnpm db:reset; step pgtap node infra/run-pgtap-verbose.mjs --out "$R/db.tap"
  step reset2 pnpm db:reset; step races sh -c "pnpm db:races > '$R/races.out' 2>&1"
  step reset3 pnpm db:reset
  step pw-functional env PLAYWRIGHT_JSON_OUTPUT_NAME="$R/pw-functional.json" PLAYWRIGHT_JSON_OUTPUT_FILE="$R/pw-functional.json" \
    pnpm exec playwright test --reporter=json --output="$R/pw-artifacts-functional"
  step reset4 pnpm db:reset
  step pw-real env PLAYWRIGHT_JSON_OUTPUT_NAME="$R/pw-real.json" PLAYWRIGHT_JSON_OUTPUT_FILE="$R/pw-real.json" \
    pnpm exec playwright test --config=playwright.s09-real.config.ts --reporter=json --output="$R/pw-artifacts-real"
  step reset5 pnpm db:reset
  flock -u 9; exec 9>&-
  step collect-s09 pnpm evidence:collect --vitest "$R/vitest.json" --vitest test-results/vitest-evidence-s09.json \
    --pgtap "$R/db.tap" --playwright "$R/pw-functional.json" --playwright "$R/pw-real.json" --races "$R/races.out"
fi
step run-s10 node scripts/evidence/run-slice-evidence.mjs --slice 10 --out-dir test-results/evidence-s10
step run-s11 node scripts/evidence/run-slice-evidence.mjs --slice 11 --out-dir test-results/evidence-s11
step guards pnpm exec vitest run tests/contracts/phase-02-slice-09-receipts-guard.test.ts \
  tests/contracts/phase-02-slice-10-evidence-guard.test.ts tests/contracts/phase-02-slice-11-evidence-guard.test.ts
echo "end=$(date -u +%FT%TZ)" >> "$S"; echo "R=$R"
