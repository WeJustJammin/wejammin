#!/usr/bin/env node
// DEC-240 (root): the Slice 10 restore oracle `phase_02_slice_10_ev_ea_lineage.sql` test 9 was corrected by lane gaps-db5
// (V16-15) from "records exactly the source's ids" to the DEC-240 rule; re-point its one Slice 10 ledger citation (P2-S10-AC-002
// "taxonomy versions": restore with recorded taxonomy versions still holds — the pin check refuses an unresolvable version).
//   node --experimental-strip-types docs/handoffs/2026-10-22-claude-s12/recite4/dec240-s10-retitle.mjs [--dry]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = '/home/rob/.codex/worktrees/phase2-slice12/WeJammin';
const FRAGMENT = 'tests/contracts/phase-02-slice-10-evidence-ledger-001-035.ts';
const FILE = 'supabase/tests/phase_02_slice_10_ev_ea_lineage.sql';
const OLD = 'the restored draft records exactly the taxonomy version ids of its source revision';
const NEW =
  'the restored draft records no taxonomy version id of a vocabulary its source holds no assignment for: the pin resolves, the restore proceeds and DEC-240 does not carry it';
const mod = await import(resolve(ROOT, FRAGMENT));
const name = Object.keys(mod).find((k) => Array.isArray(mod[k]));
const entries = structuredClone(mod[name]);
let hits = 0;
for (const e of entries)
  for (const c of e.clauses)
    c.citations = c.citations.map((x) => (x.file === FILE && x.title === OLD ? (hits += 1, { ...x, title: NEW }) : x));
const source = readFileSync(resolve(ROOT, FILE), 'utf8');
const problems = [];
if (hits !== 1) problems.push(`expected one citation, found ${hits}`);
if (!source.includes(NEW)) problems.push('new title not in source');
console.log(JSON.stringify({ problems, hits }));
if (process.argv.includes('--dry') || problems.length) process.exit(problems.length ? 1 : 0);
const file = resolve(ROOT, FRAGMENT);
const old = readFileSync(file, 'utf8');
writeFileSync(file, `${old.slice(0, old.indexOf(`export const ${name}`))}export const ${name}: readonly EvidenceLedgerEntry[] = ${JSON.stringify(entries, null, 2)};\n`);
execFileSync('pnpm', ['exec', 'prettier', '--write', FRAGMENT], { cwd: ROOT, stdio: 'inherit' });
