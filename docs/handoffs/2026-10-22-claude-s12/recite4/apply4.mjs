#!/usr/bin/env node
// Apply the wave-5 refutations (refute4: lanes gaps-unit5 + gaps-api5; refute5: lanes web6 + gaps-pw5) to the CURRENT
// Slice 12 ledger.
//
//   node --experimental-strip-types docs/handoffs/2026-10-22-claude-s12/recite4/apply4.mjs [--dry] [--report FILE]
//
// Order: AFTER recite3/apply3.mjs. Works from the refutations' own citation records (tool, file, title, clauseIndex = the
// CURRENT ledger clause index the refuters mapped), not from the proposals:
//   KEEP (not held) adds; DROP omits; FIX is resolved per row below; missedTests add.
// Root rulings (DEC-241, refute5 section 7): AC-271 clause 0 is split into the refuter's 8 verbatim parts and only parts 0
// (idle) and 3 (empty) are cited; AC-272 is cited unsplit (refute4's split superseded by refute5: web6 row 4 landed);
// a mount-only page test does not close "consumed by … at /app/…" (AC-058, AC-111 and the /patterns/new and
// /taxonomies/new page tests); AC-273 J1/J2 are not cited. Stale identities renamed by the unit5 fix rounds (DEC-239) are
// re-pointed. Rows the unit5 fix rounds added after refute4 are NOT cited here (a later refutation judges them).

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
const r4 = JSON.parse(readFileSync(resolve(HERE, 'refutation.json'), 'utf8'));
const r5 = JSON.parse(readFileSync(resolve(HERE, '../recite5/refutation.json'), 'utf8'));
const unit5 = JSON.parse(readFileSync(resolve(HERE, 'unit5-proposals.json'), 'utf8'));
const problems = [];
const warnings = [];
const log = [];

