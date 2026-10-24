#!/usr/bin/env node
// DEC-227 criterion-text amendments (root, 2026-10-24). Run AFTER recite/apply.mjs (a rerun of apply.mjs restores the
// old texts; rerun this script after it). It changes, for AC-026, 062, 079, 086, 132, 134, 138, 141 and 274, the same
// substring in the phase-2 tracker, the Slice 12 progress tracker, the ledger criterion `text` and the clause it sits in,
// re-tiles the clauses, adds the citations named below and rewrites each touched limitation.
//
//   node --experimental-strip-types docs/handoffs/2026-10-22-claude-s12/recite/dec227-texts.mjs [--dry]

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = '/home/rob/.codex/worktrees/phase2-slice12/WeJammin';
const DRY = process.argv.includes('--dry');
const TRACKERS = [
  '.memory/wiki/specs/phases/phase-2.md',
  '.memory/pipeline/progress/slices/phase-02-slice-12.md',
];
const FRAGMENTS = [
  ['001-071', 'S12_EVIDENCE_LEDGER_001_071'],
  ['072-142', 'S12_EVIDENCE_LEDGER_072_142'],
  ['143-213', 'S12_EVIDENCE_LEDGER_143_213'],
  ['214-285', 'S12_EVIDENCE_LEDGER_214_285'],
  ['286-296', 'S12_EVIDENCE_LEDGER_286_296'],
];
const fragmentPath = (name) => `tests/contracts/phase-02-slice-12-evidence-ledger-${name}.ts`;

const pg = (file, title) => ({ tool: 'pgtap', file, title });
const vt = (file, title) => ({ tool: 'vitest', file, title });
const RC = 'supabase/tests/phase_02_slice_12_related_content/006-eligibility-authz.sqlinc';

