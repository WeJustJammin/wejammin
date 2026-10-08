#!/usr/bin/env node
// Collect Phase 2 evidence receipts from machine-generated test output.
//
//   node scripts/evidence/collect-receipts.mjs \
//     --vitest report.json [--vitest more.json] \
//     --pgtap db-test.tap \
//     --playwright e2e-functional.json [--playwright e2e-s09-real.json] \
//     --races db-races.out \
//     [--slice NN] [--root DIR] [--out tests/contracts/phase-02-slice-NN-receipts.generated.jsonl]
//
// --slice NN (01..17, default 09) selects the default output file
//   tests/contracts/phase-02-slice-NN-receipts.generated.jsonl. Slice 09 (no --slice,
//   or --slice 09) builds receipts for criterion markers P2-S09-AC-NNN, unchanged.
//   Any other slice with a ledger (tests/contracts/phase-02-slice-NN-evidence-ledger.ts)
//   is collected by TEST IDENTITY: one receipt per executed test the ledger cites,
//   plus every non-passing or duplicated test of a cited file; markers in titles are
//   never read (identity-receipts-lib.mjs). --markers forces marker mode for a slice.
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

import { buildIdentityReceipts } from './identity-receipts-lib.mjs';
import { citationsOf, loadLedger } from './ledger-lib.mjs';
import {
  buildReceipts,
  markStale,
  mergeReports,
  normaliseSlice,
  parsePgtapTap,
  parsePlaywrightJson,
  parseRaceOutput,
  parseVitestJson,
  receiptsPathFor,
  serialiseReceipts,
} from './receipts-lib.mjs';

export const DEFAULT_OUT = receiptsPathFor('09');

const take = (args, flag) => {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag) values.push(args[index + 1]);
  }
  return values.filter((value) => value !== undefined);
};

/** The slice and the absolute output path a command line selects. */
export const parseCollectorArgs = (argv, cwd) => {
  const root = resolve(take(argv, '--root')[0] ?? cwd);
  const slice = normaliseSlice(take(argv, '--slice')[0] ?? '09');
  return {
    slice,
    out: resolve(root, take(argv, '--out')[0] ?? receiptsPathFor(slice)),
  };
};

/**
 * Parse every input into per-invocation result lists (stale results marked) and
 * collect input errors. `byIdentity` selects the Slice 10+ parsers (see
 * identity-receipts-lib.mjs); `slice` selects the markers of marker mode.
 */
export const readReports = ({
  root,
  vitest,
  pgtap,
  playwright,
  races,
  testDir,
  slice = '09',
  byIdentity = false,
}) => {
  const digits = normaliseSlice(slice);
  const reports = [];
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
    const parsed = parsePgtapTap(readFileSync(path, 'utf8'), root, {
      slice: digits,
      identity: byIdentity,
    });
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
    addResults(
      path,
      parseRaceOutput(readFileSync(path, 'utf8'), { identity: byIdentity }),
    );
  }
  return { reports, errors };
};

export const collect = (input) => {
  const { root, slice = '09', identity = null } = input;
  const digits = normaliseSlice(slice);
  const byIdentity = identity !== null;
  const { reports, errors } = readReports({ ...input, byIdentity });
  return {
    receipts: byIdentity
      ? buildIdentityReceipts(
          mergeReports(reports, []),
          root,
          identity.citations,
        )
      : buildReceipts(mergeReports(reports), root, digits),
    notes: [],
    errors,
  };
};

const main = async () => {
  const args = process.argv.slice(2);
  const root = resolve(take(args, '--root')[0] ?? process.cwd());
  let slice;
  let out;
  try {
    ({ slice, out } = parseCollectorArgs(args, process.cwd()));
  } catch (error) {
    console.error(`invalid arguments: ${error.message}`);
    process.exit(2);
  }
  // Slice 09 (and --markers) read criterion markers. Any other slice that has a
  // ledger is collected by test identity: only cited tests are receipted.
  let identity = null;
  if (slice !== '09' && !args.includes('--markers')) {
    try {
      const entries = await loadLedger(root, slice);
      if (entries !== null) identity = { citations: citationsOf(entries) };
    } catch (error) {
      console.error(`cannot read the Slice ${slice} ledger: ${error.message}`);
      process.exit(2);
    }
  }
  if (identity !== null && identity.citations.length === 0) {
    writeFileSync(out, '');
    console.log(`ledger cites no test; wrote 0 receipts to ${out}`);
    return;
  }
  let collected;
  try {
    collected = collect({
      slice,
      identity,
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
    console.error(
      identity === null
        ? `no receipt: the inputs carry no [P2-S${slice}-AC-NNN] test`
        : `no receipt: none of the ${String(identity.citations.length)} cited test(s) is in the inputs`,
    );
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

if (import.meta.url === `file://${process.argv[1]}`) await main();