/* ---- ledger ---------------------------------------------------------------------------------------------------- */
const fragments = [];
for (const path of FRAGMENTS) {
  const mod = await import(resolve(ROOT, path));
  const name = Object.keys(mod).find((key) => key.startsWith('S12_EVIDENCE_LEDGER'));
  fragments.push({ path, name, entries: structuredClone(mod[name]) });
}
const entryOf = new Map(fragments.flatMap((f) => f.entries.map((e) => [e.criterion, e])));
const before = new Map([...entryOf].map(([k, e]) => [k, structuredClone(e)]));
const identity = (c) => `${c.tool}|${c.file}|${c.title}|${c.project ?? ''}`;
const citation = (c, title = c.title) => ({ tool: c.tool, file: c.file, title, ...(c.project ? { project: c.project } : {}) });
const addTo = (clause, list) => {
  const seen = new Set(clause.citations.map(identity));
  for (const c of list) if (!seen.has(identity(c))) (seen.add(identity(c)), clause.citations.push(c));
};
const sourceHas = (file, title) => {
  if (!existsSync(resolve(ROOT, file))) return false;
  const s = readFileSync(resolve(ROOT, file), 'utf8').replace(/\s+/gu, ' ');
  const words = title.split(' ');
  for (let k = Math.min(words.length, 10); k >= 4; k -= 1) if (s.includes(words.slice(-k).join(' '))) return true;
  return s.includes(title) || s.includes(title.replace(/'/gu, "''"));
};

/* ---- stale identities re-pointed (unit5 fix rounds) ---------------------------------------------------------------- */
const stale = unit5.flatMap((p) => [...(p.staleExisting ?? []), ...(p.clauses ?? []).flatMap((c) => c.staleExisting ?? [])]);
for (const s of stale) {
  const oldTitle = s.oldTitle ?? s.old ?? s.title;
  const newTitle = s.newTitle ?? s.new ?? s.replacement;
  if (!oldTitle || !newTitle) {
    problems.push(`staleExisting entry without old/new title: ${JSON.stringify(s).slice(0, 120)}`);
    continue;
  }
  let hits = 0;
  for (const e of entryOf.values())
    for (const clause of e.clauses)
      clause.citations = clause.citations.map((c) => (c.title === oldTitle ? (hits += 1, { ...c, title: newTitle }) : c));
  log.push(`re-pointed ${hits}× "${oldTitle.slice(0, 60)}"`);
  if (hits === 0) warnings.push(`stale title not found in ledger: ${oldTitle.slice(0, 80)}`);
}

/* ---- per-row resolution ------------------------------------------------------------------------------------------- */
const MOUNT_ONLY = (criterion, c) =>
  c.file.endsWith('phase-02-slice-12-definition-pages-real-route.spec.ts') &&
  (criterion === 'P2-S12-AC-058' ||
    criterion === 'P2-S12-AC-111' ||
    // AC-105 / AC-129 name a COMMAND (CMS-03C-12 / -16) consumed at both routes; their page tests only mount the
    // designer (the :key ones over data saved through the API), so neither closes c0 (DEC-241).
    criterion === 'P2-S12-AC-105' ||
    criterion === 'P2-S12-AC-129');
const AC271_CITED_PARTS = new Set([0, 3]);
const plan = new Map(); // criterion -> [{ clauseIndex | part, citation }]
const push = (criterion, target, c) => {
  if (!plan.has(criterion)) plan.set(criterion, []);
  plan.get(criterion).push({ target, c });
};
for (const [round, list] of [['r4', r4], ['r5', r5]])
  for (const e of list) {
    const criterion = e.criterion;
    for (const c of e.citations ?? []) {
      if (c.verdict === 'DROP' || c.hold) continue;
      if (MOUNT_ONLY(criterion, c)) {
        log.push(`${criterion}: mount-only page test not cited (DEC-241): ${c.title.slice(0, 70)}`);
        continue;
      }
      if (criterion === 'P2-S12-AC-273') continue; // refute5: do not cite J1/J2
      if (criterion === 'P2-S12-AC-271') {
        if (c.verdict !== 'KEEP') continue;
        const part = (c.splitParts ?? [])[0];
        if (AC271_CITED_PARTS.has(part)) push(criterion, { part }, citation(c));
        continue;
      }
      if (c.verdict === 'KEEP') {
        const index = criterion === 'P2-S12-AC-272' ? 0 : c.clauseIndex;
        push(criterion, { clauseIndex: index }, citation(c));
        continue;
      }
      // FIX resolutions
      if (criterion === 'P2-S12-AC-164') push(criterion, { clauseIndex: 5 }, citation(c));
      else if (criterion === 'P2-S12-AC-010') push(criterion, { clauseIndex: c.clauseIndex }, citation(c));
      else if (criterion === 'P2-S12-AC-176') push(criterion, { clauseIndex: 2 }, citation(c));
      else if (criterion === 'P2-S12-AC-272') push(criterion, { clauseIndex: 1 }, citation(c));
      else if (criterion === 'P2-S12-AC-265') {
        const title = [c.title, c.correctedTitle].find((t) => t && sourceHas(c.file, t));
        if (!title) problems.push(`AC-265 FIX: neither title exists in ${c.file}`);
        else push(criterion, { clauseIndex: c.clauseIndex }, citation(c, title));
      } else problems.push(`${round} ${criterion}: unresolved FIX "${c.title.slice(0, 60)}"`);
    }
    for (const m of e.missedTests ?? []) if (m.citation) push(criterion, { clauseIndex: m.clauseIndex }, citation(m.citation));
  }

/* ---- AC-271 split ------------------------------------------------------------------------------------------------- */
{
  const e = entryOf.get('P2-S12-AC-271');
  const split = r5.find((x) => x.criterion === 'P2-S12-AC-271').splits[0];
  const whole = e.clauses[0];
  const parts = split.parts;
  let pos = 0;
  for (const part of parts) {
    const at = whole.text.indexOf(part, pos);
    if (at < 0 || !CLAUSE_SEPARATOR.test(whole.text.slice(pos, at))) problems.push(`AC-271 part does not tile: ${part.slice(0, 40)}`);
    pos = at + part.length;
  }
  if (whole.citations.length > 0) problems.push(`AC-271 c0 already cited (${whole.citations.length})`);
  e.clauses.splice(0, 1, ...parts.map((text) => ({ text, citations: [] })));
  for (const { target, c } of plan.get('P2-S12-AC-271') ?? []) addTo(e.clauses[target.part], [c]);
  plan.delete('P2-S12-AC-271');
}

/* ---- apply the rest ------------------------------------------------------------------------------------------------ */
for (const [criterion, rows] of plan) {
  const e = entryOf.get(criterion);
  if (!e) {
    problems.push(`${criterion}: not in ledger`);
    continue;
  }
  for (const { target, c } of rows) {
    const clause = e.clauses[target.clauseIndex];
    if (!clause) problems.push(`${criterion}: no clause ${target.clauseIndex}`);
    else {
      if (!sourceHas(c.file, c.title)) warnings.push(`${criterion}: title not found statically in ${c.file}: ${c.title.slice(0, 70)}`);
      addTo(clause, [c]);
    }
  }
}

/* ---- status and limitations --------------------------------------------------------------------------------------- */
const advice = new Map();
for (const list of [r4, r5]) for (const e of list) if (e.limitationAdvice) advice.set(e.criterion, e.limitationAdvice);
const touched = new Set([...r4, ...r5].map((e) => e.criterion));
const changes = [];
for (const criterion of touched) {
  const e = entryOf.get(criterion);
  const prev = before.get(criterion);
  const cited = e.clauses.filter((c) => c.citations.length > 0).length;
  e.status = cited === e.clauses.length ? 'verified' : cited === 0 ? 'unverified' : 'partial';
  const same =
    JSON.stringify(e.clauses.map((c) => [c.text, c.citations.map(identity)])) ===
    JSON.stringify(prev.clauses.map((c) => [c.text, c.citations.map(identity)]));
  if (e.status === 'verified') e.limitation = '';
  else if (advice.has(criterion) && !same) e.limitation = advice.get(criterion);
  else if (advice.has(criterion) && ['P2-S12-AC-169', 'P2-S12-AC-273', 'P2-S12-AC-164'].includes(criterion))
    e.limitation = advice.get(criterion);
  if (e.status !== 'verified') {
    for (const c of e.clauses.filter((x) => x.citations.length === 0))
      if (!e.limitation.includes(c.text.slice(0, 24)) && !e.limitation.includes(c.text.replace(/`/gu, '').slice(0, 24)))
        warnings.push(`${criterion}: limitation may not name uncited clause "${c.text.slice(0, 50)}"`);
    if (e.limitation.trim().length < 40) problems.push(`${criterion}: ${e.status} without a limitation`);
  }
  if (!same || prev.status !== e.status || prev.limitation !== e.limitation)
    changes.push(`${criterion.slice(6)} ${prev.status}->${e.status}`);
}

const all = fragments.flatMap((f) => f.entries);
const count = (s) => all.filter((x) => x.status === s).length;
const summary = { problems, warnings, totals: { verified: count('verified'), partial: count('partial'), unverified: count('unverified') }, changes, log };
console.log(JSON.stringify(summary, null, 1));
if (REPORT) writeFileSync(resolve(ROOT, REPORT), `${JSON.stringify(summary, null, 1)}\n`);
if (DRY || problems.length > 0) process.exit(problems.length > 0 ? 1 : 0);
for (const { path, name, entries } of fragments) {
  const file = resolve(ROOT, path);
  const old = readFileSync(file, 'utf8');
  writeFileSync(file, `${old.slice(0, old.indexOf(`export const ${name}`))}export const ${name}: readonly EvidenceLedgerEntry[] = ${JSON.stringify(entries, null, 2)};\n`);
}
execFileSync('pnpm', ['exec', 'prettier', '--write', ...FRAGMENTS], { cwd: ROOT, stdio: 'inherit' });
