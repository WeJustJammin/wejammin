/** Controlled receiving composition, not SQL, production CMS wiring, or redelivery proof. */
import type { CanonicalJob, JobEffectPort } from '@wejammin/application';
import type { QueueEnvelope } from '@wejammin/contracts';
import { expect, vi } from 'vitest';

import {
  createAsyncEntrypoint,
  type AsyncExecutionContext,
  type AsyncWorkerBindings,
  type PlatformJobsMessage,
  type PlatformJobsQueue,
} from './async-entrypoint';
import { createAsyncJobDependencies, createSupabaseRpc } from './async-runtime';
import type {
  AsyncJobRuntimeDependencies,
  AsyncRpcClient,
} from './async-runtime-rpc-types';
import { parseBoolean } from './async-runtime-support';
import { CmsSchemaDryRunOriginRequestSchema } from './content-schema-registry/schema-dry-run-origin-request';
import { createCmsSchemaDryRunOriginVerifier } from './content-schema-registry/schema-dry-run-origin-verifier';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const TOKEN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const envelope = Object.freeze({
  aggregateId: JOB_ID,
  aggregateType: 'job',
  aggregateVersion: '7',
  causationId: null,
  correlationId: '33333333-3333-4333-8333-333333333333',
  eventId: EVENT_ID,
  eventType: 'job.requested',
  schemaVersion: 1,
} satisfies QueueEnvelope);
const canonical = Object.freeze({
  id: JOB_ID,
  type: 'cms.schema.dry_run',
  state: 'queued',
  version: '7',
  leaseUntilMs: null,
} satisfies CanonicalJob);
// Non-adjacent controlled receipt: no assertion about SQL version adjacency.
const receipt = Object.freeze({
  jobId: JOB_ID,
  leaseToken: TOKEN,
  expectedVersion: '7',
  version: '19',
  leaseUntilMs: 301_000,
});
const fence = Object.freeze({
  expected_epoch: '3',
  consumer_epoch: '3',
  integrity_verified: true,
  reconciliation_complete: true,
});
// Exact own-key comparison for the bounded plain objects/arrays in this harness.
const equalStructure = (actual: unknown, expected: unknown): boolean => {
  if (Object.is(actual, expected)) return true;
  if (
    actual === null ||
    expected === null ||
    typeof actual !== 'object' ||
    typeof expected !== 'object' ||
    Array.isArray(actual) !== Array.isArray(expected) ||
    Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)
  )
    return false;
  const keys = Reflect.ownKeys(actual);
  return (
    keys.length === Reflect.ownKeys(expected).length &&
    keys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(expected, key) &&
        equalStructure(Reflect.get(actual, key), Reflect.get(expected, key)),
    )
  );
};
const same = (actual: unknown, expected: unknown) =>
  expect(equalStructure(actual, expected)).toBe(true);

