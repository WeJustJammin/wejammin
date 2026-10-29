#!/usr/bin/env node
// Apply the refuted gap-wave-4 proposals (lanes gaps-db3, gaps-db4; refutation 3 and its db4 verification round) to the
// CURRENT Slice 12 ledger.
//
//   node --experimental-strip-types docs/handoffs/2026-10-22-claude-s12/recite3/apply3.mjs [--dry] [--report FILE]
//
// Order: AFTER recite2/dec236-ac056.mjs (the last ledger script before this one; see STATE.md "LATEST").
// Clauses are matched by TEXT, not by the lanes' indexes (db3 wrote AC-143 as index 2 and AC-056 before DEC-236 re-cut it).
// Verdicts: db3 from recite3/refutation.json; db4 from recite3/refutation-v2.json (the verification round over the fixed
// tests) — KEEP adds, DROP omits, FIX is resolved below or reported as a problem; missedTests (ledger clause indexes) add.
// Root rulings applied here: AC-155 c0 split in the AC-150 shape (the two unbuilt callers stay a BOUNDARY); AC-072 c4 loses
// its outcome-only citation (the submitter part is unreachable, like the creator part); AC-086 c4 receives the AC-210
// refusal proofs and the c0 frozen-dependency invalidation proof (refutation 3 cross-criterion note).

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
const json = (name) => JSON.parse(readFileSync(resolve(HERE, name), 'utf8'));
const proposals = [...json('db3-proposals.json'), ...json('db4-proposals.json')];
const db4Criteria = new Set(json('db4-proposals.json').map((p) => p.criterion));
if (!existsSync(resolve(HERE, 'refutation-v2.json'))) throw new Error('refutation-v2.json (db4 verification round) missing');
const refutationOf = (criterion) =>
  (db4Criteria.has(criterion) ? json('refutation-v2.json') : json('refutation.json')).find((r) => r.criterion === criterion);
const problems = [];
const log = [];

// Clause texts the lanes wrote that a later root ruling replaced.
const TEXT_REMAP = {
  'P2-S12-AC-056|answers a changed acting party':
    'and never replays to a changed acting party (an entry outside its scope is the concealed 404, answered before the key is reserved).',
};
const SPLITS = {
  'P2-S12-AC-155|CMS-03C-21 is executable only by the registered non-browser callers (the Shard 04 delivery projection and the Slice 11 related-content recheck':
    [
      { text: 'CMS-03C-21 is executable only by the registered non-browser callers', cite: true },
      {
        text: '(the Shard 04 delivery projection and the Slice 11 related-content recheck',
        gap: 'BOUNDARY: neither registered caller exists yet (the Shard 04 delivery projection is a later shard; the Slice 11 related-content recheck does not call CMS-03C-21); the owner-only EXECUTE and the empty caller inventory are cited on the first part, and the callers are proven when their shards land (the AC-150 shape).',
      },
    ],
};
const REASONS = {
  'P2-S12-AC-072|a separation-of-duties violation (the submitter':
    "BOUNDARY: the decision RPC's separation_of_duties branch cannot be reached by a submitter: the assignment guard and cms_assign_governed_reviewer refuse the submitter (20261013300600:166-168, 20261014010100:188-192) and the decision RPC answers capability_missing to anyone without an assignment (20261014010200:97-107) before its separation_of_duties check (:165); the reachable refusals are covered by governed_assignment/030-refusals.sqlinc (el-submitter).",
};

