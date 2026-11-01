#!/usr/bin/env node
// Re-point six citations whose tests were retitled after the ledger cited them (root, 2026-10-29 evidence run): the
// nestable-read lane added a supporting read (25 catalog operations, 26 browser operations, nine reads), gaps-db5 widened
// the closeout boundary test for DEC-240, and the taxonomy-integrity correction renamed the Slice 10 typed-reason case
// (term_unavailable, DEC-141). Each new full name is checked against the fresh Vitest JSON of the evidence run.
//   node --experimental-strip-types docs/handoffs/2026-10-22-claude-s12/recite4/retitles2.mjs [--dry]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = '/home/rob/.codex/worktrees/phase2-slice12/WeJammin';
const VITEST_JSON = '.lane-logs/canonical/evidence-all-20261029T071815Z/s09/pass2/vitest-all.json';
const S12 = ['001-071', '072-142', '143-213', '214-285', '286-296'].map((r) => `tests/contracts/phase-02-slice-12-evidence-ledger-${r}.ts`);
const S10 = ['tests/contracts/phase-02-slice-10-evidence-ledger-001-035.ts', 'tests/contracts/phase-02-slice-10-evidence-ledger-036-070.ts'];
const RULES = [
  ['tests/contracts/phase-02-slice-12-closeout.test.ts',
    'Slice 12 implementation boundaries (P2-S12-AC-050) boundaries: the two SQL BOUNDARY: markers are the replaced anchors of the retire-request amendment, absent from its replacement text',
    'Slice 12 implementation boundaries (P2-S12-AC-050) boundaries: the SQL BOUNDARY: markers are the replaced anchors of the retire-request amendment and the restore marker the DEC-240 migration supersedes'],
  ['packages/contracts/src/cms-composition/refusals-operations.test.ts',
    'BE03c Slice 12 typed refusals per operation [P2-S12-AC-274] names an allowlist for exactly the 24 Slice 12 operations of the error catalog',
    'BE03c Slice 12 typed refusals per operation [P2-S12-AC-274] names an allowlist for exactly the 25 Slice 12 operations of the error catalog'],
  ['tests/contracts/phase-02-slice-12-registry-parity.test.ts',
    '[P2-S12-AC-275] the platform route registry holds no other Slice 12 browser operation [P2-S12-AC-275] keeps every method and path of the 25 operations unique in the registry',
    '[P2-S12-AC-275] the platform route registry holds no other Slice 12 browser operation [P2-S12-AC-275] keeps every method and path of the 26 operations unique in the registry'],
  ['tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
    '[P2-S12-AC-275] OpenAPI inventory [P2-S12-AC-275] documents exactly the 25 browser operations, CMS-03C-01 to CMS-03C-17 and the eight supporting reads',
    '[P2-S12-AC-275] OpenAPI inventory [P2-S12-AC-275] documents exactly the 26 browser operations, CMS-03C-01 to CMS-03C-17 and the nine supporting reads'],
  ['tests/contracts/phase-02-slice-12-registry-parity.test.ts',
    '[P2-S12-AC-275] the BE03c Route Registry is the browser inventory [P2-S12-AC-275] lists exactly CMS-03C-01 to CMS-03C-17 and the eight named supporting reads',
    '[P2-S12-AC-275] the BE03c Route Registry is the browser inventory [P2-S12-AC-275] lists exactly CMS-03C-01 to CMS-03C-17 and the nine named supporting reads'],
  ['tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts',
    "CMS-03B-01 typed value reasons through the real stack 'a non-empty taxonomy value' is the typed 422 'taxonomy_source_unavailable' at its field pointer and nothing is written",
    "CMS-03B-01 typed value reasons through the real stack 'a non-empty taxonomy value naming an unknown term' is the typed 422 'term_unavailable' at its field pointer and nothing is written"],
];
const json = JSON.parse(readFileSync(VITEST_JSON, 'utf8'));
const names = new Set(json.testResults.flatMap((f) => f.assertionResults.map((a) => a.fullName)));
const problems = [];
for (const [file, , now] of RULES) if (!names.has(now) && !file.startsWith('tests/postgrest/')) problems.push(`not in the fresh Vitest JSON: ${now.slice(0, 90)}`);
const apispec = readFileSync(resolve(ROOT, RULES[5][0]), 'utf8');
if (!apispec.includes("label: 'a non-empty taxonomy value naming an unknown term'") || !apispec.includes("reason: 'term_unavailable'")) problems.push('apispec case not found');
const touched = [];
let hits = 0;
for (const fragment of [...S12, ...S10]) {
  let mod;
  try { mod = await import(resolve(ROOT, fragment)); } catch { continue; }
  const name = Object.keys(mod).find((k) => Array.isArray(mod[k]));
  const entries = structuredClone(mod[name]);
  let changed = false;
  for (const e of entries) for (const c of e.clauses) c.citations = c.citations.map((x) => {
    const rule = RULES.find(([file, was]) => x.file === file && x.title === was);
    if (!rule) return x;
    hits += 1; changed = true;
    return { ...x, title: rule[2] };
  });
  if (changed) touched.push({ fragment, name, entries });
}
if (hits !== 7) problems.push(`expected 7 citations (the S10 case is cited twice), re-pointed ${hits}`);
console.log(JSON.stringify({ problems, hits, fragments: touched.map((t) => t.fragment) }));
if (process.argv.includes('--dry') || problems.length) process.exit(problems.length ? 1 : 0);
for (const { fragment, name, entries } of touched) {
  const file = resolve(ROOT, fragment);
  const old = readFileSync(file, 'utf8');
  writeFileSync(file, `${old.slice(0, old.indexOf(`export const ${name}`))}export const ${name}: readonly EvidenceLedgerEntry[] = ${JSON.stringify(entries, null, 2)};\n`);
}
execFileSync('pnpm', ['exec', 'prettier', '--write', ...touched.map((t) => t.fragment)], { cwd: ROOT, stdio: 'inherit' });
