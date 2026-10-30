#!/usr/bin/env node
// DEC-243 (root, owner may override): the designer context lists every registered, currently supported block — blocks are
// platform registry records owned by their release principal (Slice 09 ruling 20261002209000, P2-S09-AC-145). Amends AC-159's
// "128 owned registered" in the phase-2 tracker, the Slice 12 progress tracker and the ledger (criterion and clause text), and
// re-points the four `gaps_db1_template.sql` AC-159 titles lane block_owner corrected (review V18 MAJOR-1), adding the new
// platform-wide assertion. Run AFTER recite7/apply7.mjs.
//   node --experimental-strip-types docs/handoffs/2026-10-22-claude-s12/recite7/dec243-ac159.mjs [--dry]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = '/home/rob/.codex/worktrees/phase2-slice12/WeJammin';
const CRITERION = 'P2-S12-AC-159';
const OLD = 'at most 128 owned registered, currently supported block selectors (`blockKey`, `blockVersion`)';
const NEW = 'at most 128 registered, currently supported block selectors (`blockKey`, `blockVersion`) of the platform registry, whichever release registered them';
const TRACKERS = ['.memory/wiki/specs/phases/phase-2.md', '.memory/pipeline/progress/slices/phase-02-slice-12.md'];
const FRAGMENT = 'tests/contracts/phase-02-slice-12-evidence-ledger-143-213.ts';
const EXPORT = 'S12_EVIDENCE_LEDGER_143_213';
const FILE = 'supabase/tests/phase_02_slice_12_gaps_db1_template.sql';
const RETITLE = [
  ['129 owned supported candidates are cut at exactly 128 selectors [P2-S12-AC-159]',
    "130 supported candidates (129 of the caller's organization plus one of another owner) are cut at exactly 128 selectors [P2-S12-AC-159]"],
  ['the first selector is the lowest owned supported key: the deprecated, foreign and withdrawn blocks sort before it and are absent [P2-S12-AC-159]',
    "the first selector is the lowest supported key, another owner's gap.a001 (DEC-243): the deprecated gap.a000 and the withdrawn gap.a002 around it are absent [P2-S12-AC-159]"],
  ['the cut keeps the first 128 keys in C-collation order, dropping gap.b128 [P2-S12-AC-159]',
    'the cut keeps the first 128 keys in C-collation order (gap.a001, then gap.b000 to gap.b126), dropping gap.b127 and gap.b128 [P2-S12-AC-159]'],
  ["a deprecated block, a withdrawn block and another owner's block are not selectors [P2-S12-AC-159]",
    'a deprecated block, a withdrawn block and the two keys beyond the 128 cut are not selectors [P2-S12-AC-159]'],
];
const ADDED = "another owner's supported block is a selector: blocks are platform registry records, not tenant data (DEC-243, the Slice 09 platform-registry ruling) [P2-S12-AC-159]";

const problems = [];
const source = readFileSync(resolve(ROOT, FILE), 'utf8');
for (const [, now] of RETITLE) if (!source.includes(now.replace(/'/gu, "''"))) problems.push(`new title not in source: ${now.slice(0, 60)}`);
if (!source.includes(ADDED.replace(/'/gu, "''"))) problems.push('added title not in source');
const mod = await import(resolve(ROOT, FRAGMENT));
const entries = structuredClone(mod[EXPORT]);
const entry = entries.find((e) => e.criterion === CRITERION);
if (entry.text.split(OLD).length !== 2) problems.push('criterion text: old phrase not found once');
entry.text = entry.text.replace(OLD, NEW);
const clause = entry.clauses.find((c) => c.text.includes('128 owned registered'));
if (!clause) problems.push('block clause not found');
else clause.text = clause.text.replace('at most 128 owned registered, currently supported block selectors (`blockKey`, `blockVersion`)', 'at most 128 registered, currently supported block selectors (`blockKey`, `blockVersion`) of the platform registry, whichever release registered them');
let hits = 0;
for (const c of entry.clauses) c.citations = c.citations.map((x) => {
  const rule = RETITLE.find(([was]) => x.file === FILE && x.title === was);
  if (!rule) return x;
  hits += 1;
  return { ...x, title: rule[1] };
});
if (hits !== 4) problems.push(`expected 4 re-points, found ${hits}`);
if (clause && !clause.citations.some((x) => x.title === ADDED)) clause.citations.push({ tool: 'pgtap', file: FILE, title: ADDED });
console.log(JSON.stringify({ problems, hits, status: entry.status }));
if (process.argv.includes('--dry') || problems.length) process.exit(problems.length ? 1 : 0);
const file = resolve(ROOT, FRAGMENT);
const old = readFileSync(file, 'utf8');
writeFileSync(file, `${old.slice(0, old.indexOf(`export const ${EXPORT}`))}export const ${EXPORT}: readonly EvidenceLedgerEntry[] = ${JSON.stringify(entries, null, 2)};\n`);
for (const tracker of TRACKERS) {
  const s = readFileSync(resolve(ROOT, tracker), 'utf8');
  const line = s.split('\n').find((l) => l.includes(`**${CRITERION}**`) && l.includes(OLD));
  if (!line) throw new Error(`${tracker}: AC-159 text not found`);
  writeFileSync(resolve(ROOT, tracker), s.replace(line, line.replace(OLD, NEW)));
}
execFileSync('pnpm', ['exec', 'prettier', '--write', FRAGMENT], { cwd: ROOT, stdio: 'inherit' });
