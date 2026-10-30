#!/usr/bin/env node
// Apply refutation 7 (lanes race7, pw7; web7's AC-271/AC-042 rows are deferred — see below) to the CURRENT Slice 12 ledger.
//
//   node --experimental-strip-types docs/handoffs/2026-10-22-claude-s12/recite7/apply7.mjs [--dry] [--report FILE]
//
// Order: AFTER recite4/apply4.mjs, dec240-s10-retitle.mjs, retitles2.mjs, retitles3-s10-truncated.mjs.
// Rules (refute7 report): KEEP adds under the refuter's clause index; FIX `refile:<criterion>:<clause>` re-files to that clause;
// FIX WHOLECLAIM is not cited (the limitation names it); DROP omits; missedTests add. AC-277 clauses 0 and 2 are split into
// the refuter's verbatim parts and only the parts its rows prove are cited. AC-273 and AC-276 receive no citation and the
// refuter's replacement limitation. DEFERRED to a later pass: AC-271 (its `loading`/`disabled` parts are citable only with
// extra rows and web7's round-2 retitles, which review V17 still verifies) and web7's AC-042 c5 rows.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../..');
const DRY = process.argv.includes('--dry');
const REPORT = (() => {
  const i = process.argv.indexOf('--report');
  return i < 0 ? null : process.argv[i + 1];
})();
const FRAGMENTS = ['001-071', '072-142', '143-213', '214-285', '286-296'].map(
  (range) => `tests/contracts/phase-02-slice-12-evidence-ledger-${range}.ts`,
);
const CLAUSE_SEPARATOR = /^(?:[\s;,.:—–-]|\band\b|\bor\b)*$/iu;
const DEFERRED = new Set(['P2-S12-AC-271']);
const DEFERRED_LANES = new Set(['web7']);
const NO_CITATION = new Set(['P2-S12-AC-273', 'P2-S12-AC-276']);
const refutation = JSON.parse(readFileSync(resolve(HERE, 'refutation.json'), 'utf8'));
const problems = [];
const log = [];

const fragments = [];
for (const path of FRAGMENTS) {
  const mod = await import(resolve(ROOT, path));
  const name = Object.keys(mod).find((key) => key.startsWith('S12_EVIDENCE_LEDGER'));
  fragments.push({ path, name, entries: structuredClone(mod[name]) });
}
const entryOf = new Map(fragments.flatMap((f) => f.entries.map((e) => [e.criterion, e])));
const before = new Map([...entryOf].map(([k, e]) => [k, structuredClone(e)]));
const identity = (c) => `${c.tool}|${c.file}|${c.title}|${c.project ?? ''}`;
const citation = (c) => ({ tool: c.tool, file: c.file, title: c.title, ...(c.project ? { project: c.project } : {}) });
const addTo = (clause, list) => {
  const seen = new Set(clause.citations.map(identity));
  for (const c of list) if (!seen.has(identity(c))) (seen.add(identity(c)), clause.citations.push(c));
};

/* ---- collect rows ------------------------------------------------------------------------------------------------ */
const rows = []; // { criterion, clauseIndex, part?, c }
for (const e of refutation) {
  if (DEFERRED.has(e.criterion)) continue;
  for (const c of e.citations ?? []) {
    if (DEFERRED_LANES.has(c.lane)) continue;
    if (c.verdict === 'DROP' || c.hold) continue;
    if (NO_CITATION.has(e.criterion) && !String(c.refile ?? '').startsWith('refile:')) continue;
    if (c.verdict === 'FIX') {
      const refile = String(c.refile ?? '');
      if (refile.startsWith('refile:')) {
        const [, criterion, clause] = refile.split(':');
        rows.push({ criterion, clauseIndex: Number(clause), c });
      } else if (c.dropClass !== 'WHOLECLAIM') problems.push(`${e.criterion}: unresolved FIX "${c.title.slice(0, 60)}"`);
      continue;
    }
    rows.push({ criterion: e.criterion, clauseIndex: c.clauseIndex, part: (c.splitParts ?? [])[0], c });
  }
  for (const m of e.missedTests ?? [])
    if (m.citation && !DEFERRED_LANES.has(m.lane)) rows.push({ criterion: m.criterion ?? e.criterion, clauseIndex: m.clauseIndex, c: m.citation });
}

