#!/usr/bin/env node
// Apply refutations 8 and 8b (lanes web8a, web8b, db8) to the CURRENT Slice 12 ledger.
//
//   node --experimental-strip-types docs/handoffs/2026-10-22-claude-s12/recite8/apply8.mjs [--dry] [--report FILE]
//
// Order: AFTER recite7/dec243-ac159.mjs and AFTER the wave-9 web round that fixes the titles refute8b marked FIX:TITLE /
// FIX:PINNED (overrides in `title-overrides.json`, { "<old or proposed title>": "<final title>" }). Limitations are NOT written
// here: the wave-9 limitations script sets them once for every criterion this script and apply9 touch.
// Rules (review-refute8-report.md, review-refute8b-report.md, DEC-245):
//   - ledger retitles: refute8b `retitleMap` rows with scope "ledger" (dead identities re-pointed in place);
//   - AC-271: cite parts loading (c1, rowsToCite + rowsAdditive), success (c2) and disabled (c6) from refute8b `partRulings`;
//     error (c4), degraded (c5) and the closing words (c7) stay uncited; c10 and c11 are uncited (DEC-245(5));
//   - AC-085: refute8 KEEP rows at their clause;
//   - AC-294: c1 split into refute8's five verbatim parts; KEEP rows to their part; FIX ADJACENT re-filed to c0; WHOLECLAIM and
//     the part-3 relation-target rows (DEC-245(6): part 3 is a DEFINITION lever) not cited;
//   - AC-277: refute8 KEEP rows and missedTests at clauses 3 and 4; DROP MODEL rows (U3 stand-in, DEC-245(7)) not cited.
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
const r8 = JSON.parse(readFileSync(resolve(HERE, 'refutation.json'), 'utf8'));
const r8b = JSON.parse(readFileSync(resolve(HERE, 'refutation-8b.json'), 'utf8'));
const overridesPath = resolve(HERE, 'title-overrides.json');
const overrides = existsSync(overridesPath) ? JSON.parse(readFileSync(overridesPath, 'utf8')) : {};
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
const final = (title) => overrides[title] ?? title;
const citation = (c) => ({ tool: c.tool, file: c.file, title: final(c.title), ...(c.project ? { project: c.project } : {}) });
const addTo = (clause, list) => {
  const seen = new Set(clause.citations.map(identity));
  for (const c of list.map(citation)) if (!seen.has(identity(c))) (seen.add(identity(c)), clause.citations.push(c));
};
const entry = (criterion) => {
  const e = entryOf.get(criterion);
  if (!e) problems.push(`${criterion}: not in ledger`);
  return e;
};

/* ---- 1. ledger retitles (refute8b retitleMap, scope ledger) ------------------------------------------------------- */
const retitles = r8b.flatMap((e) => e.retitleMap ?? []).filter((m) => m.scope === 'ledger');
const seenRetitle = new Set();
for (const m of retitles) {
  const key = `${m.criterion}|${m.clauseIndex}|${m.oldTitle}`;
  if (seenRetitle.has(key)) continue;
  seenRetitle.add(key);
  const clause = entry(m.criterion)?.clauses[m.clauseIndex];
  const at = clause?.citations.findIndex((c) => c.file === m.file && c.title === m.oldTitle) ?? -1;
  if (at < 0) {
    problems.push(`retitle ${m.criterion} c${m.clauseIndex}: old title not cited: ${m.oldTitle.slice(0, 60)}`);
    continue;
  }
  clause.citations[at] = { ...clause.citations[at], title: final(m.newTitle) };
  log.push(`retitle ${m.criterion.slice(6)} c${m.clauseIndex}`);
}

/* ---- 2. AC-271 parts ---------------------------------------------------------------------------------------------- */
{
  const e = entry('P2-S12-AC-271');
  const rulings = r8b.find((x) => x.criterion === 'P2-S12-AC-271').partRulings;
  for (const p of rulings.filter((x) => x.citableNow === true)) {
    const rows = [...(p.rowsToCite ?? []), ...(p.rowsAdditive ?? [])];
    if (e.clauses[p.clauseIndex].text.length === 0 || rows.length === 0) problems.push(`AC-271 part ${p.part}: no rows`);
    addTo(e.clauses[p.clauseIndex], rows);
    log.push(`AC-271 c${p.clauseIndex} ${p.name}: ${rows.length} rows`);
  }
  for (const index of [10, 11]) {
    log.push(`AC-271 c${index} uncited (${e.clauses[index].citations.length} citations, DEC-245(5))`);
    e.clauses[index].citations = [];
  }
}

