#!/usr/bin/env node
// Limitation texts refute2-b asked root to correct (request 5): name the BOUNDARY and the sound evidence the refutation
// dropped instead of a "missing test" that no producer can drive. Text-only; clauses and citations are unchanged.
// Run AFTER recite2/retitles.mjs.
//   node --experimental-strip-types docs/handoffs/2026-10-22-claude-s12/recite2/limitations.mjs [--dry]

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = '/home/rob/.codex/worktrees/phase2-slice12/WeJammin';
const DRY = process.argv.includes('--dry');
const FRAGMENT = 'tests/contracts/phase-02-slice-12-evidence-ledger-286-296.ts';
const TEXTS = {
  'P2-S12-AC-289':
    'Unproven (uncited clause): "the public response is uniform across both cases and leaves no partial create effects.": BOUNDARY: the public platform_api.cms_create_entry cannot reach the missing or concealed default branch, because no producer stores an absent or other-owner default (the schema compatibility guard and the template registry forbid the state), so neither the public body nor the absence of create effects can be driven. Sound gate-level evidence that does not prove the public clause: phase_02_slice_12_gaps_entry_default.sql calls the DEC-202 gate directly and shows an absent and an other-owner default give the same 404 NOT_FOUND with no detail (equal SQLSTATE, message and DETAIL); its store-count assertion there is blind (taken around an EXCEPTION block that rolls the gate back).',
  'P2-S12-AC-295':
    'Unproven (uncited clauses): "CMS-03B-10 default changes affect only later entry creation.": BOUNDARY: no case changes a type default under an entry that already holds revisions (a default change needs a successor schema version with its per-row evidence flow, unbuilt here); the existing cases supersede the template while the type default stays S1 (EDP-S03). "append, conflict resolution, restore, and locale carry do not initialize or silently rebind historical pins from the current default.": BOUNDARY, same cause: the behavioural form needs a default change under an existing entry. Only a source-text proxy exists (phase_02_slice_12_gaps_entry_default.sql scans seven carry writers for default_template_version_id and finds none), which a source scan cannot turn into behaviour; the DEC-201 restore gate assertions guard a different rule.',
};

const mod = await import(resolve(ROOT, FRAGMENT));
const name = Object.keys(mod).find((k) => Array.isArray(mod[k]));
const entries = structuredClone(mod[name]);
const problems = [];
for (const [criterion, text] of Object.entries(TEXTS)) {
  const entry = entries.find((e) => e.criterion === criterion);
  const uncited = entry.clauses.filter((c) => c.citations.length === 0).map((c) => c.text);
  for (const t of uncited) if (!text.includes(`"${t}"`)) problems.push(`${criterion}: limitation does not name "${t.slice(0, 60)}"`);
  if (entry.status === 'verified') problems.push(`${criterion}: verified, no limitation allowed`);
  entry.limitation = text;
}
console.log(JSON.stringify({ problems }));
if (DRY || problems.length > 0) process.exit(problems.length > 0 ? 1 : 0);
const file = resolve(ROOT, FRAGMENT);
const old = readFileSync(file, 'utf8');
writeFileSync(file, `${old.slice(0, old.indexOf(`export const ${name}`))}export const ${name}: readonly EvidenceLedgerEntry[] = ${JSON.stringify(entries, null, 2)};\n`);
execFileSync('pnpm', ['exec', 'prettier', '--write', FRAGMENT], { cwd: ROOT, stdio: 'inherit' });
