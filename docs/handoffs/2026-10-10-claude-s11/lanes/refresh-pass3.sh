#!/usr/bin/env bash
# Third receipt pass (Slice 11 closure), after test files changed since pass 2 (flake fix in the CMS island test
# helpers, the Slice 09 pre-traceability receiving-row rule). The Slice 09 guard requires its own passing receipt
# and passes only when every Slice 09 receipt is fresh, so a changed Slice 09-cited file breaks the fixed point.
# Re-establish it without hand-typed rows: (1) run exactly the changed files, (2) drop the now-stale results of
# those files from the pass-2 report, (3) collect a bootstrap receipts file from that filtered report, the fresh
# run and the pass-1 database/browser outputs, then (4) run the full suite with coverage, in which the Slice 09
# guard can pass, and (5) collect Slice 09 and Slice 11 again from that full run. Quiet lock exclusive.
# Usage: refresh-pass3.sh <pass-1 dir> <pass-2 dir> <changed test file>...
set -uo pipefail
W=/home/rob/.codex/worktrees/phase2-slice11/WeJammin
P1=${1:?pass-1 directory}; P2=${2:?pass-2 directory}; shift 2
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
cd "$W" || exit 4
STAMP=$(date +%Y%m%d-%H%M%S); R=$W/.lane-logs/claude-receipts3-$STAMP; mkdir -p "$R"; S=$R/summary.txt
step() { local name=$1; shift; local t=$(date +%s); "$@" > "$R/$name.log" 2>&1; local rc=$?
  echo "$name exit=$rc $(( $(date +%s)-t ))s" >> "$S"; return 0; }
echo "HEAD $(git rev-parse HEAD) dirty=$(git status --porcelain | wc -l) files pass1=$P1 pass2=$P2 changed=$* start=$(date -u +%FT%TZ)" > "$S"
exec 7>/tmp/wejammin-quiet.lock; flock --wait 7200 7 || { echo "quiet lock timeout" >> "$S"; exit 3; }
echo "quiet lock $(date -u +%FT%TZ) load: $(cut -d' ' -f1-3 /proc/loadavg)" >> "$S"
DB="--pgtap $P1/db.tap --playwright $P1/pw-functional.json --playwright $P1/pw-real.json --races $P1/races.out"
step changed-run pnpm exec vitest run "$@" --reporter=default --reporter=json --outputFile.json="$R/changed.json"
step filter-pass2 node -e "
const fs=require('fs'),path=require('path');
const changed=new Set(process.argv.slice(1).map((f)=>path.resolve(f)));
const report=JSON.parse(fs.readFileSync('$P2/vitest.json','utf8'));
const before=report.testResults.length;
report.testResults=report.testResults.filter((r)=>!changed.has(path.resolve(r.name)));
fs.writeFileSync('$R/pass2-filtered.json',JSON.stringify(report));
console.log('dropped', before-report.testResults.length, 'stale file results of', changed.size, 'changed files');" "$@"
step bootstrap-s09 pnpm evidence:collect --vitest "$R/pass2-filtered.json" --vitest "$R/changed.json" \
  --vitest test-results/vitest-evidence-s09.json $DB
step bootstrap-guard pnpm exec vitest run tests/contracts/phase-02-slice-09-receipts-guard.test.ts
step vitest-coverage pnpm exec vitest run --coverage --reporter=default --reporter=json --outputFile.json="$R/vitest.json"
step collect-s09 pnpm evidence:collect --vitest "$R/vitest.json" --vitest test-results/vitest-evidence-s09.json $DB
E=test-results/evidence-s11
step collect-s11 node scripts/evidence/collect-receipts.mjs --slice 11 --vitest "$R/vitest.json" --vitest "$E/vitest-postgrest.json" \
  --playwright "$E/playwright-playwright.config.json" --playwright "$E/playwright-playwright.s09-real.config.json" \
  --pgtap "$E/pgtap.tap" --races "$E/races.out"
step guards pnpm exec vitest run tests/contracts/phase-02-slice-09-receipts-guard.test.ts \
  tests/contracts/phase-02-slice-10-evidence-guard.test.ts tests/contracts/phase-02-slice-11-evidence-guard.test.ts \
  tests/contracts/phase-02-slice-11-process-record.test.ts tests/contracts/phase-02-slice-11-closeout.test.ts
echo "end=$(date -u +%FT%TZ)" >> "$S"; echo "R=$R"
