#!/usr/bin/env node
// DEC-235 (root, owner may override; AC300 precedent): BE00 binds an idempotency key to (actor_id, operation, key_hash),
// so a different actor is a distinct binding; the same actor reusing the key under a changed server-resolved acting
// party, body, path or version is 409. Amends AC-056 in the phase-2 tracker, the Slice 12 progress tracker and the
// ledger (criterion text, clause 9, limitation). BE03c line 150 was edited by hand with its changelog row.
// Run AFTER recite2/apply2.mjs.
//   node --experimental-strip-types docs/handoffs/2026-10-22-claude-s12/recite2/dec235-ac056.mjs [--dry]

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = '/home/rob/.codex/worktrees/phase2-slice12/WeJammin';
const DRY = process.argv.includes('--dry');
const CRITERION = 'P2-S12-AC-056';
const OLD = 'answers a changed actor, body, path or version under the same key with 409.';
const NEW = 'answers a changed acting party, body, path or version under the same key with 409.';
const OLD_CLAUSE = 'answers a changed actor';
const NEW_CLAUSE = 'answers a changed acting party';
const REASON =
  'missing test: pgTAP replaying a stored CMS-03C-04 key by the same actor under a different server-resolved acting party and expecting 409 IDEMPOTENCY_MISMATCH with nothing written (the shared cms_reserve hashes the acting party; template_authority.sql "CMS same key cannot replay across server-resolved acting parties" is the CMS-03C-01 case, an adjacent route). A different actor is a distinct binding, not a 409 (DEC-235, BE00).';
const TRACKERS = ['.memory/wiki/specs/phases/phase-2.md', '.memory/pipeline/progress/slices/phase-02-slice-12.md'];
const FRAGMENT = 'tests/contracts/phase-02-slice-12-evidence-ledger-001-071.ts';
const EXPORT = 'S12_EVIDENCE_LEDGER_001_071';

const problems = [];
const mod = await import(resolve(ROOT, FRAGMENT));
const entries = structuredClone(mod[EXPORT]);
const entry = entries.find((e) => e.criterion === CRITERION);
if (entry.text.split(OLD).length !== 2) problems.push('criterion text: old phrase not found once');
entry.text = entry.text.replace(OLD, NEW);
const clause = entry.clauses.find((c) => c.text === OLD_CLAUSE);
if (!clause) problems.push('clause "answers a changed actor" not found');
else if (clause.citations.length > 0) problems.push('clause unexpectedly cited');
else clause.text = NEW_CLAUSE;
const seg = /"answers a changed actor": [\s\S]*?(?="[^"]+": |$)/u;
if (!seg.test(entry.limitation)) problems.push('limitation: changed-actor segment not found');
entry.limitation = entry.limitation.replace(seg, `"${NEW_CLAUSE}": ${REASON} `).trim();
console.log(JSON.stringify({ problems, status: entry.status, limitation: entry.limitation }, null, 1));
if (DRY || problems.length > 0) process.exit(problems.length > 0 ? 1 : 0);

const file = resolve(ROOT, FRAGMENT);
const old = readFileSync(file, 'utf8');
writeFileSync(file, `${old.slice(0, old.indexOf(`export const ${EXPORT}`))}export const ${EXPORT}: readonly EvidenceLedgerEntry[] = ${JSON.stringify(entries, null, 2)};\n`);
for (const tracker of TRACKERS) {
  const s = readFileSync(resolve(ROOT, tracker), 'utf8');
  const line = s.split('\n').find((l) => l.includes(`**${CRITERION}**`) && l.includes(OLD));
  if (!line) throw new Error(`${tracker}: AC-056 old text not found`);
  writeFileSync(resolve(ROOT, tracker), s.replace(line, line.replace(OLD, NEW)));
}
execFileSync('pnpm', ['exec', 'prettier', '--write', FRAGMENT], { cwd: ROOT, stdio: 'inherit' });