const deferredGate = () => {
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    entered,
    release: () => release(),
    hold: async () => {
      enter();
      await released;
    },
  };
};
type State = 'queued' | 'succeeded' | 'failed' | 'cancelled';
const fixture = (
  state: State,
  applied = true,
  hold?: 'apply' | 'processed',
) => {
  const history: unknown[][] = [];
  const gate = deferredGate();
  const resultRef =
    state === 'succeeded'
      ? Object.freeze({ resourceType: 'job', resourceId: JOB_ID })
      : null;
  const effectResult = Object.freeze({
    state,
    resultRef,
    errorCode: state === 'succeeded' ? null : 'DEPENDENCY_UNAVAILABLE',
  });
  const controlledReply = async (
    operation: Parameters<AsyncRpcClient>[1],
  ): Promise<unknown> => {
    if (operation === 'cms_get_schema_migration_plan') return true;
    if (operation === 'read_canonical_job') return canonical;
    if (operation === 'read_restore_fence') return fence;
    if (operation === 'claim_job') return receipt;
    if (operation === 'apply_job_outcome') {
      if (hold === 'apply') await gate.hold();
      history.push(['apply-response', applied]);
      return applied;
    }
    if (operation === 'record_processed_event') {
      if (hold === 'processed') await gate.hold();
      history.push(['processed-response', 'recorded']);
      return 'recorded';
    }
    throw new Error('Unexpected queued-continuation RPC');
  };
  const rpcCalls: Parameters<AsyncRpcClient>[] = [];
  const rpc: AsyncRpcClient = <T>(
    ...args: Parameters<AsyncRpcClient>
  ): Promise<T> => {
    rpcCalls.push(args);
    const [, operation, input] = args;
    history.push(['rpc', operation, input]);
    const transport = createSupabaseRpc(
      async () =>
        new Response(JSON.stringify(await controlledReply(operation)), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    return transport<T>(...args);
  };
  const verifyCmsSchemaDryRunOrigin = vi.fn<
    NonNullable<AsyncJobRuntimeDependencies['verifyCmsSchemaDryRunOrigin']>
  >(({ env: originEnv, envelope: originEnvelope, signal }) =>
    createCmsSchemaDryRunOriginVerifier({
      port: {
        call: async (operation, request, rpcSignal) => {
          expect(operation === 'cms_get_schema_migration_plan').toBe(true);
          expect(rpcSignal === signal).toBe(true);
          const parsed = CmsSchemaDryRunOriginRequestSchema.parse(request);
          same(parsed, { originEvent: envelope });
          expect(Object.isFrozen(request)).toBe(true);
          expect(Object.isFrozen(parsed.originEvent)).toBe(true);
          return parseBoolean(
            await rpc<unknown>(
              originEnv,
              operation,
              { p_request: parsed },
              rpcSignal,
            ),
            'Invalid controlled origin response',
          );
        },
      },
    }).verify(originEnvelope, signal),
  );
  const effect = vi.fn<JobEffectPort['execute']>(async (input) => {
    history.push(['effect', input]);
    return effectResult;
  });
  const send = vi.fn<PlatformJobsQueue['send']>(async () => ({
    metadata: { metrics: { backlogBytes: 0, backlogCount: 0 } },
  }));
  const env = {
    APP_ENVIRONMENT: 'staging',
    APP_RELEASE: 'controlled-continuation-test',
    PLATFORM_JOBS: { send },
    SUPABASE_SECRET_KEY: 'controlled-not-a-real-secret',
    SUPABASE_URL: 'https://controlled.invalid',
  } satisfies AsyncWorkerBindings;
  const ack = vi.fn<PlatformJobsMessage['ack']>((...args) => {
    history.push(['ack', ...args]);
  });
  const retry = vi.fn<PlatformJobsMessage['retry']>((...args) => {
    history.push(['retry', ...args]);
  });
  const message = {
    ack,
    retry,
    body: envelope,
    attempts: 1,
    id: 'controlled-continuation',
  } satisfies PlatformJobsMessage;
  const context = { waitUntil: vi.fn() } satisfies AsyncExecutionContext;
  const leaseToken = vi.fn<(message: PlatformJobsMessage) => string>(
    () => TOKEN,
  );
  const entrypoint = createAsyncEntrypoint(
    createAsyncJobDependencies({
      rpc,
      effect,
      verifyCmsSchemaDryRunOrigin,
      leaseToken,
      leaseSeconds: 300,
      now: () => 1_000,
    }),
  );
  const expectedEffect = {
    envelope,
    job: canonical,
    leaseToken: TOKEN,
    claimedLease: receipt,
  };
  const applyArgs = {
    p_job_id: JOB_ID,
    p_expected_version: '19',
    p_lease_token: TOKEN,
    p_next_state: state,
    p_result_ref: resultRef,
    p_error_code: effectResult.errorCode,
    p_retryable: state === 'queued',
  };
  const recordArgs = {
    p_event_id: EVENT_ID,
    p_event_type: 'job.requested',
    p_schema_version: 1,
    p_aggregate_id: JOB_ID,
    p_pending_manual_review: false,
  };
  const reads = [
    ['read_canonical_job', { p_job_id: JOB_ID }],
    ['cms_get_schema_migration_plan', { p_request: { originEvent: envelope } }],
    ['read_canonical_job', { p_job_id: JOB_ID }],
    ['read_restore_fence', {}],
    ['read_restore_fence', {}],
    [
      'claim_job',
      {
        p_job_id: JOB_ID,
        p_expected_version: '7',
        p_lease_token: TOKEN,
        p_lease_seconds: 300,
      },
    ],
  ];
  const prefix = [
    ...reads.map(([operation, input]) => ['rpc', operation, input]),
    ['effect', expectedEffect],
    ['rpc', 'apply_job_outcome', applyArgs],
  ];
  const terminal = applied && state !== 'queued';
  const expected = [
    ...prefix,
    ['apply-response', applied],
    ...(terminal
      ? [
          ['rpc', 'record_processed_event', recordArgs],
          ['processed-response', 'recorded'],
          ['ack'],
        ]
      : [['retry']]),
  ];
  const unchanged = JSON.stringify({
    envelope,
    canonical,
    receipt,
    fence,
    effectResult,
  });
  return {
    history,
    gate,
    prefix,
    recordArgs,
    ack,
    retry,
    run: () =>
      entrypoint.queue(
        {
          queue: 'platform-jobs-staging',
          messages: [message],
        },
        env,
        context,
      ),
    assertFinished: () => {
      same(history, expected);
      same(rpcCalls, [
        ...reads.map(([operation, input]) =>
          operation === 'cms_get_schema_migration_plan'
            ? [
                env,
                operation,
                input,
                verifyCmsSchemaDryRunOrigin.mock.calls[0]?.[0].signal,
              ]
            : [env, operation, input],
        ),
        [env, 'apply_job_outcome', applyArgs],
        ...(terminal ? [[env, 'record_processed_event', recordArgs]] : []),
      ]);
      expect(rpcCalls.every(([actualEnv]) => actualEnv === env)).toBe(true);
      expect(verifyCmsSchemaDryRunOrigin.mock.calls.length).toBe(1);
      for (const [input] of verifyCmsSchemaDryRunOrigin.mock.calls) {
        same(Reflect.ownKeys(input).sort(), ['env', 'envelope', 'signal']);
        expect(input.env === env).toBe(true);
        same(input.envelope, envelope);
        expect(Object.isFrozen(input.envelope)).toBe(true);
        expect(
          input.signal instanceof AbortSignal && !input.signal.aborted,
        ).toBe(true);
      }
      same(effect.mock.calls, [[expectedEffect]]);
      same(ack.mock.calls, terminal ? [[]] : []);
      same(retry.mock.calls, terminal ? [] : [[]]);
      same(leaseToken.mock.calls, [[message]]);
      expect(leaseToken.mock.calls[0]?.[0] === message).toBe(true);
      expect(message.body === envelope).toBe(true);
      same(send.mock.calls, []);
      same(context.waitUntil.mock.calls, []);
      expect(
        JSON.stringify({
          envelope,
          canonical,
          receipt,
          fence,
          effectResult,
        }) === unchanged,
      ).toBe(true);
      expect(
        [envelope, canonical, receipt, fence, effectResult].every(
          Object.isFrozen,
        ),
      ).toBe(true);
    },
  };
};

export { fixture, same };
