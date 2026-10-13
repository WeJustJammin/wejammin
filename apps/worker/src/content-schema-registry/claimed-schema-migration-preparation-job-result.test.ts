/**
 * DEC-183 / BE03a "Preparation Job disposition": the total, fail-closed map from the claimed preparation
 * result to one BE00 Job disposition. Pure: the mapper has no port, so nothing is stubbed.
 */
import type { JobEffectInput, JobEffectResult } from '@wejammin/application';
import { JobStatusSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { createProductionJobEffectDispatcher } from '../production-job-effect-dispatcher';
import type { ClaimedSchemaMigrationPreparationResult } from './claimed-schema-migration-preparation';
import {
  MIGRATION_WORKER_OUTCOMES,
  PREPARATION_JOB_ERROR as ERROR,
  PREPARATION_RESULT_REF_TYPE,
  preparationJobResult,
} from './claimed-schema-migration-preparation-job-result';
import { resultWith } from './migration-worker-validation';
import { CmsSchemaDryRunClaimRequestSchema } from './schema-dry-run-claim-request';
import { IDS } from './schema-dry-run-claim-response-test-support';

const REPORT_REF = { type: PREPARATION_RESULT_REF_TYPE, id: IDS.report };
const ERROR_GRAMMAR = /^[A-Z][A-Z0-9_]{0,63}$/u;
const claimRequest = CmsSchemaDryRunClaimRequestSchema.parse({
  claimedJob: { jobId: IDS.job, version: '19', leaseToken: IDS.other },
  requestedEvent: {
    eventId: IDS.event,
    eventType: 'job.requested',
    schemaVersion: 1,
    aggregateType: 'job',
    aggregateId: IDS.job,
    aggregateVersion: '3',
    correlationId: IDS.other,
    causationId: null,
  },
});
const processed = (
  outcome: (typeof MIGRATION_WORKER_OUTCOMES)[number],
  reasonCode: string | null = null,
): ClaimedSchemaMigrationPreparationResult => ({
  kind: 'processed',
  claimRequest,
  reportId: IDS.report,
  result: resultWith(outcome, { reasonCode }),
});

const result = (
  state: JobEffectResult['state'],
  errorCode: string | null,
  resultRef: JobEffectResult['resultRef'] = null,
): JobEffectResult => ({ state, errorCode, resultRef });

type Row = readonly [
  label: string,
  input: ClaimedSchemaMigrationPreparationResult,
  expected: JobEffectResult,
];
const rows: readonly Row[] = [
  [
    '1 invalid_claim',
    { kind: 'invalid_claim' },
    result('failed', 'PREPARATION_CLAIM_INVALID'),
  ],
  [
    '2 resolution_failed retryable, grammar reason',
    {
      kind: 'resolution_failed',
      failure: { code: 'DEPENDENCY_DEADLINE_EXCEEDED', retryable: true },
    },
    result('queued', 'DEPENDENCY_DEADLINE_EXCEEDED'),
  ],
  [
    '2 resolution_failed retryable, non-grammar reason',
    {
      kind: 'resolution_failed',
      failure: { code: 'not-a-code', retryable: true },
    },
    result('queued', 'DEPENDENCY_UNAVAILABLE'),
  ],
  [
    '3 resolution_failed terminal, grammar reason',
    {
      kind: 'resolution_failed',
      failure: { code: 'FORBIDDEN', retryable: false },
    },
    result('failed', 'FORBIDDEN'),
  ],
  [
    '3 resolution_failed terminal, non-grammar reason',
    { kind: 'resolution_failed', failure: { code: '', retryable: false } },
    result('failed', 'DEPENDENCY_UNAVAILABLE'),
  ],
  [
    '4 invalid_resolution',
    { kind: 'invalid_resolution' },
    result('failed', 'DEPENDENCY_INVALID_RESPONSE'),
  ],
  [
    '5 completed',
    processed('completed'),
    result('succeeded', null, REPORT_REF),
  ],
  ['6 progress', processed('progress'), result('queued', null)],
  [
    '7 retry, grammar reason',
    processed('retry', 'LEASE_UNAVAILABLE'),
    result('queued', 'LEASE_UNAVAILABLE'),
  ],
  [
    '7 retry, no reason',
    processed('retry'),
    result('queued', 'DEPENDENCY_UNAVAILABLE'),
  ],
  [
    '8 duplicate',
    processed('duplicate'),
    result('failed', 'PREPARATION_OUTCOME_UNMAPPED'),
  ],
  [
    '9 stale',
    processed('stale', 'PLAN_VERSION_MISMATCH'),
    result('failed', 'PREPARATION_OUTCOME_UNMAPPED'),
  ],
  [
    '10 blocked ignores the worker reason',
    processed('blocked', 'SOMETHING_ELSE'),
    result('failed', 'MIGRATION_BLOCKED'),
  ],
  [
    '11 failed_retryable, grammar reason',
    processed('failed_retryable', 'TRANSFORM_BUSY'),
    result('queued', 'TRANSFORM_BUSY'),
  ],
  [
    '11 failed_retryable, no reason',
    processed('failed_retryable'),
    result('queued', 'MIGRATION_FAILED'),
  ],
  [
    '12 failed_terminal, grammar reason',
    processed('failed_terminal', 'MIGRATION_TERMINAL'),
    result('failed', 'MIGRATION_TERMINAL'),
  ],
  [
    '12 failed_terminal, no reason',
    processed('failed_terminal'),
    result('failed', 'MIGRATION_FAILED'),
  ],
  [
    '13 dead_letter',
    processed('dead_letter', 'EVENT_CLAIM_LOST'),
    result('failed', 'PREPARATION_OUTCOME_UNMAPPED'),
  ],
];

describe('[P2-S12-AC-050] preparation Job disposition map (DEC-183)', () => {
  it.each(rows)('row %s', (_label, input, expected) => {
    expect(preparationJobResult(input)).toEqual(expected);
  });

  it('covers every worker outcome exactly once and every result variant', () => {
    expect([...MIGRATION_WORKER_OUTCOMES].sort()).toEqual([
      'blocked',
      'completed',
      'dead_letter',
      'duplicate',
      'failed_retryable',
      'failed_terminal',
      'progress',
      'retry',
      'stale',
    ]);
    expect(new Set(MIGRATION_WORKER_OUTCOMES).size).toBe(
      MIGRATION_WORKER_OUTCOMES.length,
    );
    for (const outcome of MIGRATION_WORKER_OUTCOMES) {
      const mapped = preparationJobResult(processed(outcome, 'SAMPLE_REASON'));
      expect(['queued', 'succeeded', 'failed']).toContain(mapped.state);
    }
  });

  it('fails closed on a worker outcome the map does not know', () => {
    const unknown = processed('completed');
    if (unknown.kind !== 'processed') throw new Error('fixture');
    const forged = {
      ...unknown,
      result: { ...unknown.result, outcome: 'finished_early' },
    } as unknown as ClaimedSchemaMigrationPreparationResult;
    expect(preparationJobResult(forged)).toEqual(
      result('failed', ERROR.outcomeUnmapped),
    );
  });

  it('never reports cancelled or pending_manual_review, whatever the reason', () => {
    const inputs: ClaimedSchemaMigrationPreparationResult[] = [
      ...rows.map(([, input]) => input),
      ...MIGRATION_WORKER_OUTCOMES.flatMap((o) => [
        processed(o),
        processed(o, 'X_Y'),
      ]),
    ];
    for (const input of inputs) {
      const mapped = preparationJobResult(input);
      expect(mapped.state).not.toBe('cancelled');
      expect(mapped.state).not.toBe('pending_manual_review');
    }
  });

  it('satisfies the Job SQL invariants offline for every row', () => {
    for (const [, input] of rows) {
      const mapped = preparationJobResult(input);
      if (mapped.state === 'succeeded') {
        expect(mapped.resultRef).not.toBeNull();
        expect(mapped.errorCode).toBeNull();
      }
      if (mapped.state === 'failed') {
        expect(mapped.errorCode).toMatch(ERROR_GRAMMAR);
        expect(mapped.resultRef).toBeNull();
      }
      if (mapped.state === 'queued') expect(mapped.resultRef).toBeNull();
      if (mapped.errorCode !== null)
        expect(mapped.errorCode).toMatch(ERROR_GRAMMAR);
    }
  });

  it('gives a succeeded Job a result reference the status route can parse', () => {
    const mapped = preparationJobResult(processed('completed'));
    const status = JobStatusSchema.safeParse({
      id: IDS.job,
      type: 'cms.schema.dry_run',
      state: mapped.state,
      progress: null,
      resultRef: mapped.resultRef,
      error: null,
      createdAt: '2026-10-13T00:00:00.000Z',
      updatedAt: '2026-10-13T00:00:00.000Z',
    });
    expect(status.success).toBe(true);
  });

  it.each([
    ['null', null, 'MIGRATION_FAILED'],
    ['lowercase', 'migration_failed', 'MIGRATION_FAILED'],
    ['leading digit', '9_FAILED', 'MIGRATION_FAILED'],
    ['64 characters', `A${'B'.repeat(63)}`, `A${'B'.repeat(63)}`],
    ['65 characters', `A${'B'.repeat(64)}`, 'MIGRATION_FAILED'],
    ['a dotted code', 'CMS.FAILED', 'MIGRATION_FAILED'],
    ['a field value shape', 'title="Quiet Riot"', 'MIGRATION_FAILED'],
  ])(
    'worker reason %s maps to %s for failed_terminal',
    (_label, reason, expected) => {
      expect(
        preparationJobResult(processed('failed_terminal', reason)).errorCode,
      ).toBe(expected);
    },
  );

  it('survives the production dispatcher validation unchanged', async () => {
    const input = {
      job: {
        id: IDS.job,
        type: 'cms.schema.dry_run',
        state: 'running',
        version: '19',
        leaseUntilMs: 1,
      },
      envelope: claimRequest.requestedEvent,
      leaseToken: IDS.other,
    } as unknown as JobEffectInput;
    for (const [, row, expected] of rows) {
      const dispatch = createProductionJobEffectDispatcher({
        prepareSchemaDryRun: async () => preparationJobResult(row),
      });
      expect(await dispatch(input)).toEqual(expected);
    }
  });
});
