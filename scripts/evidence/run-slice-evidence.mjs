#!/usr/bin/env node
// Run every test a slice ledger cites, then write the slice's identity receipts.
//
//   node scripts/evidence/run-slice-evidence.mjs --slice 10 \
//     [--only vitest,pgtap,playwright,race] [--out-dir test-results/evidence] \
//     [--playwright-config playwright.config.ts]... [--dry-run] [--no-collect] \
//     [--root DIR] [--lock-file /tmp/wejammin-supabase-ci.lock] [--lock-wait 3600]
//
// What it does, in order:
//  1. loads tests/contracts/phase-02-slice-NN-evidence-ledger.ts and plans the runs
//     (run-plan-lib.mjs): vitest files per config, pgTAP entrypoints (via
//     infra/run-pgtap-verbose.mjs), Playwright specs, race runners;
//  2. runs the plain steps (vitest, functional Playwright);
//  3. runs the steps that need the shared local Supabase stack (pgTAP, vitest
//     api/db specs, real-route Playwright, race runners) in ONE child process that
//     holds the database lock (flock, same file as `pnpm db:ci` and the lane runner),
//     with a `pnpm db:reset` before each step and a closing one;
//  4. collects receipts with collect-receipts.mjs --slice NN into
//     tests/contracts/phase-02-slice-NN-receipts.generated.jsonl.
// A failing test run never stops the sequence: its output is what the receipts record.
// Exit 0 when every step passed and the receipts were written; 1 when a step failed or
// no cited test produced a receipt; 2 for a usage, ledger or planning problem; 3 when
// the database lock could not be taken. --dry-run prints the plan and runs nothing.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { citationsOf, loadLedger } from './ledger-lib.mjs';
import { executeSteps } from './run-execute-lib.mjs';
import {
  DEFAULT_OUT_DIR,
  DEFAULT_PLAYWRIGHT_CONFIGS,
  planEvidenceRuns,
} from './run-plan-lib.mjs';
import { normaliseSlice } from './receipts-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOCK_FILE =
  process.env.WEJAMMIN_SUPABASE_CI_LOCK ?? '/tmp/wejammin-supabase-ci.lock';
const LOCK_CONFLICT_EXIT = 99;
const TOOLS = ['vitest', 'pgtap', 'playwright', 'race'];

const take = (args, flag) => {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag) values.push(args[index + 1]);
  }
  return values.filter((value) => value !== undefined);
};

export const parseRunnerArgs = (argv, cwd) => {
  const slice = normaliseSlice(take(argv, '--slice')[0] ?? '');
  const only = take(argv, '--only')[0]?.split(',') ?? null;
  if (only !== null) {
    const unknown = only.filter((tool) => !TOOLS.includes(tool));
    if (unknown.length > 0) {
      throw new RangeError(
        `--only names unknown tool(s): ${unknown.join(', ')}`,
      );
    }
  }
  const lockWait = Number(take(argv, '--lock-wait')[0] ?? '3600');
  if (!Number.isInteger(lockWait) || lockWait < 0) {
    throw new RangeError('--lock-wait must be a whole number of seconds');
  }
  const configs = take(argv, '--playwright-config');
  return {
    slice,
    only,
    root: resolve(take(argv, '--root')[0] ?? cwd),
    outDir: take(argv, '--out-dir')[0] ?? DEFAULT_OUT_DIR,
    playwrightConfigs:
      configs.length > 0 ? configs : DEFAULT_PLAYWRIGHT_CONFIGS,
    dryRun: argv.includes('--dry-run'),
    collect: !argv.includes('--no-collect'),
    phase: take(argv, '--phase')[0] ?? 'all',
    lockFile: take(argv, '--lock-file')[0] ?? DEFAULT_LOCK_FILE,
    lockWait,
  };
};

const spawn = (command, args, options) => spawnSync(command, args, options);

const report = (outcomes) => {
  for (const { id, outcome, status, detail } of outcomes) {
    const tail = detail === undefined ? '' : ` (${detail})`;
    console.log(
      `${outcome.toUpperCase().padEnd(8)} ${id} exit=${String(status)}${tail}`,
    );
  }
  return outcomes.every(
    ({ outcome }) => outcome === 'passed' || outcome === 'no-tests',
  );
};

