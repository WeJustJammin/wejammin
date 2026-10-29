#!/bin/bash
# Promote the reviewed gaps-db5 WIP migration (root, 2026-10-29; DEC-240; review V16 conditions met). Manifest (name, SHA-256)
# → move into supabase/migrations/ → remove the WIP dir → under the CI lock: db:reset, types check, and a canonical pgTAP run
# of the wave-4/5 test files (the registry suite needs this migration). README section is a separate root edit.
set -euo pipefail
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin
export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
WIP=supabase/migrations-wip/gaps-db5
MANIFEST=docs/handoffs/2026-10-22-claude-s12/evidence/promotion-manifest-db5.json
LOG=.lane-logs/canonical/promote-db5-$(date -u +%Y%m%dT%H%M%SZ).log
node -e "
const fs=require('fs'),c=require('crypto');
const files=fs.readdirSync('$WIP').filter(x=>x.endsWith('.sql')).sort();
const last=fs.readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort().pop();
for (const f of files) { if (fs.existsSync('supabase/migrations/'+f)) { console.error('EXISTS',f); process.exit(2); } if (f<=last) { console.error('NOT AFTER',last); process.exit(2); } }
const out=files.map(f=>({file:f,from:'gaps-db5',sha256:c.createHash('sha256').update(fs.readFileSync('$WIP/'+f)).digest('hex')}));
fs.writeFileSync('$MANIFEST', JSON.stringify({promotedAt:new Date().toISOString(),after:last,review:'V16 verification round conditions met (review-v16-report.md V16-15; lane-gaps-db5-report.md fix round 2)',promoted:out},null,1)+'\n');
console.log('manifest',out.length,'after',last);"
for f in $WIP/*.sql; do mv "$f" supabase/migrations/; done
rm -f $WIP/README.md; rmdir $WIP
TESTS=$(/bin/ls supabase/tests/phase_02_slice_12_gaps_db5_*.sql supabase/tests/phase_02_slice_10_ev_ea_lineage.sql supabase/tests/phase_02_slice_12_taxonomy_integrity.sql supabase/tests/phase_02_slice_12_gaps_db4_registry.sql | tr '\n' ' ')
( flock --wait 3600 9 && pnpm db:reset && node infra/sync-database-types.mjs --check && pnpm exec supabase test db --local $TESTS ) 9>/tmp/wejammin-supabase-ci.lock > $LOG 2>&1 && RC=0 || RC=$?
echo "RC=$RC LOG=$LOG"; grep -E "^Files=|Result:|not ok" $LOG | head -10