/* ---- ledger ---------------------------------------------------------------------------------------------------- */
const fragments = [];
for (const path of FRAGMENTS) {
  const mod = await import(resolve(ROOT, path));
  const name = Object.keys(mod).find((key) => key.startsWith('S12_EVIDENCE_LEDGER'));
  fragments.push({ path, name, entries: structuredClone(mod[name]) });
}
const entryOf = new Map(fragments.flatMap((f) => f.entries.map((e) => [e.criterion, e])));
const identity = (c) => `${c.tool}|${c.file}|${c.title}|${c.project ?? ''}`;
const citation = (c) => ({ tool: c.tool, file: c.file, title: c.title, ...(c.project ? { project: c.project } : {}) });
const addTo = (clause, list) => {
  const seen = new Set(clause.citations.map(identity));
  for (const c of list) if (!seen.has(identity(c))) (seen.add(identity(c)), clause.citations.push(c));
};
const snapshot = new Map([...entryOf].map(([k, e]) => [k, structuredClone(e)]));

/* ---- additions --------------------------------------------------------------------------------------------------- */
for (const p of proposals) {
  const entry = entryOf.get(p.criterion);
  const refutation = refutationOf(p.criterion);
  if (!entry || !refutation) {
    problems.push(`${p.criterion}: ${entry ? 'no refutation' : 'not in ledger'}`);
    continue;
  }
  const verdict = new Map((refutation.citations ?? []).map((c) => [c.title, c]));
  for (const c of p.clauses) {
    const text = TEXT_REMAP[`${p.criterion}|${c.text}`] ?? c.text;
    const clause = entry.clauses.find((x) => x.text === text);
    if (!clause) {
      problems.push(`${p.criterion}: clause "${text.slice(0, 60)}" not in ledger`);
      continue;
    }
    const kept = [];
    for (const a of c.add ?? []) {
      const v = verdict.get(a.title);
      if (!v) problems.push(`${p.criterion}: no verdict for "${a.title.slice(0, 70)}"`);
      else if (v.verdict === 'KEEP') kept.push(citation(a));
      else if (v.verdict === 'FIX') problems.push(`${p.criterion}: unresolved FIX "${a.title.slice(0, 70)}"`);
    }
    addTo(clause, kept);
  }
  for (const m of refutation.missedTests ?? []) {
    if (!m.citation) continue; // cross-criterion notes are applied below
    const clause = entry.clauses[m.clauseIndex];
    if (!clause) problems.push(`${p.criterion}: missed test on absent clause ${m.clauseIndex}`);
    else addTo(clause, [citation(m.citation)]);
  }
}

/* ---- root rulings ------------------------------------------------------------------------------------------------ */
{
  const e = entryOf.get('P2-S12-AC-072');
  const c4 = e.clauses.find((c) => c.text === 'a separation-of-duties violation (the submitter');
  if (!c4) problems.push('AC-072: submitter clause not found');
  else {
    log.push(`AC-072 c4: removed ${c4.citations.length} outcome-only citation(s)`);
    c4.citations = [];
  }
}
{
  const ac210 = entryOf.get('P2-S12-AC-210');
  const ac086 = entryOf.get('P2-S12-AC-086');
  const c4 = ac086.clauses.find((c) => c.text.startsWith('or `canonical_source_unavailable` with `details.domain`'));
  const invalidation = ac086.clauses[0].citations.filter((c) => c.title.startsWith('a changed frozen dependency commits the invalidation'));
  const refusals = ac210.clauses.flatMap((c) => c.citations).filter((c) => /canonical_source_unavailable/u.test(c.title));
  if (!c4 || invalidation.length === 0 || refusals.length === 0)
    problems.push(`AC-086 c4 cross-criterion: clause ${Boolean(c4)}, invalidation ${invalidation.length}, refusals ${refusals.length}`);
  else {
    addTo(c4, [...refusals, ...invalidation]);
    log.push(`AC-086 c4: ${refusals.length} refusal + ${invalidation.length} invalidation citations`);
  }
}
for (const [key, parts] of Object.entries(SPLITS)) {
  const [criterion, text] = key.split('|');
  const e = entryOf.get(criterion);
  const at = e.clauses.findIndex((c) => c.text === text);
  if (at < 0) {
    problems.push(`${criterion}: split clause not found`);
    continue;
  }
  const whole = e.clauses[at];
  e.clauses.splice(at, 1, ...parts.map((part) => ({ text: part.text, citations: part.cite ? whole.citations : [], gap: part.gap })));
}

