#!/usr/bin/env node
// DEC-232b (root, 2026-10-27): `nestable` joins the reserved pattern keys because `GET /api/v1/cms/patterns/nestable` shares
// the `/patterns/{patternKey}` path space; AC-172 lists the reserved keys, so it gains `nestable`. Amends the criterion text in the phase-2 tracker, the Slice 12
// progress tracker and the ledger (criterion text and the clause holding the phrase; citations unchanged).
// Run AFTER recite/apply.mjs, dec227-texts.mjs, dec230-ac055.mjs, dec231-ac061.mjs and dec232-ac105-ac275.mjs.
//   node --experimental-strip-types docs/handoffs/2026-10-22-claude-s12/recite/dec232b-ac172.mjs [--dry]

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = '/home/rob/.codex/worktrees/phase2-slice12/WeJammin';
const DRY = process.argv.includes('--dry');
const TRACKERS = [
  '.memory/wiki/specs/phases/phase-2.md',
  '.memory/pipeline/progress/slices/phase-02-slice-12.md',
];
const EDITS = [
  {
    criterion: 'P2-S12-AC-172',
    fragment: '143-213',
    exportName: 'S12_EVIDENCE_LEDGER_143_213',
    old: 'is not a reserved key (`context`, `versions`, `selector`, `new`)',
    new: 'is not a reserved key (`context`, `versions`, `selector`, `nestable`, `new`)',
  },
];
const fragmentPath = (name) => `tests/contracts/phase-02-slice-12-evidence-ledger-${name}.ts`;

const problems = [];
const touched = new Map();
for (const edit of EDITS) {
  if (!touched.has(edit.fragment)) {
    const mod = await import(resolve(ROOT, fragmentPath(edit.fragment)));
    touched.set(edit.fragment, { exportName: edit.exportName, entries: structuredClone(mod[edit.exportName]) });
  }
  const { entries } = touched.get(edit.fragment);
  const entry = entries.find((e) => e.criterion === edit.criterion);
  if (entry.text.split(edit.old).length !== 2) { problems.push(`${edit.criterion}: text phrase not found once`); continue; }
  entry.text = entry.text.replace(edit.old, edit.new);
  const clause = entry.clauses.find((c) => c.text.includes(edit.old));
  if (!clause) { problems.push(`${edit.criterion}: no clause holds the phrase`); continue; }
  clause.text = clause.text.replace(edit.old, edit.new);
  // Limitations quote clause text: keep them in step.
  entry.limitation = entry.limitation.split(edit.old).join(edit.new);
}
console.log(JSON.stringify({ problems }));
if (DRY || problems.length > 0) process.exit(problems.length > 0 ? 1 : 0);

const written = [];
for (const [name, { exportName, entries }] of touched) {
  const file = resolve(ROOT, fragmentPath(name));
  const old = readFileSync(file, 'utf8');
  writeFileSync(file, `${old.slice(0, old.indexOf(`export const ${exportName}`))}export const ${exportName}: readonly EvidenceLedgerEntry[] = ${JSON.stringify(entries, null, 2)};\n`);
  written.push(fragmentPath(name));
}
for (const tracker of TRACKERS) {
  let s = readFileSync(resolve(ROOT, tracker), 'utf8');
  for (const edit of EDITS) {
    const line = s.split('\n').find((l) => l.includes(`**${edit.criterion}**`) && l.includes(edit.old));
    if (!line) throw new Error(`${tracker}: ${edit.criterion} old text not found`);
    s = s.replace(line, line.replace(edit.old, edit.new));
  }
  writeFileSync(resolve(ROOT, tracker), s);
}
execFileSync(resolve(ROOT, 'node_modules/.bin/prettier'), ['--write', ...written], { cwd: ROOT, stdio: 'inherit' });
console.log('written');
