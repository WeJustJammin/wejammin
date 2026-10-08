// What `run-slice-evidence.mjs` executes for a ledger: the pure plan. Given the
// citations of a slice ledger it decides which test files each tool must run, with
// which command, whether the step needs the shared local database, and where its
// machine output goes. No process is started here.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { posix, resolve } from 'node:path';

import { pgtapClosure } from './receipts-lib.mjs';

export const DEFAULT_OUT_DIR = 'test-results/evidence';

/**
 * Playwright configs a cited spec is offered to. A config whose testMatch or
 * testIgnore does not select the spec finds no test for it ("No tests found"), which
 * is not a failure. `playwright.s09-hosted.config.ts` is deliberately absent: it
 * targets protected staging. A config whose name contains "real" drives the
 * production-built real-route servers against the local database.
 */
export const DEFAULT_PLAYWRIGHT_CONFIGS = Object.freeze([
  'playwright.config.ts',
  'playwright.s09-real.config.ts',
]);

const VITEST_KINDS = Object.freeze([
  {
    id: 'vitest',
    pattern: /\.test\.tsx?$/u,
    config: 'vitest.config.ts',
    needsDatabase: false,
  },
  {
    id: 'vitest-postgrest',
    pattern: /\.apispec\.ts$/u,
    config: 'vitest.postgrest.config.ts',
    needsDatabase: true,
  },
  {
    id: 'vitest-db-integration',
    pattern: /\.dbspec\.ts$/u,
    config: 'vitest.db-integration.config.ts',
    needsDatabase: true,
  },
]);

const PGTAP_ROOT = 'supabase/tests';

const sorted = (set) => [...set].sort();

const sqlFilesUnder = (root, directory) => {
  const found = [];
  const visit = (relative) => {
    const absolute = resolve(root, relative);
    if (!existsSync(absolute)) return;
    for (const name of readdirSync(absolute).sort()) {
      const child = posix.join(relative, name);
      if (statSync(resolve(root, child)).isDirectory()) visit(child);
      else if (name.endsWith('.sql')) found.push(child);
    }
  };
  visit(directory);
  return found;
};

/**
 * The pgTAP files pg_prove must run to execute `file`: the file itself when it is
 * a .sql entrypoint, every .sql whose include closure holds it when it is a
 * .sqlinc, and none when no .sql includes it.
 */
export const entrypointsFor = (root, file) => {
  if (file.endsWith('.sql'))
    return existsSync(resolve(root, file)) ? [file] : [];
  return sqlFilesUnder(root, PGTAP_ROOT).filter((entrypoint) =>
    pgtapClosure(root, entrypoint).includes(file),
  );
};

const playwrightOutput = (outDir, config) =>
  `${outDir}/playwright-${posix.basename(config).replace(/\.ts$/u, '')}.json`;

/**
 * @param {object} input
 * @param {readonly {tool: string, file: string}[]} input.citations
 * @param {string} input.root
 * @param {string} [input.outDir] repository-relative directory for reports and logs
 * @param {readonly string[]} [input.playwrightConfigs]
 * @param {readonly string[] | null} [input.only] restrict to these tools
 */