/* ---- 3. AC-085 ---------------------------------------------------------------------------------------------------- */
{
  const e = entry('P2-S12-AC-085');
  const rows = r8.find((x) => x.criterion === 'P2-S12-AC-085').citations.filter((c) => c.verdict === 'KEEP');
  for (const c of rows) addTo(e.clauses[c.clauseIndex], [c]);
  log.push(`AC-085 ${rows.length} rows`);
}

/* ---- 4. AC-294 split ---------------------------------------------------------------------------------------------- */
{
  const e = entry('P2-S12-AC-294');
  const ref = r8.find((x) => x.criterion === 'P2-S12-AC-294');
  const { clauseIndex, parts } = ref.splits[0];
  const whole = e.clauses[clauseIndex];
  let pos = 0;
  for (const part of parts) {
    const at = whole.text.indexOf(part, pos);
    if (at < 0 || !CLAUSE_SEPARATOR.test(whole.text.slice(pos, at))) problems.push(`AC-294 part does not tile: ${part}`);
    pos = at + part.length;
  }
  if (!CLAUSE_SEPARATOR.test(whole.text.slice(pos))) problems.push('AC-294 split leaves a tail');
  if (whole.citations.length > 0) problems.push('AC-294 c1 already cited');
  e.clauses.splice(clauseIndex, 1, ...parts.map((text) => ({ text, citations: [] })));
  for (const c of ref.citations) {
    if (c.verdict === 'FIX' && c.dropClass === 'ADJACENT') addTo(e.clauses[0], [c]);
    if (c.verdict !== 'KEEP') continue;
    const part = (c.splitParts ?? [])[0];
    if (part === undefined) problems.push(`AC-294 KEEP row without a part: ${c.title.slice(0, 60)}`);
    else if (part === 3) log.push(`AC-294 part 3 relation-target row held (DEC-245(6)): ${c.title.slice(0, 50)}`);
    else addTo(e.clauses[clauseIndex + part], [c]);
  }
}

/* ---- 5. AC-277 ---------------------------------------------------------------------------------------------------- */
{
  const e = entry('P2-S12-AC-277');
  const ref = r8.find((x) => x.criterion === 'P2-S12-AC-277');
  const expect = { 3: 'locale source edit versus translation,', 4: 'related target unpublish,' };
  for (const [i, text] of Object.entries(expect)) if (e.clauses[i].text !== text) problems.push(`AC-277 c${i} is not "${text}"`);
  for (const c of ref.citations.filter((x) => x.verdict === 'KEEP')) addTo(e.clauses[c.clauseIndex], [c]);
  for (const m of ref.missedTests ?? []) addTo(e.clauses[m.clauseIndex], [m.citation]);
  log.push(`AC-277 ${ref.citations.filter((x) => x.verdict === 'KEEP').length} KEEP + ${(ref.missedTests ?? []).length} missed`);
}

/* ---- status ------------------------------------------------------------------------------------------------------- */
const changes = [];
for (const [criterion, e] of entryOf) {
  const prev = before.get(criterion);
  const cited = e.clauses.filter((c) => c.citations.length > 0).length;
  e.status = cited === e.clauses.length ? 'verified' : cited === 0 ? 'unverified' : 'partial';
  if (e.status === 'verified') e.limitation = '';
  const same = JSON.stringify(e.clauses) === JSON.stringify(prev.clauses);
  if (!same || prev.status !== e.status) changes.push(`${criterion.slice(6)} ${prev.status}->${e.status}`);
}
const all = fragments.flatMap((f) => f.entries);
const count = (s) => all.filter((x) => x.status === s).length;
const summary = { problems, totals: { verified: count('verified'), partial: count('partial'), unverified: count('unverified') }, changes, log };
console.log(JSON.stringify(summary, null, 1));
if (REPORT) writeFileSync(resolve(ROOT, REPORT), `${JSON.stringify(summary, null, 1)}\n`);
if (DRY || problems.length > 0) process.exit(problems.length > 0 ? 1 : 0);
for (const { path, name, entries } of fragments) {
  const file = resolve(ROOT, path);
  const old = readFileSync(file, 'utf8');
  writeFileSync(file, `${old.slice(0, old.indexOf(`export const ${name}`))}export const ${name}: readonly EvidenceLedgerEntry[] = ${JSON.stringify(entries, null, 2)};\n`);
}
execFileSync('pnpm', ['exec', 'prettier', '--write', ...FRAGMENTS], { cwd: ROOT, stdio: 'inherit' });