/* ---- AC-277 splits ------------------------------------------------------------------------------------------------ */
const splitOf = new Map(); // `${criterion}|${clauseIndex}` -> parts
for (const e of refutation) for (const s of e.splits ?? []) if (e.criterion === 'P2-S12-AC-277') splitOf.set(`${e.criterion}|${s.clauseIndex}`, s.parts);
{
  const e = entryOf.get('P2-S12-AC-277');
  // apply from the highest clause index down so earlier indexes stay valid
  const keys = [...splitOf.keys()].map((k) => Number(k.split('|')[1])).sort((a, b) => b - a);
  const offset = new Map(); // original clause index -> first new index
  for (const index of keys) {
    const parts = splitOf.get(`P2-S12-AC-277|${index}`);
    const whole = e.clauses[index];
    let pos = 0;
    for (const part of parts) {
      const at = whole.text.indexOf(part, pos);
      if (at < 0 || !CLAUSE_SEPARATOR.test(whole.text.slice(pos, at))) problems.push(`AC-277 c${index} part does not tile: ${part.slice(0, 40)}`);
      pos = at + part.length;
    }
    if (whole.citations.length > 0) problems.push(`AC-277 c${index} already cited`);
    e.clauses.splice(index, 1, ...parts.map((text) => ({ text, citations: [] })));
  }
  // map original (index, part) to the new index: clauses before a split shift by (parts-1) of each earlier split
  const sorted = [...keys].sort((a, b) => a - b);
  const newIndex = (index, part) => {
    let shift = 0;
    for (const k of sorted) if (k < index) shift += splitOf.get(`P2-S12-AC-277|${k}`).length - 1;
    return index + shift + (splitOf.has(`P2-S12-AC-277|${index}`) ? (part ?? 0) : 0);
  };
  for (const r of rows.filter((x) => x.criterion === 'P2-S12-AC-277')) {
    if (splitOf.has(`P2-S12-AC-277|${r.clauseIndex}`) && r.part === undefined) {
      problems.push(`AC-277 c${r.clauseIndex} row without a split part: ${r.c.title.slice(0, 60)}`);
      continue;
    }
    r.clauseIndex = newIndex(r.clauseIndex, r.part);
    r.part = undefined;
  }
}

/* ---- apply ------------------------------------------------------------------------------------------------------- */
for (const r of rows) {
  const e = entryOf.get(r.criterion);
  if (!e) {
    problems.push(`${r.criterion}: not in ledger`);
    continue;
  }
  const clause = e.clauses[r.clauseIndex];
  if (!clause) problems.push(`${r.criterion}: no clause ${r.clauseIndex}`);
  else addTo(clause, [citation(r.c)]);
}

/* ---- status and limitations ------------------------------------------------------------------------------------- */
const advice = new Map(refutation.filter((e) => e.limitationAdvice).map((e) => [e.criterion, e.limitationAdvice]));
const touched = new Set([...rows.map((r) => r.criterion), ...refutation.map((e) => e.criterion)].filter((c) => !DEFERRED.has(c)));
const changes = [];
for (const criterion of touched) {
  const e = entryOf.get(criterion);
  if (!e) continue;
  const prev = before.get(criterion);
  const cited = e.clauses.filter((c) => c.citations.length > 0).length;
  e.status = cited === e.clauses.length ? 'verified' : cited === 0 ? 'unverified' : 'partial';
  const same =
    JSON.stringify(e.clauses.map((c) => [c.text, c.citations.map(identity)])) ===
    JSON.stringify(prev.clauses.map((c) => [c.text, c.citations.map(identity)]));
  if (e.status === 'verified') e.limitation = '';
  else if (advice.has(criterion) && (!same || NO_CITATION.has(criterion) || criterion === 'P2-S12-AC-277')) e.limitation = advice.get(criterion);
  if (e.status !== 'verified' && e.limitation.trim().length < 40) problems.push(`${criterion}: ${e.status} without a limitation`);
  if (!same || prev.status !== e.status || prev.limitation !== e.limitation) changes.push(`${criterion.slice(6)} ${prev.status}->${e.status}`);
}

const all = fragments.flatMap((f) => f.entries);
const count = (s) => all.filter((x) => x.status === s).length;
const summary = { problems, totals: { verified: count('verified'), partial: count('partial'), unverified: count('unverified') }, changes, log, rows: rows.length };
console.log(JSON.stringify(summary, null, 1));
if (REPORT) writeFileSync(resolve(ROOT, REPORT), `${JSON.stringify(summary, null, 1)}\n`);
if (DRY || problems.length > 0) process.exit(problems.length > 0 ? 1 : 0);
for (const { path, name, entries } of fragments) {
  const file = resolve(ROOT, path);
  const old = readFileSync(file, 'utf8');
  writeFileSync(file, `${old.slice(0, old.indexOf(`export const ${name}`))}export const ${name}: readonly EvidenceLedgerEntry[] = ${JSON.stringify(entries, null, 2)};\n`);
}
execFileSync('pnpm', ['exec', 'prettier', '--write', ...FRAGMENTS], { cwd: ROOT, stdio: 'inherit' });