// Each edit: criterion, old → new substring of the criterion text; `clauses` gives the new clause texts that replace
// the clauses the old substring touched (`from`..`to` inclusive, by current index) and the citations of each new clause
// (`keep` = carry the citations of these old clause indexes; `add` = new citations, identity-checked below).
const EDITS = [
  { criterion: 'P2-S12-AC-026', old: '; 400/404.', new: '; 422/404.',
    from: 3, to: 3, clauses: [{ text: '422/404.', keep: [3] }] },
  { criterion: 'P2-S12-AC-062', old: 'a hidden source or target (404 `RELATED_CONTENT_NOT_FOUND`)',
    new: 'a hidden source (404 `RELATED_CONTENT_NOT_FOUND`)',
    from: 3, to: 3, clauses: [{ text: 'a hidden source (404 `RELATED_CONTENT_NOT_FOUND`)', keep: [3], add: [
      pg(RC, 'a caller outside the owning organization sees the source as absent [P2-S12-AC-060]'),
      pg(RC, 'a source owned by another party is hidden: NOT_FOUND [P2-S12-AC-060]') ] }] },
  { criterion: 'P2-S12-AC-062', old: 'a pin, exclusion or rule schema failure (422 `RELATED_CONTENT_VALIDATION_FAILED`)',
    new: 'a pin, exclusion or rule schema failure or a hidden, absent or ineligible target (422 `RELATED_CONTENT_VALIDATION_FAILED`)',
    from: 6, to: 6, clauses: [{ text: 'a pin, exclusion or rule schema failure or a hidden, absent or ineligible target (422 `RELATED_CONTENT_VALIDATION_FAILED`)', keep: [6], add: [
      pg(RC, 'an absent, self, archived, held, unassigned (hidden) and other-owner pin each give related_target_ineligible [P2-S12-AC-227]'),
      pg(RC, 'the six refusals are byte-identical: a write is never an existence oracle [P2-S12-AC-227]'),
      vt('apps/worker/src/cms-composition/related-content-typed-refusals.test.ts', 'CMS-03C-05 typed refusals (BE03c 1304, 1380-1383) publishes related_target_ineligible with the offending row pointers as one uniform 422') ] }] },
  { criterion: 'P2-S12-AC-079', old: 'unchanged on create and revoke, admits',
    new: 'unchanged on create and revoke, except that revoking an assignment that authorized a counted approval invalidates the review (`reviewer_authority_changed`, 03b DEC-161), admits',
    from: 3, to: 3, clauses: [
      { text: 'revoke', keep: [3] },
      { text: 'except that revoking an assignment that authorized a counted approval invalidates the review (`reviewer_authority_changed`, 03b DEC-161)', add: [
        pg('supabase/tests/phase_02_slice_12_governed_assignment/040-bounds-revoke.sqlinc', 'revoking the assignment of a counted approval still answers 200 with the revoked assignment resource [P2-S12-AC-078]'),
        { tool: 'pgtap', file: 'supabase/tests/phase_02_slice_12_governed_assignment.sql', titleStartsWith: 'the same transaction invalidates the review reviewer_authority_changed at version 3' } ] }] },
  { criterion: 'P2-S12-AC-086', old: 'a time, tzdb or horizon failure, a preflight failure or `canonical_source_unavailable` with `details.domain` (422)',
    new: 'a time, tzdb or horizon failure or `canonical_source_unavailable` with `details.domain` (422; a template or pattern preflight difference is the `dependency_changed` invalidation)',
    from: 3, to: 5, clauses: [
      { text: 'a time, tzdb or horizon failure', keep: [3] },
      { text: 'or `canonical_source_unavailable` with `details.domain` (422; a template or pattern preflight difference is the `dependency_changed` invalidation)', keep: [5] }] },
  { criterion: 'P2-S12-AC-132', old: 'a hidden or absent vocabulary is 404', new: 'a hidden owner scope is 404 and no matching vocabulary is an empty page',
    from: 2, to: 3, clauses: [
      { text: 'a hidden owner scope is 404', keep: [2] },
      { text: 'no matching vocabulary is an empty page', keep: [3], add: [
        pg('supabase/tests/phase_02_slice_12_taxonomy_terms_reads/050-selector.sqlinc', 'a type or field no vocabulary allows is an empty page with pageVersion "1", not an error [P2-S12-AC-132]') ] }] },
  { criterion: 'P2-S12-AC-134', old: 'a hidden or absent vocabulary (404)', new: 'a hidden owner scope (404)',
    from: 1, to: 2, clauses: [{ text: 'a hidden owner scope (404)', keep: [1, 2] }] },
  { criterion: 'P2-S12-AC-138', old: 'executable only by its database-internal callers, `cms_act_taxonomy_term` and the taxonomy-version activation preflight (',
    new: 'executable only by its database-internal caller `cms_act_taxonomy_term` through `cms_term_overlap_check` (',
    from: 0, to: 0, clauses: [{ text: 'CMS-03C-18 is executable only by its database-internal caller `cms_act_taxonomy_term` through `cms_term_overlap_check` (', keep: [0] }] },
  { criterion: 'P2-S12-AC-141', old: 'consumed only by `cms_act_taxonomy_term` (create, rename and alias) and the taxonomy-version activation preflight',
    new: 'consumed only by `cms_act_taxonomy_term` (create, rename and alias) through `cms_term_overlap_check`, never by the taxonomy-version activation preflight, which reads the domain registry',
    from: 0, to: 0, clauses: [{ text: 'CMS-03C-18 is consumed only by `cms_act_taxonomy_term` (create, rename and alias) through `cms_term_overlap_check`, never by the taxonomy-version activation preflight, which reads the domain registry', keep: [0] }] },
  { criterion: 'P2-S12-AC-274', old: 'a provider timeout or fault is 503 `DEPENDENCY_UNAVAILABLE`',
    new: 'a provider fault or provider-reported timeout is 503, an invalid provider response 502 and the route deadline 504 `DEPENDENCY_UNAVAILABLE`',
    from: 0, to: 0, wholeClause: true, clauses: [{ keep: [0], add: [
      vt('apps/worker/src/cms-composition/governed-review-ops-provider.test.ts', "'CMS-03C-07' provider boundary ends a stalled RPC at the 15000 ms route deadline and never retries") ] }] },
];

