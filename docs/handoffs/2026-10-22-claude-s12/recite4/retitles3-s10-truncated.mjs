#!/usr/bin/env node
// The Slice 10 typed-reason apispec case re-pointed by retitles2.mjs is an it.each row whose `$label` Vitest truncates in the
// reported name ("'a non-empty taxonomy value naming an …'"); cite the exact reported identity (root, 2026-10-29; seen in
// test-results/evidence/vitest-postgrest.json of the slice-10 evidence run, status passed).
//   node --experimental-strip-types docs/handoffs/2026-10-22-claude-s12/recite4/retitles3-s10-truncated.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = '/home/rob/.codex/worktrees/phase2-slice12/WeJammin';
const FRAGMENT = 'tests/contracts/phase-02-slice-10-evidence-ledger-001-035.ts';
const OLD = "CMS-03B-01 typed value reasons through the real stack 'a non-empty taxonomy value naming an unknown term' is the typed 422 'term_unavailable' at its field pointer and nothing is written";
const NEW = "CMS-03B-01 typed value reasons through the real stack 'a non-empty taxonomy value naming an …' is the typed 422 'term_unavailable' at its field pointer and nothing is written";
const report = JSON.parse(readFileSync(resolve(ROOT, 'test-results/evidence/vitest-postgrest.json'), 'utf8'));
const seen = report.testResults.flatMap((f) => f.assertionResults).filter((a) => a.fullName === NEW);
if (seen.length !== 1 || seen[0].status !== 'passed') throw new Error(`reported identity not found once as passed (${seen.length})`);
const mod = await import(resolve(ROOT, FRAGMENT));
const name = Object.keys(mod).find((k) => Array.isArray(mod[k]));
const entries = structuredClone(mod[name]);
let hits = 0;
for (const e of entries) for (const c of e.clauses) c.citations = c.citations.map((x) => (x.title === OLD ? (hits += 1, { ...x, title: NEW }) : x));
if (hits !== 2) throw new Error(`expected 2 citations, found ${hits}`);
const file = resolve(ROOT, FRAGMENT);
const old = readFileSync(file, 'utf8');
writeFileSync(file, `${old.slice(0, old.indexOf(`export const ${name}`))}export const ${name}: readonly EvidenceLedgerEntry[] = ${JSON.stringify(entries, null, 2)};\n`);
execFileSync('pnpm', ['exec', 'prettier', '--write', FRAGMENT], { cwd: ROOT, stdio: 'inherit' });
console.log('re-pointed', hits);
