/**
 * Tracked boundary #128 (finding B-08): the production trigger of the claimed CMS schema dry-run preparation.
 * Real composition from the queue handler down to the HTTP edge; only PostgREST is scripted.
 */
import { describe, expect, it } from 'vitest';

import { SCHEMA_MIGRATION_RPC as RPC } from './content-schema-registry/migration-worker-constants';
import {
  bindings,
  claimedResponse,
  createWorld,
  deliver,
  firstEmptyScript,
  IDS,
  operations,
  planOf,
  type PlanScript,
} from './production-async-entrypoint-cms-preparation.test-support';

const REPORT_REF = { type: 'cms_schema_dry_run_report', id: IDS.report };

describe('[P2-S12-AC-050] production CMS dry-run Job trigger (B-08, #128)', () => {
  it('a production dry-run Job reaching the effect is written terminal, never left running with its message acknowledged', async () => {
    const world = createWorld(firstEmptyScript());

    const { ack, retry } = await deliver(world);

    // Today the dispatcher answers pending_manual_review: no outcome write, the message is acknowledged and the
    // Job stays `running` forever (finding B-08, F5). The Job must instead end `succeeded` with the report ref.
    expect(world.outcomes).toEqual([
      {
        p_job_id: IDS.job,
        p_expected_version: expect.any(String),
        p_lease_token: expect.any(String),
        p_next_state: 'succeeded',
        p_result_ref: REPORT_REF,
        p_error_code: null,
        p_retryable: false,
      },
    ]);
    expect(world.job.state).toBe('succeeded');
    expect(world.processed).toHaveLength(1);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });

  it('an unavailable claimed read returns the Job to queued and retries the message instead of parking it running', async () => {
    const world = createWorld({
      ...firstEmptyScript(),
      [RPC.readPlan]: (request) => {
        if ('claimedJob' in request) throw new Response('{}', { status: 503 });
        return claimedResponse(request);
      },
    });

    const { ack, retry } = await deliver(world);

    expect(world.outcomes).toEqual([
      expect.objectContaining({
        p_next_state: 'queued',
        p_error_code: 'DEPENDENCY_UNAVAILABLE',
        p_result_ref: null,
        p_retryable: true,
      }),
    ]);
    expect(world.processed).toEqual([]);
    expect(world.job.state).toBe('queued');
    expect(ack).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(operations(world)).not.toContain(RPC.claimLease);
  });

  it('a sealed READY scan is succeeded and recorded exactly once: outcome, then processed marker, then ack', async () => {
    const world = createWorld(firstEmptyScript());
    const { ack } = await deliver(world);
    const names = operations(world);
    expect(names.filter((n) => n === 'apply_job_outcome')).toHaveLength(1);
    expect(names.filter((n) => n === 'record_processed_event')).toHaveLength(1);
    expect(names.indexOf('apply_job_outcome')).toBeLessThan(
      names.indexOf('record_processed_event'),
    );
    expect(ack).toHaveBeenCalledTimes(1);
  });
});

