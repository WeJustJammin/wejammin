#!/usr/bin/env node
// DEC-231 (root decision, owner may override, 2026-10-27; spec-questions Q10): 03c consumes no
// `cms.publication.changed.v1`. Related-content eligibility is evaluated at read (CMS-03C-21), locale staleness is recorded
// in the source transaction and composition validity follows the governed recheck consumers, so a publication needs no
// invalidation. Amends AC-061 (both trackers + ledger clause 9 with the read-time recompute citations) and the BE03c event
// table row. Run AFTER recite/apply.mjs, dec227-texts.mjs and dec230-ac055.mjs.
//   node --experimental-strip-types docs/handoffs/2026-10-22-claude-s12/recite/dec231-ac061.mjs [--dry]

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = '/home/rob/.codex/worktrees/phase2-slice12/WeJammin';
const DRY = process.argv.includes('--dry');
const CRITERION = 'P2-S12-AC-061';
const OLD = '(it consumes `cms.publication.changed.v1` for invalidation).';
const NEW =
  '(related eligibility is evaluated at read, so a publication needs no invalidation and 03c consumes no `cms.publication.changed.v1`).';
const TRACKERS = [
  '.memory/wiki/specs/phases/phase-2.md',
  '.memory/pipeline/progress/slices/phase-02-slice-12.md',
];
const FRAGMENT = 'tests/contracts/phase-02-slice-12-evidence-ledger-001-071.ts';
const EXPORT = 'S12_EVIDENCE_LEDGER_001_071';
const BE03C = '.memory/wiki/specs/be/03c-composition-taxonomy-localization.md';
const BE03C_OLD =
  '03b is producer; 03c consumes the event to invalidate related/locale/composition eligibility. It never emits a duplicate publication event.';
const BE03C_NEW =
  '03b is producer; 03c needs no consumer (DEC-231): related eligibility is evaluated at read (CMS-03C-21), locale staleness is recorded in the source-change transaction and composition validity follows the governed recheck consumers. It never emits a duplicate publication event.';
const RG = 'supabase/tests/phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc';
const CITATIONS = [
  { tool: 'pgtap', file: RG, title: 'an unpublished entry (tombstone head) disappears [P2-S12-AC-157]' },
  { tool: 'pgtap', file: RG, title: 'a pinned entry published after the pin appears at its pin position: nothing was stored at write time [P2-S12-AC-156]' },
];

const problems = [];
const mod = await import(resolve(ROOT, FRAGMENT));
const entries = structuredClone(mod[EXPORT]);
const entry = entries.find((e) => e.criterion === CRITERION);
if (entry.text.split(OLD).length !== 2) problems.push('criterion text: old phrase not found once');
entry.text = entry.text.replace(OLD, NEW);
const i = entry.clauses.findIndex((c) => c.text === OLD);
if (i < 0) problems.push('clause not found');
else entry.clauses[i] = { text: NEW, citations: CITATIONS };
const seg = /"\(it consumes `cms\.publication\.changed\.v1` for invalidation\)\.":[\s\S]*?(?=(?:"[^"]+":|Further limits|$))/u;
if (seg.test(entry.limitation)) entry.limitation = entry.limitation.replace(seg, '').trim();
else problems.push('limitation: clause segment not found');
const cited = entry.clauses.filter((c) => c.citations.length > 0).length;
entry.status = cited === entry.clauses.length ? 'verified' : cited === 0 ? 'unverified' : 'partial';
if (entry.status === 'verified') entry.limitation = '';
console.log(JSON.stringify({ problems, status: entry.status, limitation: entry.limitation.slice(0, 200) }));
if (DRY || problems.length > 0) process.exit(problems.length > 0 ? 1 : 0);

const file = resolve(ROOT, FRAGMENT);
const old = readFileSync(file, 'utf8');
writeFileSync(file, `${old.slice(0, old.indexOf(`export const ${EXPORT}`))}export const ${EXPORT}: readonly EvidenceLedgerEntry[] = ${JSON.stringify(entries, null, 2)};\n`);
for (const tracker of TRACKERS) {
  const s = readFileSync(resolve(ROOT, tracker), 'utf8');
  const line = s.split('\n').find((l) => l.includes(`**${CRITERION}**`) && l.includes(OLD));
  if (!line) throw new Error(`${tracker}: AC-061 old text not found`);
  writeFileSync(resolve(ROOT, tracker), s.replace(line, line.replace(OLD, NEW)));
}
const be = readFileSync(resolve(ROOT, BE03C), 'utf8');
if (be.split(BE03C_OLD).length !== 2) throw new Error('BE03c event row phrase not found once');
writeFileSync(resolve(ROOT, BE03C), be.replace(BE03C_OLD, BE03C_NEW));
execFileSync(resolve(ROOT, 'node_modules/.bin/prettier'), ['--write', FRAGMENT], { cwd: ROOT, stdio: 'inherit' });
console.log('written');
