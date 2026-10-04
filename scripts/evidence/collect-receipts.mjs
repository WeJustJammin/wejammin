#!/usr/bin/env node
// Collect Slice 09 evidence receipts from machine-generated test output.
//
//   node scripts/evidence/collect-receipts.mjs \
//     --vitest report.json [--vitest more.json] \
//     --pgtap db-test.tap \
//     --playwright e2e-functional.json [--playwright e2e-s09-real.json] \
//     --races db-races.out \
//     [--root DIR] [--out tests/contracts/phase-02-slice-09-receipts.generated.jsonl]
//
// vitest: `vitest run --reporter=json --outputFile=report.json <files>`; also pass the dedicated
//   gate report test-results/vitest-evidence-s09.json (`pnpm test:evidence:s09`): the AC-269
//   live execution is skipped in every other run and is receipted only from that one. The
//   merge recognises that gate by its report file NAME (vitest-evidence-s09.json, the
//   SKIP_REPLACEMENTS allowlist in receipts-lib.mjs); a skip is never dropped against any
//   other report, and Playwright skips (any project or config) are never merged away.
// pgtap: verbose pg_prove TAP (`pnpm db:test:tap`) gives one receipt per assertion.
//   The non-verbose `supabase test db` output carries only a file verdict, which is
//   not criterion evidence: it yields no receipt and the run exits 3 (see
//   receipts-lib.mjs for the plan, SKIP and TODO rules).
// playwright: the JSON reporter output of each config.
// races: `pnpm db:races` output (or its --jsonl lines).
// A result whose test file was modified after its report was written is written
// with status `stale` (it fails the guard) instead of a hash that would vouch for
// a run that never saw the file.
// Exit 1 when no input yields a receipt; exit 2 on unreadable input; exit 3 when a
// pgTAP file has no assertion-level TAP.

import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import {
  buildReceipts,
  markStale,
  mergeReports,
  parsePgtapTap,
  parsePlaywrightJson,
  parseRaceOutput,
  parseVitestJson,
  serialiseReceipts,
} from './receipts-lib.mjs';

export const DEFAULT_OUT =
  'tests/contracts/phase-02-slice-09-receipts.generated.jsonl';

const take = (args, flag) => {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag) values.push(args[index + 1]);
  }
  return values.filter((value) => value !== undefined);
};

export const collect = ({
  root,
  vitest,
  pgtap,
  playwright,
  races,
  testDir,
}) => {
  const reports = [];
  const notes = [];
  const errors = [];
  const addResults = (path, parsed) =>
    reports.push(markStale(parsed, root, statSync(path).mtimeMs));
  for (const path of vitest) {
    addResults(
      path,
      parseVitestJson(
        JSON.parse(readFileSync(path, 'utf8')),
        root,
        basename(path),
      ),
    );
  }
  for (const path of pgtap) {
    const parsed = parsePgtapTap(readFileSync(path, 'utf8'), root);
    addResults(path, parsed.results);
    for (const file of parsed.unverified) {
      errors.push(
        `${path}: ${file} has no assertion-level TAP, so it yields no receipt; capture verbose TAP with \`pnpm db:test:tap\``,
      );
    }
  }
  for (const path of playwright) {
    addResults(
      path,
      parsePlaywrightJson(
        JSON.parse(readFileSync(path, 'utf8')),
        testDir,
        basename(path),
      ),
    );
  }
  for (const path of races) {
    addResults(path, parseRaceOutput(readFileSync(path, 'utf8')));
  }
  return {
    receipts: buildReceipts(mergeReports(reports), root),
    notes,
    errors,
  };
};

const main = () => {
  const args = process.argv.slice(2);
  const root = resolve(take(args, '--root')[0] ?? process.cwd());
  const out = resolve(root, take(args, '--out')[0] ?? DEFAULT_OUT);
  let collected;
  try {
    collected = collect({
      root,
      vitest: take(args, '--vitest'),
      pgtap: take(args, '--pgtap'),
      playwright: take(args, '--playwright'),
      races: take(args, '--races'),
      testDir: take(args, '--playwright-test-dir')[0] ?? 'tests/e2e',
    });
  } catch (error) {
    console.error(`cannot read evidence input: ${error.message}`);
    process.exit(2);
  }
  if (collected.errors.length > 0) {
    for (const error of collected.errors) console.error(`error: ${error}`);
    console.error(
      'no receipt file written: pgTAP input without assertion-level TAP is not criterion evidence',
    );
    process.exit(3);
  }
  if (collected.receipts.length === 0) {
    console.error('no receipt: the inputs carry no [P2-S09-AC-NNN] test');
    process.exit(1);
  }
  writeFileSync(out, serialiseReceipts(collected.receipts));
  for (const note of collected.notes) console.error(`note: ${note}`);
  const stale = collected.receipts.filter((r) => r.status === 'stale');
  if (stale.length > 0) {
    console.error(
      `warning: ${stale.length} receipt(s) are stale (test file edited after its report was written); re-run those tests, they fail the receipts guard`,
    );
  }
  const byTool = {};
  for (const receipt of collected.receipts) {
    byTool[receipt.tool] = (byTool[receipt.tool] ?? 0) + 1;
  }
  console.log(
    `wrote ${collected.receipts.length} receipts to ${out} ${JSON.stringify(byTool)}`,
  );
};

if (import.meta.url === `file://${process.argv[1]}`) main();
