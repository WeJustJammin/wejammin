// Executes a run plan (run-plan-lib.mjs) one step at a time. The process spawner is
// injected, so the sequencing rules are testable without a database or a browser.

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';

const MAX_BUFFER = 1 << 30;

/**
 * A race runner passes on exit code 0 and at least one `ok - ...` assertion line
 * (the rule infra/run-database-race-runners.mjs applies; copied, not imported, so
 * this script never depends on another owner's file).
 */
export const raceVerdict = ({ status, stdout }) => {
  const assertions = stdout
    .split('\n')
    .filter((line) => line.startsWith('ok - ')).length;
  return { passed: status === 0 && assertions > 0, assertions };
};

const slug = (id) => id.replace(/[^A-Za-z0-9._-]+/gu, '_');

const writeLog = (root, step, text) => {
  const path = resolve(
    root,
    posix.dirname(step.output),
    `${slug(step.id)}.log`,
  );
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return path;
};

const withNewline = (text) =>
  text === '' || text.endsWith('\n') ? text : `${text}\n`;

/**
 * Run `steps` in order. A step that needs the database is preceded by a database
 * reset (the suites commit fixtures the next one expects absent) and, when any
 * did, a final reset leaves a clean database. A failed reset aborts every
 * remaining database step. A failing test run never stops the sequence: its
 * machine output is exactly what the receipts must record.
 *
 * @returns {{id: string, outcome: 'passed'|'failed'|'aborted'|'no-tests', status: number|null, log: string|null, detail?: string}[]}
 */
export const executeSteps = ({ steps, root, finalReset, spawn }) => {
  const outcomes = [];
  const truncated = new Set();
  let aborted = false;
  let usedDatabase = false;
  const run = (command, args, env = {}) =>
    spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...env },
      encoding: 'utf8',
      maxBuffer: MAX_BUFFER,
    });
  for (const step of steps) {
    if (step.needsDatabase && aborted) {
      outcomes.push({
        id: step.id,
        outcome: 'aborted',
        status: null,
        log: null,
        detail: 'an earlier database reset failed',
      });
      continue;
    }
    if (step.resetBefore) {
      usedDatabase = true;
      const reset = run('pnpm', ['db:reset']);
      if (reset.status !== 0) {
        aborted = true;
        const log = writeLog(root, step, `${reset.stdout}\n${reset.stderr}`);
        outcomes.push({
          id: step.id,
          outcome: 'aborted',
          status: null,
          log,
          detail: `database reset failed (exit ${String(reset.status)})`,
        });
        continue;
      }
    }
    const env = Object.fromEntries(
      Object.entries(step.env).map(([key, value]) => [
        key,
        key === 'PLAYWRIGHT_JSON_OUTPUT_NAME' ? resolve(root, value) : value,
      ]),
    );
    const result = run(step.command, step.args, env);
    const log = writeLog(root, step, `${result.stdout}\n${result.stderr}`);
    let outcome = result.status === 0 ? 'passed' : 'failed';
    if (step.outputKind === 'races') {
      const verdict = raceVerdict(result);
      const output = resolve(root, step.output);
      mkdirSync(dirname(output), { recursive: true });
      const text = `${withNewline(result.stdout)}${verdict.passed ? 'PASS' : 'FAIL'} ${step.runner} exit=${String(result.status)} ok=${String(verdict.assertions)}\n`;
      if (truncated.has(output)) appendFileSync(output, text);
      else {
        writeFileSync(output, text);
        truncated.add(output);
      }
      outcome = verdict.passed ? 'passed' : 'failed';
    } else if (
      step.outputKind === 'playwright' &&
      result.status !== 0 &&
      !existsSync(resolve(root, step.output)) &&
      /No tests found/u.test(`${result.stdout}\n${result.stderr}`)
    ) {
      outcome = 'no-tests';
    }
    outcomes.push({ id: step.id, outcome, status: result.status, log });
  }
  if (finalReset && usedDatabase && !aborted) {
    const reset = run('pnpm', ['db:reset']);
    if (reset.status !== 0) {
      outcomes.push({
        id: 'final-reset',
        outcome: 'failed',
        status: reset.status,
        log: null,
        detail:
          'the closing database reset failed; the local database is not clean',
      });
    }
  }
  return outcomes;
};
