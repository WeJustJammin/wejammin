import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CMS_RUN_TAXONOMY_MERGE_CONVERGE_RPC,
  CMS_TAXONOMY_MERGE_CONVERGE_JOB_TYPE,
  TAXONOMY_MERGE_JOB_ERROR,
} from './cms-taxonomy-merge-converge-names';
import { CMS_TAXONOMY_MERGE_RECONCILE_RPC } from './cms-taxonomy-merge-reconcile-sweep';
import {
  MERGE_RETRY_JITTER_FRACTION,
  MERGE_RETRY_PAUSES_MS,
} from './cms-taxonomy-merge-converge-effect';

/**
 * BE00 platform.job.execute requires a job-type runbook (BE00 554) and a registered terminal error code (BE00 233,
 * 571). The runbook is the repository's registry of this job's codes, alert and recovery state; this suite keeps it and
 * the code in step: every code the effect can write is listed, nothing else is, and the operational facts match.
 */
const runbookDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../docs/runbooks/platform',
);
const read = (name: string): string =>
  readFileSync(resolve(runbookDirectory, name), 'utf8');
const runbook = read('cms-taxonomy-merge-converge.md');

const BE03C_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../.memory/wiki/specs/be/03c-composition-taxonomy-localization.md',
);
const BE03C_HEADING = '**Merge convergence Job disposition';

const sectionBetween = (text: string, from: string, to: string): string => {
  const start = text.indexOf(from);
  expect(start).toBeGreaterThan(-1);
  const end = text.indexOf(to, start + from.length);
  expect(end).toBeGreaterThan(start);
  return text.slice(start, end);
};

const registeredSection = (): string =>
  sectionBetween(runbook, '## Registered error codes', '## Safe checks');

/** BE03c is the registry (BE00 233: an owning-domain registered error code); the table ends at the next heading. */
const be03cSection = (): string =>
  sectionBetween(readFileSync(BE03C_PATH, 'utf8'), BE03C_HEADING, '\n### ');

/** The table rows of a section as [job state, errorCode] pairs; the errorCode is the last cell, state the one before. */
const dispositions = (
  section: string,
): ReadonlyArray<readonly [string, string]> =>
  section
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .map((line) =>
      line
        .split('|')
        .map((cell) => cell.trim())
        .filter(Boolean),
    )
    .filter((cells) => cells.length >= 3)
    .map((cells) => [cells.at(-2)!, cells.at(-1)!] as const)
    .filter(([, code]) => /^`[A-Z][A-Z0-9_]+`$/u.test(code))
    .map(([state, code]) => [state, code.slice(1, -1)] as const);

const distinctSorted = (values: readonly string[]): string[] =>
  values.filter((v, i, all) => all.indexOf(v) === i).sort();

