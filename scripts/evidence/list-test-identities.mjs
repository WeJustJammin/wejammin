#!/usr/bin/env node
// List the exact identity of every test in machine-generated test output, so a
// ledger citation is copied, never typed (a mistyped title has no receipt).
//
//   node scripts/evidence/list-test-identities.mjs \
//     [--vitest report.json]... [--pgtap verbose.tap] [--playwright report.json]... [--races db-races.out] \
//     [--file SUBSTRING] [--status passed|failed|skipped|flaky|stale] [--citations] [--root DIR]
//
// One tab-separated line per executed test: tool, status, file, project, title.
// --citations prints each as a ledger citation literal instead. For pgTAP the file is
// the one that holds the description, which is often an included .sqlinc, not the
// entrypoint pg_prove ran. Exit 1 when no input is given, 2 on an unreadable input,
// 3 when a pgTAP file has no assertion-level TAP.

import { resolve } from 'node:path';

import { readReports } from './collect-receipts.mjs';
import { mergeReports } from './receipts-lib.mjs';

const take = (args, flag) => {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag) values.push(args[index + 1]);
  }
  return values.filter((value) => value !== undefined);
};

/** A single-quoted TypeScript string literal. */
const quote = (text) =>
  `'${text.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\n', '\\n')}'`;

export const citationLiteral = (result) =>
  `{ tool: ${quote(result.tool)}, file: ${quote(result.file)}, title: ${quote(result.title)}${
    result.tool === 'playwright'
      ? `, project: ${quote(result.project ?? '')}`
      : ''
  } },`;

const main = () => {
  const args = process.argv.slice(2);
  const input = {
    root: resolve(take(args, '--root')[0] ?? process.cwd()),
    vitest: take(args, '--vitest'),
    pgtap: take(args, '--pgtap'),
    playwright: take(args, '--playwright'),
    races: take(args, '--races'),
    testDir: take(args, '--playwright-test-dir')[0] ?? 'tests/e2e',
    byIdentity: true,
  };
  if (
    input.vitest.length +
      input.pgtap.length +
      input.playwright.length +
      input.races.length ===
    0
  ) {
    console.error('no input: pass --vitest, --pgtap, --playwright or --races');
    process.exit(1);
  }
  let read;
  try {
    read = readReports(input);
  } catch (error) {
    console.error(`cannot read evidence input: ${error.message}`);
    process.exit(2);
  }
  if (read.errors.length > 0) {
    for (const error of read.errors) console.error(`error: ${error}`);
    process.exit(3);
  }
  const file = take(args, '--file')[0] ?? '';
  const status = take(args, '--status')[0];
  const rows = mergeReports(read.reports, [])
    .filter((row) => row.granularity !== 'file')
    .filter((row) => row.file.includes(file))
    .filter((row) => status === undefined || row.status === status)
    .sort((a, b) =>
      [a.tool, a.file, a.title, a.project ?? ''].join('\u0000') <
      [b.tool, b.file, b.title, b.project ?? ''].join('\u0000')
        ? -1
        : 1,
    );
  for (const row of rows) {
    console.log(
      args.includes('--citations')
        ? citationLiteral(row)
        : [row.tool, row.status, row.file, row.project ?? '', row.title].join(
            '\t',
          ),
    );
  }
};

if (import.meta.url === `file://${process.argv[1]}`) main();