/* ---- status and limitation ---------------------------------------------------------------------------------------- */
const tiles = (text, parts) => {
  let pos = 0;
  for (const part of parts) {
    const at = text.indexOf(part, pos);
    if (at < 0 || !CLAUSE_SEPARATOR.test(text.slice(pos, at))) return false;
    pos = at + part.length;
  }
  return CLAUSE_SEPARATOR.test(text.slice(pos));
};
const gapOf = new Map(proposals.flatMap((p) => p.clauses.filter((c) => c.gap).map((c) => [`${p.criterion}|${TEXT_REMAP[`${p.criterion}|${c.text}`] ?? c.text}`, c.gap])));
const touched = new Set([...proposals.map((p) => p.criterion), 'P2-S12-AC-086']);
const changes = [];
for (const criterion of touched) {
  const e = entryOf.get(criterion);
  const before = snapshot.get(criterion);
  const reasonFor = (c) => {
    const old = before.limitation;
    const marker = `"${c.text}":`;
    const at = old.indexOf(marker);
    let segment = null;
    if (at >= 0) {
      let end = old.length;
      for (const other of before.clauses.map((x) => x.text))
        if (other !== c.text) {
          const n = old.indexOf(`"${other}":`, at + marker.length);
          if (n >= 0 && n < end) end = n;
        }
      segment = old.slice(at + marker.length, end).trim();
    }
    return REASONS[`${criterion}|${c.text}`] ?? c.gap ?? gapOf.get(`${criterion}|${c.text}`) ?? segment;
  };
  if (!tiles(e.text, e.clauses.map((c) => c.text))) problems.push(`${criterion}: clauses do not tile`);
  const cited = e.clauses.filter((c) => c.citations.length > 0).length;
  e.status = cited === e.clauses.length ? 'verified' : cited === 0 ? 'unverified' : 'partial';
  const same =
    JSON.stringify(e.clauses.map((c) => [c.text, c.citations.map(identity)])) ===
    JSON.stringify(before.clauses.map((c) => [c.text, c.citations.map(identity)]));
  if (e.status === 'verified') e.limitation = '';
  else if (!same) {
    const uncited = e.clauses.filter((c) => c.citations.length === 0);
    e.limitation = `Unproven (uncited clause${uncited.length > 1 ? 's' : ''}): ${uncited
      .map((c) => {
        const reason = reasonFor(c);
        if (!reason) problems.push(`${criterion}: no reason for "${c.text.slice(0, 60)}"`);
        return `"${c.text}": ${String(reason ?? '').trim()}`;
      })
      .join(' ')}`;
  }
  for (const c of e.clauses) delete c.gap;
  if (!same || before.status !== e.status) changes.push(`${criterion.slice(6)} ${before.status}->${e.status}`);
}

const all = fragments.flatMap((f) => f.entries);
const count = (s) => all.filter((e) => e.status === s).length;
const summary = {
  problems,
  totals: { verified: count('verified'), partial: count('partial'), unverified: count('unverified') },
  changes,
  log,
};
console.log(JSON.stringify(summary, null, 1));
if (REPORT) writeFileSync(resolve(ROOT, REPORT), `${JSON.stringify(summary, null, 1)}\n`);
if (DRY || problems.length > 0) process.exit(problems.length > 0 ? 1 : 0);
for (const { path, name, entries } of fragments) {
  const file = resolve(ROOT, path);
  const old = readFileSync(file, 'utf8');
  writeFileSync(file, `${old.slice(0, old.indexOf(`export const ${name}`))}export const ${name}: readonly EvidenceLedgerEntry[] = ${JSON.stringify(entries, null, 2)};\n`);
}
execFileSync('pnpm', ['exec', 'prettier', '--write', ...FRAGMENTS], { cwd: ROOT, stdio: 'inherit' });