describe('cms.taxonomy.merge_converge runbook', () => {
  it('lists exactly the error codes the effect can write, each in the BE00 grammar', () => {
    const emitted = Object.values(TAXONOMY_MERGE_JOB_ERROR).sort();
    expect(emitted).toHaveLength(8);
    for (const code of emitted) expect(code).toMatch(/^[A-Z][A-Z0-9_]{0,63}$/u);
    const documented = distinctSorted(
      dispositions(registeredSection()).map(([, code]) => code),
    );
    expect(documented).toEqual(emitted);
  });

  it('agrees with the BE03c registry: the same codes, and the same job state for every code', () => {
    const emitted = Object.values(TAXONOMY_MERGE_JOB_ERROR).sort();
    const registry = dispositions(be03cSection());
    // Every code in the BE03c errorCode column is a code the effect can write, and every emitted code is registered.
    expect(distinctSorted(registry.map(([, code]) => code))).toEqual(emitted);
    // The runbook table and the BE03c table classify every code identically (state, code pairs).
    const pairs = (rows: ReadonlyArray<readonly [string, string]>) =>
      distinctSorted(rows.map(([state, code]) => `${code} ${state}`));
    expect(pairs(dispositions(registeredSection()))).toEqual(pairs(registry));
    // Every registry code is a failed-state code of the BE00 grammar; the succeeded row carries no code (null).
    for (const [state, code] of registry) {
      expect(state).toBe('`failed`');
      expect(code).toMatch(/^[A-Z][A-Z0-9_]{0,63}$/u);
    }
    expect(be03cSection()).toMatch(/\|\s*`succeeded`\s*\|\s*null\s*\|/u);
  });

  it('cites the BE03c section as the registry of the codes', () => {
    expect(runbook).toContain('Merge convergence Job disposition');
    expect(runbook).toContain('03c-composition-taxonomy-localization.md');
  });

  it('names the job type, the RPC, the event, the metric, the alert route and the consumer', () => {
    for (const fact of [
      CMS_TAXONOMY_MERGE_CONVERGE_JOB_TYPE,
      CMS_RUN_TAXONOMY_MERGE_CONVERGE_RPC,
      'cms_taxonomy_merge_converge.settled',
      'cms_taxonomy_merge_total',
      'platform.on_call',
      'platform.job.execute',
      'platform-jobs',
    ])
      expect(runbook).toContain(fact);
  });

  it('states the retry pauses the effect really uses and forbids hand edits', () => {
    expect(MERGE_RETRY_PAUSES_MS).toEqual([15_000, 60_000]);
    expect(runbook).toContain('15 s then 60 s');
    // BE00 550 "bounded jitter": +0-10 % on each pause, so the worst case is 16.5 s + 66 s + 3 x 15 s.
    expect(MERGE_RETRY_JITTER_FRACTION).toBe(0.1);
    expect(runbook).toContain('0-10 % jitter');
    expect(runbook).toContain('127.5 s');
    expect(runbook).toMatch(/never edit/iu);
  });

  it('documents the DEC-194 recovery sweep: the RPC, the per-failed-job key, the bounds and the stop, and no open gap', () => {
    expect(runbook).toContain('## Recovery: the bounded sweep');
    expect(runbook).toContain(
      `platform_api.${CMS_TAXONOMY_MERGE_RECONCILE_RPC}()`,
    );
    for (const fact of [
      'cms-taxonomy-merge-reconcile-sweep.ts',
      'cms_taxonomy_merge_reconcile_sweep.completed',
      'cms_taxonomy_merge_reconcile_requested_total',
      '`service_role` only',
      'no `queued` or `running` job of the type',
      "derived from the failed job's id",
      'at most one job per acting party per 15 minutes',
      'after 3 consecutive failed generations',
      'reconciled at most once',
      'DEC-194',
    ])
      expect(runbook).toContain(fact);
    // The superseded gap statements must be gone (BE03c now specifies the recovery).
    expect(runbook).not.toContain('BOUNDARY');
    expect(runbook).not.toContain('nothing guarantees one');
    expect(runbook).not.toMatch(/open (recovery )?gap/iu);
    expect(runbook).not.toMatch(/no product recovery/iu);
  });

  it('agrees with the BE03c recovery rule: the wrapper name, service_role only, the 15-minute and 3-generation bounds', () => {
    const spec = readFileSync(BE03C_PATH, 'utf8');
    const rule = sectionBetween(
      spec,
      '**Merge convergence recovery (DEC-194',
      '\n### ',
    );
    for (const fact of [
      `platform_api.${CMS_TAXONOMY_MERGE_RECONCILE_RPC}()`,
      'service_role',
      '15 minutes',
      '3 consecutive failed generations',
      'platform.on_call',
    ])
      expect(rule).toContain(fact);
  });

  it.each([
    ['README.md', 'cms-taxonomy-merge-converge.md'],
    ['jobs-outbox-reconciliation.md', 'cms-taxonomy-merge-converge.md'],
  ])('%s links the runbook', (file, link) => {
    expect(read(file)).toContain(link);
  });
});