// Limitations of the touched criteria, rewritten to the new clauses (segment replacements; `null` new = remove).
const LIMITATION_SEGMENTS = {
  'P2-S12-AC-026': [[/"400\/404\.": missing test:[\s\S]*$/u, '"422/404.": missing test: a Worker route test in apps/worker/src/cms-composition/pattern-instance-routes.test.ts that sends a non-UUID revisionId and a non-UUID patternId and asserts 422 COMPOSITION_VALIDATION_FAILED at the member pointer (BE03c line 382, DEC-227); the route answers every body schema failure 422 through apps/worker/src/cms-editorial/admission-body.ts decodeJson, but no CMS-03C-02 test sends a malformed id. The 404 half (pgTAP unknown-revision NOT_FOUND; the production adapter maps private NOT_FOUND to 404 COMPOSITION_NOT_FOUND) is proven elsewhere but the clause is cited only when both halves are.']],
  'P2-S12-AC-086': [
    [/"a preflight failure": missing test:[\s\S]*?a different operation\. /u, ''],
    ['"or `canonical_source_unavailable` with `details.domain` (422)"', '"or `canonical_source_unavailable` with `details.domain` (422; a template or pattern preflight difference is the `dependency_changed` invalidation)"'],
  ],
  'P2-S12-AC-134': [[/"absent vocabulary \(404\)":[\s\S]*?before this clause can be marked proven\. /u, '']],
  'P2-S12-AC-138': [[/^[\s\S]*$/u, 'Unproven (uncited clauses): "CMS-03C-18 is executable only by its database-internal caller `cms_act_taxonomy_term` through `cms_term_overlap_check` (" and "and every other role have EXECUTE revoked)": missing test: pgTAP in supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql asserting (a) that the proacl of platform_private.cms_canonical_taxonomy_match(text,jsonb) grants EXECUTE to no role but its owner wejammin_cms_definer (so "every other role" is covered, not only the four named roles; DEC-226 rule 2), and (b) a callers inventory over pg_proc.prosrc: the only function referencing cms_canonical_taxonomy_match is the definer-owned cms_term_overlap_check (called by cms_act_taxonomy_term, 20261014120200:184), while the activation preflight cms_governed_first_unbuilt_domain reads the registry provider_state (BE03c 193, DEC-227).']],
  'P2-S12-AC-141': [[/^[\s\S]*$/u, 'Unproven (uncited clauses): "CMS-03C-18 is consumed only by `cms_act_taxonomy_term` (create, rename and alias) through `cms_term_overlap_check`, never by the taxonomy-version activation preflight, which reads the domain registry": missing test: a callers inventory (pgTAP in supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql) over pg_proc.prosrc asserting that the only function referencing cms_canonical_taxonomy_match is the definer-owned cms_term_overlap_check (reached from cms_act_taxonomy_term create, rename and alias) and that cms_governed_first_unbuilt_domain (20261014070200) reads the domain registry without calling it (BE03c 193, 1533; DEC-227).']],
  'P2-S12-AC-079': [[/Further limits of cited clauses: Leaves the review version unchanged holds[\s\S]*?subject back to draft\)\. /u, 'Further limits of cited clauses: ']],
};

const vitestReport = JSON.parse(readFileSync(resolve(ROOT, '.lane-logs/canonical/s09-evidence-20261024T020357Z/pass2/vitest-all.json'), 'utf8'));
const vitestNames = new Map();
for (const f of vitestReport.testResults)
  for (const a of f.assertionResults) {
    const file = f.name.replace(`${ROOT}/`, '');
    const key = `${file}\u0000${a.fullName}`;
    vitestNames.set(key, (vitestNames.get(key) ?? []).concat(a.status));
  }
const tap = readFileSync(resolve(ROOT, '.lane-logs/canonical/s09-evidence-20261024T020357Z/db-test.tap'), 'utf8')
  .split('\n').map((line) => line.replace(/\s+/gu, ' ').trim()).filter((line) => /^ok \d+ - /u.test(line))
  .map((line) => line.replace(/^ok \d+ - /u, ''));

const problems = [];
const resolveCitation = (c) => {
  if (c.tool === 'vitest') {
    const st = vitestNames.get(`${c.file}\u0000${c.title}`);
    if (!st || st.length !== 1 || st[0] !== 'passed') problems.push(`vitest identity ${c.title.slice(0, 80)}: ${JSON.stringify(st)}`);
    return c;
  }
  if (c.titleStartsWith) {
    const hits = tap.filter((t) => t.startsWith(c.titleStartsWith));
    if (hits.length !== 1) problems.push(`pgtap prefix ${c.titleStartsWith.slice(0, 60)}: ${hits.length} hits`);
    return { tool: 'pgtap', file: c.file, title: hits[0] ?? c.titleStartsWith };
  }
  // A .sqlinc included by two entrypoints prints its description once per entrypoint, so the whole-run TAP may hold it
  // twice; an identity the apply lane already verified and cited elsewhere in the ledger is accepted as is.
  const n = tap.filter((t) => t === c.title).length;
  if (n === 0 || (n > 1 && !citedPgtap.has(`${c.file}\u0000${c.title}`)))
    problems.push(`pgtap identity ${c.title.slice(0, 80)}: ${n} occurrences`);
  return c;
};

