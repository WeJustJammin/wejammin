#!/usr/bin/env node
// DEC-236 (root, owner may override; amends DEC-235 after lane gaps-db3): the acting party is part of the key's binding,
// but CMS-03C-04 checks the entry's ownership and visibility before it reserves the key, so a changed acting party meets
// the entry's concealed 404 and never a replay (a 409 would confirm the entry exists). AC-056's last clause is rewritten
// in the phase-2 tracker, the Slice 12 progress tracker and the ledger: the 409 keeps body, path and version; the acting
// party gets its own clause, uncited until the gaps-db3 proposals pass refutation 3.
// Run AFTER recite2/dec235-ac056.mjs.
//   node --experimental-strip-types docs/handoffs/2026-10-22-claude-s12/recite2/dec236-ac056.mjs [--dry]

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = '/home/rob/.codex/worktrees/phase2-slice12/WeJammin';
const DRY = process.argv.includes('--dry');
const CRITERION = 'P2-S12-AC-056';
const OLD = 'answers a changed acting party, body, path or version under the same key with 409.';
const NEW =
  'answers a changed body, path or version under the same key with 409, and never replays to a changed acting party (an entry outside its scope is the concealed 404, answered before the key is reserved).';
const OLD_CLAUSES = ['answers a changed acting party', 'body, path or version under the same key with 409.'];
const NEW_CLAUSES = [
  'answers a changed body, path or version under the same key with 409,',
  'and never replays to a changed acting party (an entry outside its scope is the concealed 404, answered before the key is reserved).',
];
const REASON =
  'pending refutation 3: lane gaps-db3 (phase_02_slice_12_gaps_db3_locale_party.sql) shows the same actor under another server-resolved acting party is never served the stored response, meets the concealed NOT_FOUND before the reservation is read, writes nothing, and that the reservation itself binds the party (IDEMPOTENCY_MISMATCH at the primitive; a different actor is its own binding); not cited until refuted (DEC-236).';
const TRACKERS = ['.memory/wiki/specs/phases/phase-2.md', '.memory/pipeline/progress/slices/phase-02-slice-12.md'];
const FRAGMENT = 'tests/contracts/phase-02-slice-12-evidence-ledger-001-071.ts';
const EXPORT = 'S12_EVIDENCE_LEDGER_001_071';

const problems = [];
const mod = await import(resolve(ROOT, FRAGMENT));
const entries = structuredClone(mod[EXPORT]);
const entry = entries.find((e) => e.criterion === CRITERION);
if (entry.text.split(OLD).length !== 2) problems.push('criterion text: old phrase not found once');
entry.text = entry.text.replace(OLD, NEW);
const at = entry.clauses.findIndex((c) => c.text === OLD_CLAUSES[0]);
if (at < 0 || entry.clauses[at + 1]?.text !== OLD_CLAUSES[1]) problems.push('old clause pair not found');
else {
  if (entry.clauses[at].citations.length > 0) problems.push('acting-party clause unexpectedly cited');
  entry.clauses.splice(
    at,
    2,
    { text: NEW_CLAUSES[0], citations: entry.clauses[at + 1].citations },
    { text: NEW_CLAUSES[1], citations: [] },
  );
}
const seg = /"answers a changed acting party": [\s\S]*?(?="[^"]+": |$)/u;
if (!seg.test(entry.limitation)) problems.push('limitation: acting-party segment not found');
entry.limitation = entry.limitation.replace(seg, `"${NEW_CLAUSES[1]}": ${REASON} `).trim();
const cited = entry.clauses.filter((c) => c.citations.length > 0).length;
entry.status = cited === entry.clauses.length ? 'verified' : cited === 0 ? 'unverified' : 'partial';
console.log(JSON.stringify({ problems, status: entry.status, clauses: entry.clauses.slice(-3).map((c) => [c.text.slice(0, 60), c.citations.length]) }, null, 1));
if (DRY || problems.length > 0) process.exit(problems.length > 0 ? 1 : 0);

const file = resolve(ROOT, FRAGMENT);
const old = readFileSync(file, 'utf8');
writeFileSync(file, `${old.slice(0, old.indexOf(`export const ${EXPORT}`))}export const ${EXPORT}: readonly EvidenceLedgerEntry[] = ${JSON.stringify(entries, null, 2)};\n`);
for (const tracker of TRACKERS) {
  const s = readFileSync(resolve(ROOT, tracker), 'utf8');
  const line = s.split('\n').find((l) => l.includes(`**${CRITERION}**`) && l.includes(OLD));
  if (!line) throw new Error(`${tracker}: AC-056 text not found`);
  writeFileSync(resolve(ROOT, tracker), s.replace(line, line.replace(OLD, NEW)));
}
execFileSync('pnpm', ['exec', 'prettier', '--write', FRAGMENT], { cwd: ROOT, stdio: 'inherit' });