const main = async () => {
  const argv = process.argv.slice(2);
  let options;
  try {
    options = parseRunnerArgs(argv, process.cwd());
  } catch (error) {
    console.error(`invalid arguments: ${error.message}`);
    process.exit(2);
  }
  const { slice, root, outDir } = options;
  let entries;
  try {
    entries = await loadLedger(root, slice);
  } catch (error) {
    console.error(`cannot read the Slice ${slice} ledger: ${error.message}`);
    process.exit(2);
  }
  if (entries === null) {
    console.error(
      `Slice ${slice} has no evidence ledger (tests/contracts/phase-02-slice-${slice}-evidence-ledger.ts)`,
    );
    process.exit(2);
  }
  const plan = planEvidenceRuns({
    citations: citationsOf(entries),
    root,
    outDir,
    playwrightConfigs: options.playwrightConfigs,
    only: options.only,
  });
  if (plan.problems.length > 0) {
    for (const problem of plan.problems)
      console.error(`cannot plan: ${problem}`);
    process.exit(2);
  }
  if (options.dryRun) {
    console.log(
      JSON.stringify(
        {
          slice,
          finalReset: plan.finalReset,
          outputs: plan.outputs,
          steps: plan.steps,
        },
        null,
        2,
      ),
    );
    return;
  }
  const plain = plan.steps.filter((step) => !step.needsDatabase);
  const database = plan.steps.filter((step) => step.needsDatabase);

  if (options.phase === 'database') {
    const ok = report(
      executeSteps({
        steps: database,
        root,
        finalReset: plan.finalReset,
        spawn,
      }),
    );
    process.exit(ok ? 0 : 1);
  }

  let healthy = true;
  if (plain.length === 0 && database.length === 0) {
    console.log(
      `Slice ${slice} ledger cites no runnable test; writing empty receipts`,
    );
  }
  if (plain.length > 0) {
    healthy = report(
      executeSteps({ steps: plain, root, finalReset: false, spawn }),
    );
  }
  if (database.length > 0) {
    console.log(
      `taking the database lock ${options.lockFile} (waiting up to ${String(options.lockWait)} s)`,
    );
    const forwarded = argv.filter(
      (_, index) => argv[index] !== '--phase' && argv[index - 1] !== '--phase',
    );
    const child = spawnSync(
      'flock',
      [
        '--wait',
        String(options.lockWait),
        '-E',
        String(LOCK_CONFLICT_EXIT),
        options.lockFile,
        process.execPath,
        resolve(here, 'run-slice-evidence.mjs'),
        ...forwarded,
        '--phase',
        'database',
        '--no-collect',
      ],
      { cwd: root, stdio: 'inherit' },
    );
    if (child.error !== undefined) {
      console.error(`cannot run flock: ${child.error.message}`);
      process.exit(2);
    }
    if (child.status === LOCK_CONFLICT_EXIT) {
      console.error(
        `could not take the database lock within ${String(options.lockWait)} s`,
      );
      process.exit(3);
    }
    if (child.status !== 0) healthy = false;
  }
  if (!options.collect) process.exit(healthy ? 0 : 1);
  const inputs = [
    ...plan.outputs.vitest.map((path) => ['--vitest', path]),
    ...plan.outputs.pgtap.map((path) => ['--pgtap', path]),
    ...plan.outputs.playwright.map((path) => ['--playwright', path]),
    ...plan.outputs.races.map((path) => ['--races', path]),
  ].filter(([, path]) => existsSync(resolve(root, path)));
  const collected = spawnSync(
    process.execPath,
    [
      resolve(here, 'collect-receipts.mjs'),
      '--slice',
      slice,
      '--root',
      root,
      ...inputs.flat(),
    ],
    { cwd: root, stdio: 'inherit' },
  );
  process.exit(healthy && collected.status === 0 ? 0 : 1);
};

if (import.meta.url === `file://${process.argv[1]}`) await main();
