// In-memory run of the real ledger guard (evaluateLedger) over the new entries with receipts built from the
// real run's results (vitest JSON + verbose TAP), plus synthetic passing receipts for the tools no JSON
// covers (apispec/dbspec, Playwright, race). Description renames are applied to the pgTAP rows first.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  buildIdentityReceipts,
  closureSha256,
} from '../../../../scripts/evidence/identity-receipts-lib.mjs';
import { evaluateLedger } from '../../../../scripts/evidence/ledger-guard-lib.mjs';
import {
  acceptanceCriteriaCount,
  trackerCriteria,
} from '../../../../scripts/evidence/ledger-lib.mjs';
import { sha256OfFile } from '../../../../scripts/evidence/receipts-lib.mjs';

const isExternal = (c) =>
  c.tool === 'playwright' ||
  c.tool === 'race' ||
  /\.(?:apispec|dbspec)\.ts$/u.test(c.file);

/** Rows with the description renames applied (a rename names the nth occurrence of a literal in a file). */
export const renameRows = (rows, renames) => {
  const out = rows.map((row) => ({ ...row }));
  for (const rename of renames) {
    const seen = new Map(); // entrypoint -> occurrences met so far
    for (const row of out) {
      if (
        row.tool !== 'pgtap' ||
        row.file !== rename.file ||
        row.title !== rename.from
      )
        continue;
      const n = seen.get(row.entrypoint) ?? 0;
      seen.set(row.entrypoint, n + 1);
      if (n === (rename.nth ?? 0)) row.title = rename.to;
    }
  }
  // A literal held by two files of one entrypoint has ownerCount 2 (ambiguous); recompute it from the renamed rows.
  const owners = new Map();
  for (const row of out) {
    if (row.tool !== 'pgtap' || row.granularity === 'file') continue;
    const key = [row.entrypoint, row.title].join('\u0000');
    owners.set(key, new Set([...(owners.get(key) ?? []), row.file]));
  }
  for (const row of out) {
    if (row.tool !== 'pgtap' || row.granularity === 'file') continue;
    row.ownerCount = Math.max(
      1,
      owners.get([row.entrypoint, row.title].join('\u0000')).size,
    );
  }
  return out;
};

export const simulateGuard = ({ entries, rows, root, hashRoot }) => {
  const citations = new Map();
  for (const entry of entries)
    for (const clause of entry.clauses)
      for (const c of clause.citations)
        citations.set(
          [c.tool, c.file, c.title, c.project ?? ''].join('\u0000'),
          c,
        );
  const all = [...citations.values()];
  const vitest = buildIdentityReceipts(
    rows.filter((r) => r.tool === 'vitest'),
    root,
    all.filter((c) => c.tool === 'vitest'),
  );
  const pgtap = buildIdentityReceipts(
    rows.filter((r) => r.tool === 'pgtap'),
    hashRoot,
    all.filter((c) => c.tool === 'pgtap'),
  );
  const external = all.filter(isExternal).map((c) => ({
    tool: c.tool,
    granularity: c.tool === 'race' ? 'assertion' : 'test',
    file: c.file,
    title: c.title,
    ...(c.tool === 'playwright' ? { project: c.project ?? '' } : {}),
    status: 'passed',
    fileSha256: sha256OfFile(root, c.file),
  }));
  const receipts = [
    ...vitest.filter((r) => !isExternal(r)),
    ...pgtap,
    ...external,
  ];
  const tracker = readFileSync(
    resolve(root, '.memory/pipeline/progress/slices/phase-02-slice-12.md'),
    'utf8',
  );
  return evaluateLedger({
    entries,
    tracker: trackerCriteria(tracker, '12'),
    expectedCount: acceptanceCriteriaCount(tracker),
    receipts,
    fileSha: (file) =>
      sha256OfFile(file.startsWith('supabase/tests/') ? hashRoot : root, file),
    closureSha: (entrypoint) => closureSha256(hashRoot, entrypoint),
    slice: '12',
    contractOnly: null,
    maxSoleProof: 3,
    contractOnlyNeedsTrackerText: true,
  });
};