const loaded = [];
for (const [name, exportName] of FRAGMENTS) {
  const mod = await import(resolve(ROOT, fragmentPath(name)));
  loaded.push([name, exportName, structuredClone(mod[exportName])]);
}
const citedPgtap = new Set();
for (const [, , entries] of loaded)
  for (const e of entries) for (const k of e.clauses) for (const c of k.citations)
    if (c.tool === 'pgtap') citedPgtap.add(`${c.file}\u0000${c.title}`);
const entryOf = (criterion) => {
  for (const [, , entries] of loaded) { const e = entries.find((x) => x.criterion === criterion); if (e) return e; }
  throw new Error(`no ${criterion}`);
};

// Apply edits per criterion from the highest clause index down so indexes stay valid.
const byCriterion = new Map();
for (const edit of EDITS) byCriterion.set(edit.criterion, (byCriterion.get(edit.criterion) ?? []).concat(edit));
for (const [criterion, edits] of byCriterion) {
  const entry = entryOf(criterion);
  for (const edit of [...edits].sort((a, b) => b.from - a.from)) {
    if (entry.text.split(edit.old).length !== 2) { problems.push(`${criterion}: old text not unique in criterion`); continue; }
    entry.text = entry.text.replace(edit.old, edit.new);
    const replaced = edit.clauses.map((nc) => {
      const citations = [];
      const seen = new Set();
      const push = (c) => { const k = `${c.tool}\u0000${c.file}\u0000${c.title}`; if (!seen.has(k)) { seen.add(k); citations.push(c); } };
      for (const i of nc.keep ?? []) for (const c of entry.clauses[i].citations) push(c);
      for (const c of nc.add ?? []) push(resolveCitation(c));
      if (nc.addFromTap) problems.push(`${criterion}: addFromTap needs a hand-picked identity (${nc.addFromTap.file})`);
      const text = edit.wholeClause ? entry.clauses[edit.from].text.replace(edit.old, edit.new) : nc.text;
      return { text, citations };
    });
    entry.clauses.splice(edit.from, edit.to - edit.from + 1, ...replaced);
  }
  for (const [o, n] of LIMITATION_SEGMENTS[criterion] ?? []) {
    const before = entry.limitation;
    entry.limitation = entry.limitation.replace(o, n);
    if (entry.limitation === before) problems.push(`${criterion}: limitation segment not found: ${String(o).slice(0, 60)}`);
  }
  // Status follows the guard rule: every clause cited -> verified with no limitation; some -> partial; none -> unverified.
  const cited = entry.clauses.filter((k) => k.citations.length > 0).length;
  entry.status = cited === entry.clauses.length ? 'verified' : cited === 0 ? 'unverified' : 'partial';
  if (entry.status === 'verified') entry.limitation = '';
  else if (entry.limitation.trim().length < 20) problems.push(`${criterion}: ${entry.status} needs a limitation`);
}
for (const [criterion] of byCriterion) {
  const e = entryOf(criterion);
  console.log(criterion, e.status, e.clauses.map((k) => k.citations.length).join(','));
}

console.log(JSON.stringify({ problems }, null, 1));
if (DRY || problems.length > 0) process.exit(problems.length > 0 ? 1 : 0);

for (const [name, exportName, entries] of loaded) {
  const file = resolve(ROOT, fragmentPath(name));
  const old = readFileSync(file, 'utf8');
  const header = old.slice(0, old.indexOf(`export const ${exportName}`));
  writeFileSync(file, `${header}export const ${exportName}: readonly EvidenceLedgerEntry[] = ${JSON.stringify(entries, null, 2)};\n`);
}
for (const tracker of TRACKERS) {
  let s = readFileSync(resolve(ROOT, tracker), 'utf8');
  for (const edit of EDITS) {
    const line = s.split('\n').find((l) => l.includes(`**${edit.criterion}**`) && l.includes(edit.old));
    if (!line) { console.log(`${tracker}: ${edit.criterion} old text not found (already applied?)`); continue; }
    s = s.replace(line, line.replace(edit.old, edit.new));
  }
  writeFileSync(resolve(ROOT, tracker), s);
}
execFileSync(resolve(ROOT, 'node_modules/.bin/prettier'), ['--write', ...FRAGMENTS.map(([n]) => fragmentPath(n))], { cwd: ROOT, stdio: 'inherit' });
console.log('written');
