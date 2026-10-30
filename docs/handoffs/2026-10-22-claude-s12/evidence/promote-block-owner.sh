#!/bin/bash
# Promote the reviewed block-owner WIP migration (root, 2026-10-29; DEC-243; review V18 conditions met). Manifest (name, SHA-256)
# → move into supabase/migrations/ → remove the WIP dir → under the CI lock: db:reset, types check, and a canonical pgTAP run
# of the wave-4/5 test files (the registry suite needs this migration). README section is a separate root edit.
set -euo pipefail
cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin
export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
WIP=supabase/migrations-wip/block-owner
MANIFEST=docs/handoffs/2026-10-22-claude-s12/evidence/promotion-manifest-block-owner.json
LOG=.lane-logs/canonical/promote-block-owner-$(date -u +%Y%m%dT%H%M%SZ).log
node -e "
const fs=require('fs'),c=require('crypto');
const files=fs.readdirSync('$WIP').filter(x=>x.endsWith('.sql')).sort();
const last=fs.readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort().pop();
for (const f of files) { if (fs.existsSync('supabase/migrations/'+f)) { console.error('EXISTS',f); process.exit(2); } if (f<=last) { console.error('NOT AFTER',last); process.exit(2); } }
const out=files.map(f=>({file:f,from:'block-owner',sha256:c.createHash('sha256').update(fs.readFileSync('$WIP/'+f)).digest('hex')}));
fs.writeFileSync('$MANIFEST', JSON.stringify({promotedAt:new Date().toISOString(),after:last,review:'V18 PROMOTE-WITH-CONDITIONS (review-v18-report.md); conditions met by root: AC-159 text, four ledger re-points, RED test 25 title',promoted:out},null,1)+'\n');
console.log('manifest',out.length,'after',last);"
for f in $WIP/*.sql; do mv "$f" supabase/migrations/; done
rm -f $WIP/README.md; rmdir $WIP
TESTS=$(/bin/ls supabase/tests/phase_02_slice_12_block_owner_red.sql supabase/tests/phase_02_slice_12_gaps_db1_template.sql supabase/tests/phase_02_slice_12_gaps_db1_template_context.sql supabase/tests/phase_02_slice_12_template_context.sql supabase/tests/phase_02_slice_12_fix_template_reads_rpc_context.sql supabase/tests/phase_02_slice_09_p240_reads_detail.sql | tr '\n' ' ')
( flock --wait 3600 9 && pnpm db:reset && node infra/sync-database-types.mjs --check && pnpm exec supabase test db --local $TESTS ) 9>/tmp/wejammin-supabase-ci.lock > $LOG 2>&1 && RC=0 || RC=$?
echo "RC=$RC LOG=$LOG"; grep -E "^Files=|Result:|not ok" $LOG | head -10