export const planEvidenceRuns = ({
  citations,
  root,
  outDir = DEFAULT_OUT_DIR,
  playwrightConfigs = DEFAULT_PLAYWRIGHT_CONFIGS,
  only = null,
}) => {
  const problems = [];
  const vitest = new Map(VITEST_KINDS.map((kind) => [kind.id, new Set()]));
  const entrypoints = new Set();
  const specs = new Set();
  const races = new Set();
  for (const { tool, file } of citations) {
    if (only !== null && !only.includes(tool)) continue;
    const label = `${tool} ${file}`;
    if (tool === 'vitest') {
      const kind = VITEST_KINDS.find((candidate) =>
        candidate.pattern.test(file),
      );
      if (kind === undefined)
        problems.push(`${label}: no vitest config runs this kind of file`);
      else vitest.get(kind.id).add(file);
    } else if (tool === 'pgtap') {
      if (!file.startsWith(`${PGTAP_ROOT}/`)) {
        problems.push(`${label}: a pgTAP file must be under ${PGTAP_ROOT}/`);
      } else if (file.endsWith('.sql') && !existsSync(resolve(root, file))) {
        problems.push(`${label}: file does not exist`);
      } else {
        const found = entrypointsFor(root, file);
        if (found.length === 0) {
          problems.push(
            `${label}: no ${PGTAP_ROOT}/**/*.sql includes this file, so no entrypoint can run it`,
          );
        }
        for (const entrypoint of found) entrypoints.add(entrypoint);
      }
    } else if (tool === 'playwright') {
      specs.add(file);
    } else if (tool === 'race') {
      if (file.endsWith('.mjs') && file.startsWith(`${PGTAP_ROOT}/`))
        races.add(file);
      else
        problems.push(
          `${label}: a race runner must be a .mjs under ${PGTAP_ROOT}/`,
        );
    } else {
      problems.push(`${label}: unknown tool`);
    }
  }

  const steps = [];
  const outputs = { vitest: [], playwright: [], pgtap: [], races: [] };
  const add = (step) =>
    steps.push({ env: {}, resetBefore: step.needsDatabase, ...step });
  for (const kind of VITEST_KINDS) {
    const files = sorted(vitest.get(kind.id));
    if (files.length === 0) continue;
    const output = `${outDir}/${kind.id}.json`;
    outputs.vitest.push(output);
    add({
      id: kind.id,
      tool: 'vitest',
      label: `vitest ${kind.config} (${String(files.length)} file(s))`,
      command: 'pnpm',
      args: [
        'exec',
        'vitest',
        'run',
        '--config',
        kind.config,
        ...files,
        '--reporter=json',
        `--outputFile=${output}`,
        '--retry=0',
      ],
      needsDatabase: kind.needsDatabase,
      outputKind: 'vitest',
      output,
    });
  }
  if (specs.size > 0) {
    for (const config of playwrightConfigs) {
      const output = playwrightOutput(outDir, config);
      outputs.playwright.push(output);
      add({
        id: `playwright:${config}`,
        tool: 'playwright',
        label: `playwright ${config} (${String(specs.size)} spec(s))`,
        command: 'pnpm',
        args: [
          'exec',
          'playwright',
          'test',
          `--config=${config}`,
          '--reporter=json',
          '--retries=0',
          '--forbid-only',
          // Playwright empties its output directory before every run; give each
          // config its own so earlier step reports in outDir survive.
          `--output=${outDir}/playwright-artifacts-${posix.basename(config).replace(/\.ts$/u, '')}`,
          // A config that selects none of the cited specs is not a failure.
          '--pass-with-no-tests',
          ...sorted(specs),
        ],
        env: { PLAYWRIGHT_JSON_OUTPUT_NAME: output },
        needsDatabase: /real/u.test(posix.basename(config)),
        outputKind: 'playwright',
        output,
      });
    }
  }
  if (entrypoints.size > 0) {
    const output = `${outDir}/pgtap.tap`;
    outputs.pgtap.push(output);
    add({
      id: 'pgtap',
      tool: 'pgtap',
      label: `pg_prove -v (${String(entrypoints.size)} entrypoint(s))`,
      command: process.execPath,
      args: [
        'infra/run-pgtap-verbose.mjs',
        '--out',
        output,
        ...sorted(entrypoints),
      ],
      needsDatabase: true,
      outputKind: 'pgtap',
      output,
    });
  }
  if (races.size > 0) {
    const output = `${outDir}/races.out`;
    outputs.races.push(output);
    for (const runner of sorted(races)) {
      add({
        id: `race:${runner}`,
        tool: 'race',
        label: `race runner ${runner}`,
        command: process.execPath,
        args: [runner],
        needsDatabase: true,
        outputKind: 'races',
        output,
        runner,
      });
    }
  }
  // Plain steps first (vitest, then Playwright); then the steps that need the
  // shared database in a fixed order: pgTAP, vitest, Playwright, race runners.
  const rank = (step) =>
    step.needsDatabase
      ? { pgtap: 0, vitest: 1, playwright: 2, race: 3 }[step.tool]
      : step.tool === 'vitest'
        ? 0
        : 1;
  const byRank = (a, b) => rank(a) - rank(b);
  const plain = steps.filter((step) => !step.needsDatabase).sort(byRank);
  const database = steps.filter((step) => step.needsDatabase).sort(byRank);
  return {
    steps: [...plain, ...database],
    problems,
    outputs,
    finalReset: database.length > 0,
  };
};
