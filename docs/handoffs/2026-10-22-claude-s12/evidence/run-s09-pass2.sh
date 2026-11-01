#!/bin/bash
# Slice 09 receipts pass 2 (root, 2026-10-24), the Slice 11 closure precedent
# (docs/handoffs/2026-10-10-claude-s11/lanes/refresh-pass2.sh). The S09 receipts guard cites its own file (AC-1144), so
# pass 1 collected its "fresh passing receipt" test as failed (the receipts were stale while it ran). Bootstrap: for the
# guard's own failed rows only, take the committed passing row when the guard file's SHA-256 still equals that row's
# fileSha256; rerun the full Vitest suite; collect Slice 09 from this run plus pass 1's gate, pgTAP, Playwright and race
# outputs. The bootstrap row is never committed: the collect rewrites the receipts entirely from real runs.
# Usage: run-s09-pass2.sh <pass-1 dir>
set -u
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin
export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
P1=${1:?pass-1 directory}; R=$P1/pass2; mkdir -p $R
RECEIPTS=tests/contracts/phase-02-slice-09-receipts.generated.jsonl
GUARD=tests/contracts/phase-02-slice-09-receipts-guard.test.ts
echo "start $(date -u +%FT%TZ)" | tee -a $R/summary.txt
cp $RECEIPTS $R/s09-pass1.jsonl; git show HEAD:$RECEIPTS > $R/s09-committed.jsonl
node -e "
const fs=require('fs'),crypto=require('crypto');
const sha=crypto.createHash('sha256').update(fs.readFileSync('$GUARD')).digest('hex');
const parse=(f)=>fs.readFileSync(f,'utf8').split('\n').filter(Boolean).map((l)=>JSON.parse(l));
const pass1=parse('$R/s09-pass1.jsonl'), committed=parse('$R/s09-committed.jsonl');
let swapped=0;
const out=pass1.map((row)=>{
  if(row.file!=='$GUARD'||row.status==='passed') return row;
  const old=committed.find((c)=>c.file===row.file&&c.title===row.title&&c.criterion===row.criterion);
  if(!old||old.status!=='passed'||old.fileSha256!==sha) throw new Error('no current passing committed row for '+row.title);
  swapped++; return old;
});
fs.writeFileSync('$RECEIPTS', out.map((r)=>JSON.stringify(r)).join('\n')+'\n');
console.log('bootstrap rows swapped:', swapped);" 2>&1 | tee -a $R/summary.txt
pnpm exec vitest run --reporter=default --reporter=json --outputFile.json=$R/vitest-all.json > $R/vitest-all.log 2>&1
echo "VITEST_ALL $?" | tee -a $R/summary.txt
node scripts/evidence/collect-receipts.mjs --vitest $R/vitest-all.json --vitest $P1/vitest-evidence-s09.json --pgtap $P1/db-test.tap --playwright $P1/e2e-functional.json --playwright $P1/e2e-s09-real.json --races $P1/db-races.out > $R/collect-s09.log 2>&1
echo "COLLECT_S09 $?" | tee -a $R/summary.txt; tail -2 $R/collect-s09.log | tee -a $R/summary.txt
pnpm exec vitest run $GUARD tests/contracts/phase-02-slice-10-evidence-guard.test.ts tests/contracts/phase-02-slice-11-evidence-guard.test.ts tests/contracts/phase-02-slice-12-evidence-guard.test.ts tests/documentation-boundaries.test.ts > $R/guards.log 2>&1
echo "GUARDS $?" | tee -a $R/summary.txt; grep -E 'Test Files|Tests ' $R/guards.log | tee -a $R/summary.txt
echo "end $(date -u +%FT%TZ)" | tee -a $R/summary.txt