type Row = readonly [
  label: string,
  script: PlanScript,
  expected: Readonly<{
    state: string;
    errorCode: string | null;
    resultRef: unknown;
    terminal: boolean;
    delaySeconds?: number;
  }>,
];
const throwHttp = (status: number) => {
  throw new Response('{}', { status });
};
const mappingRows: readonly Row[] = [
  [
    'progress (batch limit reached) is queued with no error code and retried at once',
    {
      ...firstEmptyScript(),
      [RPC.processDryRunBatch]: () => ({
        done: false,
        cursor: '0',
        progress: 0.5,
        sourceCount: '0',
        targetCount: '0',
        rowErrorCount: '0',
        migratedCount: '0',
        failedCount: '0',
      }),
    },
    { state: 'queued', errorCode: null, resultRef: null, terminal: false },
  ],
  [
    'retry (plan lease unavailable) is queued with the reason and retried after 15 seconds',
    {
      ...firstEmptyScript(),
      [RPC.claimLease]: () => ({
        acquired: false,
        leaseToken: null,
        plan: null,
        reasonCode: 'LEASE_UNAVAILABLE',
      }),
    },
    {
      state: 'queued',
      errorCode: 'LEASE_UNAVAILABLE',
      resultRef: null,
      terminal: false,
      delaySeconds: 15,
    },
  ],
  [
    'blocked (a sealed failing scan) is failed MIGRATION_BLOCKED with no result reference',
    {
      ...firstEmptyScript(),
      [RPC.finalizeDryRun]: () => planOf({ state: 'blocked', version: '9' }),
    },
    {
      state: 'failed',
      errorCode: 'MIGRATION_BLOCKED',
      resultRef: null,
      terminal: true,
    },
  ],
  [
    'failed_terminal (an invalid batch response, rolled back) is failed with the worker reason',
    {
      ...firstEmptyScript(),
      [RPC.processDryRunBatch]: () => ({ unexpected: true }),
      [RPC.rollback]: () => ({
        plan: planOf({ state: 'blocked', version: '9' }),
      }),
    },
    {
      state: 'failed',
      errorCode: 'DEPENDENCY_INVALID_RESPONSE',
      resultRef: null,
      terminal: true,
    },
  ],
  [
    'invalid_resolution (a malformed claimed read) is failed DEPENDENCY_INVALID_RESPONSE',
    { ...firstEmptyScript(), [RPC.readPlan]: () => ({ job: {} }) },
    {
      state: 'failed',
      errorCode: 'DEPENDENCY_INVALID_RESPONSE',
      resultRef: null,
      terminal: true,
    },
  ],
  [
    'resolution_failed (claimed read unavailable) is queued DEPENDENCY_UNAVAILABLE and retried after 15 seconds',
    { ...firstEmptyScript(), [RPC.readPlan]: () => throwHttp(503) },
    {
      state: 'queued',
      errorCode: 'DEPENDENCY_UNAVAILABLE',
      resultRef: null,
      terminal: false,
      delaySeconds: 15,
    },
  ],
];

describe('[P2-S12-AC-050] DEC-183 map through the production entrypoint', () => {
  it.each(mappingRows)('%s', async (_label, script, expected) => {
    const world = createWorld(script);
    const { ack, retry } = await deliver(world);

    expect(world.outcomes).toEqual([
      expect.objectContaining({
        p_next_state: expected.state,
        p_error_code: expected.errorCode,
        p_result_ref: expected.resultRef,
        p_retryable: expected.state === 'queued',
      }),
    ]);
    expect(world.processed).toHaveLength(expected.terminal ? 1 : 0);
    expect(ack).toHaveBeenCalledTimes(expected.terminal ? 1 : 0);
    expect(retry).toHaveBeenCalledTimes(expected.terminal ? 0 : 1);
    if (!expected.terminal)
      expect(retry.mock.calls[0]).toEqual(
        expected.delaySeconds === undefined
          ? []
          : [{ delaySeconds: expected.delaySeconds }],
      );
  });

  it('an environment the callback cannot compose is queued unavailable and retried after 15 seconds; the queue handler never throws', async () => {
    const world = createWorld(firstEmptyScript());
    // Valid for the Job RPCs, invalid for the migration worker's validated server environment.
    const env = { ...bindings(), APP_RELEASE: '' };

    const { ack, retry } = await deliver(world, 1, undefined, env);

    expect(operations(world)).not.toContain(RPC.claimLease);
    // Only the origin verification read ran; the Job-fenced claimed read never did.
    expect(
      world.calls.filter(
        (call) =>
          call.operation === RPC.readPlan &&
          'claimedJob' in (call.body.p_request as object),
      ),
    ).toEqual([]);
    expect(world.outcomes).toEqual([
      expect.objectContaining({
        p_next_state: 'queued',
        p_error_code: 'DEPENDENCY_UNAVAILABLE',
        p_result_ref: null,
        p_retryable: true,
      }),
    ]);
    expect(ack).not.toHaveBeenCalled();
    expect(retry.mock.calls).toEqual([[{ delaySeconds: 15 }]]);
  });

  it('the same unusable environment on the fourth delivery fails the Job as retries exhausted and acknowledges it', async () => {
    const world = createWorld(firstEmptyScript());
    const env = { ...bindings(), APP_RELEASE: '' };

    const { ack, retry } = await deliver(world, 4, undefined, env);

    expect(world.outcomes).toEqual([
      expect.objectContaining({
        p_next_state: 'failed',
        p_error_code: 'MIGRATION_RETRIES_EXHAUSTED',
        p_result_ref: null,
        p_retryable: false,
      }),
    ]);
    expect(world.processed).toHaveLength(1);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });
});
