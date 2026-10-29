#!/usr/bin/env node
// Re-cite the tests the promoted wave-3 changes retitled (root). Slice 12 made the taxonomy provider real (DEC-141/229,
// the taxonomy-integrity test-correction diff) and gaps-db2 made the CMS-03C-01 lock timeout the typed CONFLICT, so
// the Slice 10, 11 and 12 ledgers named titles that no longer exist.
//   - a title whose new assertion still proves the clause is replaced by the new title(s);
//   - a title whose new assertion no longer proves the clause is dropped (S11 AC-094: the generic reference gate no
//     longer serves taxonomy, as for pattern and locale before; the clause keeps its privacy/media/route proofs).
// Run AFTER recite2/apply2.mjs and recite2/dec235-ac056.mjs.
//   node --experimental-strip-types docs/handoffs/2026-10-22-claude-s12/recite2/retitles.mjs [--dry]

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = '/home/rob/.codex/worktrees/phase2-slice12/WeJammin';
const DRY = process.argv.includes('--dry');
const COMPARE = 'supabase/tests/phase_02_slice_10_compare_lineage.sql';
const REFUSAL = 'supabase/tests/phase_02_slice_10_value_source_refusal.sql';
const RESOLVE = 'supabase/tests/phase_02_slice_10_value_source_resolve.sql';
const PREFLIGHT = 'supabase/tests/phase_02_slice_11_helpers_preflight.sql';
const AUTHORITY = 'supabase/tests/phase_02_slice_12_template_authority.sql';
const RULES = [
  {
    fragment: 'tests/contracts/phase-02-slice-10-evidence-ledger-001-035.ts',
    file: COMPARE,
    old: 'a non-empty recorded taxonomy list fails closed even when the version exists: no Slice 10 authority resolves it (DEC-141)',
    new: [
      "a recorded taxonomy version that exists in the caller's owner scope is resolved by identity and the comparison succeeds (BE03c Receiving obligations from Slice 10 (DEC-141) item 1; P2-S12-AC-242)",
      'and the comparison is computed, not a partial answer (BE03c Receiving obligations from Slice 10 (DEC-141) item 1; P2-S12-AC-242)',
    ],
  },
  {
    fragment: 'tests/contracts/phase-02-slice-10-evidence-ledger-001-035.ts',
    file: REFUSAL,
    old: 'cms_create_revision: tax_nonempty fails closed with the typed taxonomy_source_unavailable reason [BE03b]',
    new: ['cms_create_revision: tax_nonempty names a term that is not assignable: the uniform term_unavailable reason (DEC-141 item 5) [BE03b]'],
  },
  {
    fragment: 'tests/contracts/phase-02-slice-10-evidence-ledger-001-035.ts',
    file: RESOLVE,
    old: 'cms_resolve_conflict: tax_nonempty fails closed with the typed taxonomy_source_unavailable reason [BE03b]',
    new: ['cms_resolve_conflict: tax_nonempty names a term that is not assignable: the uniform term_unavailable reason (DEC-141 item 5) [BE03b]'],
  },
  {
    fragment: 'tests/contracts/phase-02-slice-11-evidence-ledger-067-100.ts',
    file: PREFLIGHT,
    old: 'a recorded taxonomy version fails the taxonomy gate [P2-S11-AC-094]',
    new: [],
  },
  {
    fragment: 'tests/contracts/phase-02-slice-11-evidence-ledger-067-100.ts',
    file: PREFLIGHT,
    old: 'the remaining generic taxonomy reference gate carries the exact reference count [P2-S11-AC-094]',
    new: [],
  },
  {
    fragment: 'tests/contracts/phase-02-slice-12-evidence-ledger-001-071.ts',
    file: AUTHORITY,
    old: 'CMS-03C-01 waits for the same-key transaction lock before first-create read',
    new: ['CMS-03C-01 waits for the same-key transaction lock before first-create read, and the lock timeout is the retryable CONFLICT'],
  },
];

const problems = [];
const touched = new Map();
for (const rule of RULES) {
  if (!touched.has(rule.fragment)) {
    const mod = await import(resolve(ROOT, rule.fragment));
    const name = Object.keys(mod).find((k) => Array.isArray(mod[k]));
    touched.set(rule.fragment, { name, entries: structuredClone(mod[name]) });
  }
  const { entries } = touched.get(rule.fragment);
  const source = readFileSync(resolve(ROOT, rule.file), 'utf8').replace(/\s+/gu, ' ');
  for (const title of rule.new)
    if (!source.includes(title.replace(/'/gu, "''")) && !title.startsWith('cms_'))
      problems.push(`${rule.file}: new title not in source: ${title.slice(0, 80)}`);
  let hits = 0;
  for (const entry of entries)
    for (const clause of entry.clauses) {
      const at = clause.citations.findIndex((c) => c.file === rule.file && c.title === rule.old);
      if (at < 0) continue;
      hits += 1;
      const tool = clause.citations[at].tool;
      const present = new Set(clause.citations.map((c) => `${c.file}|${c.title}`));
      const fresh = rule.new.filter((t) => !present.has(`${rule.file}|${t}`)).map((title) => ({ tool, file: rule.file, title }));
      clause.citations.splice(at, 1, ...fresh);
      if (clause.citations.length === 0) problems.push(`${entry.criterion}: dropping "${rule.old.slice(0, 60)}" leaves a clause uncited`);
    }
  if (hits !== 1) problems.push(`${rule.fragment}: "${rule.old.slice(0, 60)}" cited ${hits} times, expected 1`);
}
console.log(JSON.stringify({ problems, fragments: [...touched.keys()] }, null, 1));
if (DRY || problems.length > 0) process.exit(problems.length > 0 ? 1 : 0);
for (const [fragment, { name, entries }] of touched) {
  const file = resolve(ROOT, fragment);
  const old = readFileSync(file, 'utf8');
  writeFileSync(file, `${old.slice(0, old.indexOf(`export const ${name}`))}export const ${name}: readonly EvidenceLedgerEntry[] = ${JSON.stringify(entries, null, 2)};\n`);
}
execFileSync('pnpm', ['exec', 'prettier', '--write', ...touched.keys()], { cwd: ROOT, stdio: 'inherit' });
