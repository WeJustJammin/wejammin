#!/bin/bash
# Promote the reviewed Slice 12 gap-wave WIP directories (root). Run ONLY after reviews V12 (verified PROMOTE), V13 and V14
# (verified) and V15 (bundle web) clear. Order is the migration timestamp order:
#   taxonomy-integrity 20261024100000-100800 → gaps-db2 20261024130000-130400 → node-pointers 20261024140000-140100
#   → placement-perf 20261024150000-150400 → nestable-read 20261027100000-100020
# Steps: manifest (name, WIP dir, SHA-256) → move into supabase/migrations/ → apply the taxonomy-integrity test-correction
# diff and delete its verified copies → regenerate database.types.ts under the CI lock. The README section and the canonical
# gates are separate root steps. Usage: promote-wave3.sh [--dry]
set -euo pipefail
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin
export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
DRY=${1:-}
DIRS="taxonomy-integrity gaps-db2 node-pointers placement-perf nestable-read"
MANIFEST=docs/handoffs/2026-10-22-claude-s12/evidence/promotion-manifest-wave3.json
DIFF=docs/handoffs/2026-10-22-claude-s12/lane-taxonomy-integrity-test-corrections.diff
COPIES=supabase/tests/phase_02_slice_12_taxonomy_integrity_corrected_oracles
node -e "
const fs=require('fs'),c=require('crypto');const out=[];
for (const d of '$DIRS'.split(' ')) for (const f of fs.readdirSync('supabase/migrations-wip/'+d).filter(x=>x.endsWith('.sql')).sort())
  out.push({file:f,from:d,sha256:c.createHash('sha256').update(fs.readFileSync('supabase/migrations-wip/'+d+'/'+f)).digest('hex')});
const names=out.map(x=>x.file).sort(); const dup=names.filter((x,i)=>names.indexOf(x)!==i);
if (dup.length) { console.error('DUPLICATE', dup); process.exit(2); }
for (const x of out) if (fs.existsSync('supabase/migrations/'+x.file)) { console.error('EXISTS', x.file); process.exit(2); }
const last=fs.readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort().pop();
if (out.some(x=>x.file<=last)) { console.error('NOT AFTER', last); process.exit(2); }
fs.writeFileSync('$MANIFEST', JSON.stringify({promotedAt:new Date().toISOString(),after:last,promoted:out},null,1)+'\n');
console.log('manifest', out.length, 'files after', last);
"
git apply --check "$DIFF" && echo "diff applies cleanly"
[ "$DRY" = "--dry" ] && { echo "dry run: nothing moved"; exit 0; }
for d in $DIRS; do
  for f in supabase/migrations-wip/$d/*.sql; do mv "$f" supabase/migrations/; done
  rm -f supabase/migrations-wip/$d/README.md; rmdir supabase/migrations-wip/$d
done
git apply "$DIFF"
rm -rf "$COPIES"
( flock --wait 3600 9 && pnpm db:reset && node infra/sync-database-types.mjs ) 9>/tmp/wejammin-supabase-ci.lock
node infra/sync-database-types.mjs --check && echo "types in sync"
/bin/ls supabase/migrations-wip/
