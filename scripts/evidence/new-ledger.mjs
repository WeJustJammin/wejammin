#!/usr/bin/env node
// Print the all-unverified evidence ledger skeleton of a Phase 2 slice, taken from
// its tracker, so every criterion text is copied byte for byte and never retyped.
//
//   node scripts/evidence/new-ledger.mjs --slice 10 [--tracker PATH] [--clauses] \
//     > tests/contracts/phase-02-slice-10-evidence-ledger.ts
//   pnpm exec prettier --write tests/contracts/phase-02-slice-10-evidence-ledger.ts
//
// --clauses lists proposed (uncited) clauses per criterion instead of an empty
// list; they are verbatim parts of the claim and tile it, so an author only has to
// add citations (and may merge or re-split clauses by hand).
// Exit 2 on an unreadable tracker or an invalid slice.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  ledgerExportName,
  proposeClauses,
  trackerCriteria,
} from './ledger-lib.mjs';
import { normaliseSlice } from './receipts-lib.mjs';

const take = (args, flag) => {
  const at = args.indexOf(flag);
  return at === -1 ? undefined : args[at + 1];
};

/** A single-quoted TypeScript string literal. */
const quote = (text) =>
  `'${text.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\n', '\\n')}'`;

export const skeleton = ({ slice, criteria, trackerPath, withClauses }) => {
  const digits = normaliseSlice(slice);
  const lines = [
    "import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';",
    '',
    `// Slice ${digits} evidence ledger: per criterion, which exact tests prove which clause.`,
    `// Skeleton generated from ${trackerPath} by scripts/evidence/new-ledger.mjs --slice ${digits};`,
    '// `text` is the tracker claim byte for byte and must never be reworded. A citation names ONE',
    '// test (tool, file, full title; Playwright also project). Fill an entry by listing clauses',
    '// (verbatim parts of text that tile it) with citations, then set status and limitation;',
    `// the guard (tests/contracts/phase-02-slice-${digits}-evidence-guard.test.ts) checks every rule.`,
    `export const ${ledgerExportName(digits)}: readonly EvidenceLedgerEntry[] = [`,
  ];
  for (const { criterion, claim } of criteria) {
    lines.push(
      '  {',
      `    criterion: ${quote(criterion)},`,
      `    text: ${quote(claim)},`,
    );
    const clauses = withClauses ? proposeClauses(claim) : [];
    if (clauses.length === 0) lines.push('    clauses: [],');
    else {
      lines.push('    clauses: [');
      for (const clause of clauses) {
        lines.push(`      { text: ${quote(clause)}, citations: [] },`);
      }
      lines.push('    ],');
    }
    lines.push(
      "    status: 'unverified',",
      "    limitation: 'No test is cited for this criterion yet.',",
      '  },',
    );
  }
  lines.push('];', '');
  return lines.join('\n');
};

const main = () => {
  const args = process.argv.slice(2);
  let slice;
  try {
    slice = normaliseSlice(take(args, '--slice') ?? '');
  } catch (error) {
    console.error(`invalid arguments: ${error.message}`);
    process.exit(2);
  }
  const trackerPath =
    take(args, '--tracker') ??
    `.memory/pipeline/progress/slices/phase-02-slice-${slice}.md`;
  let markdown;
  try {
    markdown = readFileSync(resolve(process.cwd(), trackerPath), 'utf8');
  } catch (error) {
    console.error(`cannot read tracker: ${error.message}`);
    process.exit(2);
  }
  process.stdout.write(
    skeleton({
      slice,
      criteria: trackerCriteria(markdown, slice),
      trackerPath,
      withClauses: args.includes('--clauses'),
    }),
  );
};

if (import.meta.url === `file://${process.argv[1]}`) main();
