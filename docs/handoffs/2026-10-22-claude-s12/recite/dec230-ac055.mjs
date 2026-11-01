#!/usr/bin/env node
// DEC-230 (owner decision, 2026-10-27): on the CMS-03C-04 write a locale outside the active content-type version's
// supportedLocales is 422 LOCALE_VALIDATION_FAILED, not the 404 of a hidden entry. Amends AC-055 in the phase-2 tracker,
// the Slice 12 progress tracker and the ledger (text, clauses, citations, limitation) and the BE03c Route Registry row.
// Run AFTER recite/apply.mjs and recite/dec227-texts.mjs.
//   node --experimental-strip-types docs/handoffs/2026-10-22-claude-s12/recite/dec230-ac055.mjs [--dry]

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = '/home/rob/.codex/worktrees/phase2-slice12/WeJammin';
const DRY = process.argv.includes('--dry');
const CRITERION = 'P2-S12-AC-055';
const OLD = 'a hidden or absent entry, locale or source revision is 404 `LOCALE_SOURCE_NOT_FOUND`';
const NEW =
  'a hidden or absent entry or source revision is 404 `LOCALE_SOURCE_NOT_FOUND`, a locale outside the active content-type version\'s `supportedLocales` is 422 `LOCALE_VALIDATION_FAILED`';
const TRACKERS = [
  '.memory/wiki/specs/phases/phase-2.md',
  '.memory/pipeline/progress/slices/phase-02-slice-12.md',
];
const FRAGMENT = 'tests/contracts/phase-02-slice-12-evidence-ledger-001-071.ts';
const EXPORT = 'S12_EVIDENCE_LEDGER_001_071';
const BE03C = '.memory/wiki/specs/be/03c-composition-taxonomy-localization.md';
const BE03C_OLD = 'hidden entry/locale is 404; visible entry without edit is 403';
const BE03C_NEW =
  "hidden entry or source revision is 404; a locale outside the active version's `supportedLocales` is 422 (DEC-230); visible entry without edit is 403";

const UNSUPPORTED_CITATIONS = [
  {
    tool: 'pgtap',
    file: 'supabase/tests/phase_02_slice_12_locale_config_enforcement.sql',
    title: "a locale outside the active version's supportedLocales is a validation failure (422)",
  },
  {
    tool: 'vitest',
    file: 'apps/worker/src/cms-composition-production-locale-unsupported.test.ts',
    title:
      'CMS-03C-04 unsupported locale on the write [P2-S12-AC-055] maps the bare database VALIDATION_FAILED of a locale outside supportedLocales to 422 LOCALE_VALIDATION_FAILED, not a 404',
  },
];

const problems = [];
const mod = await import(resolve(ROOT, FRAGMENT));
const entries = structuredClone(mod[EXPORT]);
const entry = entries.find((e) => e.criterion === CRITERION);
if (entry.text.split(OLD).length !== 2) problems.push('criterion text: old phrase not found once');
entry.text = entry.text.replace(OLD, NEW);
const at = (t) => entry.clauses.findIndex((c) => c.text === t);
const iEntry = at('a hidden or absent entry');
const iLocale = at('locale');
const iSource = at('source revision is 404 `LOCALE_SOURCE_NOT_FOUND`');
if (iEntry < 0 || iLocale !== iEntry + 1 || iSource !== iLocale + 1) problems.push(`clause indexes ${iEntry}/${iLocale}/${iSource}`);
else {
  entry.clauses.splice(iEntry, 3,
    entry.clauses[iEntry],
    { text: 'source revision is 404 `LOCALE_SOURCE_NOT_FOUND`', citations: entry.clauses[iSource].citations },
    { text: "a locale outside the active content-type version's `supportedLocales` is 422 `LOCALE_VALIDATION_FAILED`", citations: UNSUPPORTED_CITATIONS },
  );
}
// The limitation named the old "locale" clause as a spec/code mismatch; DEC-230 resolves it.
const seg = /"locale": missing test or spec reconciliation:[\s\S]*?before a test can pass\. ?/u;
if (!seg.test(entry.limitation)) problems.push('limitation: locale segment not found');
entry.limitation = entry.limitation.replace(seg, '');
const cited = entry.clauses.filter((c) => c.citations.length > 0).length;
entry.status = cited === entry.clauses.length ? 'verified' : cited === 0 ? 'unverified' : 'partial';
if (entry.status === 'verified') entry.limitation = '';
console.log(JSON.stringify({ problems, status: entry.status, clauses: entry.clauses.map((c) => c.citations.length) }));
if (DRY || problems.length > 0) process.exit(problems.length > 0 ? 1 : 0);

const file = resolve(ROOT, FRAGMENT);
const old = readFileSync(file, 'utf8');
writeFileSync(file, `${old.slice(0, old.indexOf(`export const ${EXPORT}`))}export const ${EXPORT}: readonly EvidenceLedgerEntry[] = ${JSON.stringify(entries, null, 2)};\n`);
for (const tracker of TRACKERS) {
  const s = readFileSync(resolve(ROOT, tracker), 'utf8');
  const line = s.split('\n').find((l) => l.includes(`**${CRITERION}**`) && l.includes(OLD));
  if (!line) throw new Error(`${tracker}: AC-055 old text not found`);
  writeFileSync(resolve(ROOT, tracker), s.replace(line, line.replace(OLD, NEW)));
}
const be = readFileSync(resolve(ROOT, BE03C), 'utf8');
if (be.split(BE03C_OLD).length !== 2) throw new Error('BE03c route registry phrase not found once');
writeFileSync(resolve(ROOT, BE03C), be.replace(BE03C_OLD, BE03C_NEW));
execFileSync(resolve(ROOT, 'node_modules/.bin/prettier'), ['--write', FRAGMENT], { cwd: ROOT, stdio: 'inherit' });
console.log('written');
