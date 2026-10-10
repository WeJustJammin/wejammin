import type { JobEffectInput } from '@wejammin/application';
import { describe, expect, it, vi } from 'vitest';

import { createClaimedSchemaMigrationPreparation } from './claimed-schema-migration-preparation';
import { SCHEMA_MIGRATION_RPC as RPC } from './migration-worker-constants';
import type { MigrationWorkerPort } from './migration-worker-types';
import { CmsSchemaDryRunClaimRequestSchema } from './schema-dry-run-claim-request';
import { CmsSchemaDryRunClaimResponseSchema } from './schema-dry-run-claim-response';
import {
  firstFixture,
  IDS,
  snapshot,
} from './schema-dry-run-claim-response-test-support';

const TOKEN = 'a0000000-0000-4000-8000-000000000001';
const CAUSE = 'b0000000-0000-4000-8000-000000000002';
const FOREIGN = 'c0000000-0000-4000-8000-000000000003';
const ACQUIRED = '9223372036854775807';
const PRECLAIM = '9223372036854775805';
const ORIGINAL = '9223372036854775799';
const DEADLINE = { code: 'DEPENDENCY_DEADLINE_EXCEEDED', retryable: true };

// Controlled ports and contract values, not persisted report or lease proof.
const fixture = (cause: string | null = null, version = ACQUIRED) => {
  const base = firstFixture({ state: 'ready', progress: 1 });
  const response = {
    ...base,
    job: { ...base.job, version },
    requestedEvent: {
      ...base.requestedEvent,
      aggregateVersion: ORIGINAL,
      causationId: cause,
    },
  };
  const input = {
    job: {
      id: IDS.job,
      type: 'cms.schema.dry_run',
      state: 'running',
      version: PRECLAIM,
      leaseUntilMs: null,
    },
    envelope: { ...response.requestedEvent },
    leaseToken: TOKEN,
    claimedLease: {
      jobId: IDS.job,
      leaseToken: TOKEN,
      expectedVersion: PRECLAIM,
      version,
      leaseUntilMs: 2_000,
    },
  } satisfies JobEffectInput;
  const request = {
    claimedJob: { jobId: IDS.job, version, leaseToken: TOKEN },
    requestedEvent: { ...response.requestedEvent },
  };
  expect(CmsSchemaDryRunClaimRequestSchema.safeParse(request).success).toBe(
    true,
  );
  expect(CmsSchemaDryRunClaimResponseSchema.safeParse(response).success).toBe(
    true,
  );
  const call = vi.fn<MigrationWorkerPort['call']>(async () => response);
  const telemetry = vi.fn();
  const controller = new AbortController();
  const options = { signal: controller.signal, attempt: 2 };
  const worker = createClaimedSchemaMigrationPreparation({
    port: { call },
    workerId: 'claimed-worker',
    now: () => 1_000,
    leaseDurationMs: 30_000,
    telemetry,
  });
  return {
    input,
    request,
    response,
    call,
    telemetry,
    controller,
    options,
    worker,
  };
};
type Fixture = ReturnType<typeof fixture>;
const readCall = (f: Fixture) => [RPC.readPlan, f.request, f.options.signal];
const processed = (f: Fixture, result = {}) => ({
  kind: 'processed',
  claimRequest: f.request,
  reportId: IDS.report,
  result: {
    outcome: 'completed',
    migrationPlanId: IDS.plan,
    schemaVersionId: IDS.target,
    eventId: null,
    state: 'ready',
    cursor: '0',
    progress: 1,
    retryAfterMs: null,
    reasonCode: null,
    activationSwitched: false,
    ...result,
  },
});
const deferred = <T>() => {
  let complete: (value: T) => void = () => {
    throw new Error('Deferred not initialized');
  };
  const promise = new Promise<T>((resolve) => {
    complete = resolve;
  });
  return { promise, complete };
};
const preserve = (f: Fixture) => {
  const objects = () => [
    f.input,
    f.input.job,
    f.input.envelope,
    f.input.claimedLease,
  ];
  const before = objects().map((value) => ({
    value,
    prototype: Object.getPrototypeOf(value),
    descriptors: snapshot(value),
    frozen: Object.isFrozen(value),
    extensible: Object.isExtensible(value),
  }));
  const response = snapshot(f.response);
  return () => {
    objects().forEach((value, index) => {
      const previous = before[index];
      if (previous === undefined) throw new Error('Missing object snapshot');
      expect(value).toBe(previous.value);
      expect(Object.getPrototypeOf(value)).toBe(previous.prototype);
      expect(snapshot(value)).toStrictEqual(previous.descriptors);
      expect(Object.isFrozen(value)).toBe(previous.frozen);
      expect(Object.isExtensible(value)).toBe(previous.extensible);
    });
    expect(snapshot(f.response)).toStrictEqual(response);
  };
};

describe('controlled claimed preparation entry boundary', () => {
  it.each(['missing', 'job', 'token', 'expectedVersion'])(
    'refuses %s receipt binding before every RPC and telemetry effect',
    async (mode) => {
      const f = fixture();
      if (mode === 'missing') Reflect.deleteProperty(f.input, 'claimedLease');
      if (mode === 'job') f.input.claimedLease.jobId = FOREIGN;
      if (mode === 'token') f.input.claimedLease.leaseToken = FOREIGN;
      if (mode === 'expectedVersion')
        f.input.claimedLease.expectedVersion = '9';
      expect(await f.worker.process(f.input, f.options)).toStrictEqual({
        kind: 'invalid_claim',
      });
      expect(f.call.mock.calls).toStrictEqual([]);
      expect(f.telemetry.mock.calls).toStrictEqual([]);
    },
  );

  it.each([null, CAUSE])(
    'resolves one exact request and retains immutable report identity with causation %s',
    async (cause) => {
      const f = fixture(cause);
      const unchanged = preserve(f);
      expect([
        f.input.job.version,
        f.input.claimedLease.version,
        f.input.envelope.aggregateVersion,
        f.response.plan.version,
      ]).toStrictEqual([PRECLAIM, ACQUIRED, ORIGINAL, '13']);
      const result = await f.worker.process(f.input, f.options);
      expect(result).toStrictEqual(processed(f));
      expect(f.call.mock.calls).toStrictEqual([readCall(f)]);
      expect(f.call.mock.calls[0]?.[2]).toBe(f.options.signal);
      if (result.kind !== 'processed')
        throw new Error('Expected processed result');
      for (const value of [
        result.claimRequest,
        result.claimRequest.claimedJob,
        result.claimRequest.requestedEvent,
      ])
        expect(Object.isFrozen(value)).toBe(true);
      expect(result.claimRequest.requestedEvent).not.toBe(f.input.envelope);
      expect(result.reportId).not.toBe(result.result.migrationPlanId);
      unchanged();
    },
  );

  it.each([
    'null',
    'empty',
    'plan only',
    'legacy wrapper',
    'outer extra',
    'event extra',
  ])(
    'rejects whole malformed resolution %s without later effects',
    async (mode) => {
      const f = fixture();
      const values: Record<string, unknown> = {
        null: null,
        empty: {},
        'plan only': f.response.plan,
        'legacy wrapper': { plan: f.response.plan },
        'outer extra': { ...f.response, extra: true },
        'event extra': {
          ...f.response,
          requestedEvent: { ...f.response.requestedEvent, extra: true },
        },
      };
      const value = values[mode];
      expect(CmsSchemaDryRunClaimResponseSchema.safeParse(value).success).toBe(
        false,
      );
      f.call.mockResolvedValue(value);
      expect(await f.worker.process(f.input, f.options)).toStrictEqual({
        kind: 'invalid_resolution',
      });
      expect(f.call.mock.calls).toStrictEqual([readCall(f)]);
      expect(f.telemetry.mock.calls).toStrictEqual([]);
    },
  );

  it.each([
    'foreign job',
    'acquired version',
    'event identity',
    'correlation',
    'causation',
    'original version',
  ])('rejects privately valid but unbound %s resolution', async (mode) => {
    const f = fixture();
    const value = {
      ...f.response,
      job: { ...f.response.job },
      report: { ...f.response.report },
      requestedEvent: { ...f.response.requestedEvent },
    };
    if (mode === 'foreign job') {
      value.job.id = FOREIGN;
      value.report.jobId = FOREIGN;
      value.requestedEvent.aggregateId = FOREIGN;
    }
    if (mode === 'acquired version') value.job.version = PRECLAIM;
    if (mode === 'event identity') {
      value.job.originatingEventId = FOREIGN;
      value.requestedEvent.eventId = FOREIGN;
    }
    if (mode === 'correlation') value.requestedEvent.correlationId = FOREIGN;
    if (mode === 'causation') value.requestedEvent.causationId = CAUSE;
    if (mode === 'original version')
      value.requestedEvent.aggregateVersion = PRECLAIM;
    expect(CmsSchemaDryRunClaimResponseSchema.safeParse(value).success).toBe(
      true,
    );
    f.call.mockResolvedValue(value);
    expect(await f.worker.process(f.input, f.options)).toStrictEqual({
      kind: 'invalid_resolution',
    });
    expect(f.call.mock.calls).toStrictEqual([readCall(f)]);
    expect(f.telemetry.mock.calls).toStrictEqual([]);
  });

  it.each([
    {
      label: 'retryable',
      error: { code: 'CONFLICT', retryable: true },
      failure: { code: 'CONFLICT', retryable: true },
    },
    {
      label: 'terminal',
      error: { code: 'CONFLICT', retryable: false },
      failure: { code: 'CONFLICT', retryable: false },
    },
    {
      label: 'unsafe code',
      error: { code: 'unsafe code', status: 503 },
      failure: { code: 'DEPENDENCY_UNAVAILABLE', retryable: true },
    },
    {
      label: 'status fallback',
      error: { code: 'CONFLICT', status: 400 },
      failure: { code: 'CONFLICT', retryable: false },
    },
  ])(
    'preserves normalized $label resolver failure without fallback',
    async ({ error, failure }) => {
      const f = fixture();
      f.call.mockRejectedValue(error);
      expect(await f.worker.process(f.input, f.options)).toStrictEqual({
        kind: 'resolution_failed',
        failure,
      });
      expect(f.call.mock.calls).toStrictEqual([readCall(f)]);
      expect(f.telemetry.mock.calls).toStrictEqual([]);
    },
  );

  it('preserves a pre-aborted invocation as retryable deadline failure without calling the port', async () => {
    const f = fixture();
    f.controller.abort();
    expect(await f.worker.process(f.input, f.options)).toStrictEqual({
      kind: 'resolution_failed',
      failure: DEADLINE,
    });
    expect(f.call.mock.calls).toStrictEqual([]);
    expect(f.telemetry.mock.calls).toStrictEqual([]);
  });

  it('propagates in-flight abort and leaves no controlled port listener behind', async () => {
    const f = fixture();
    const entered = deferred<void>();
    const add = vi.spyOn(f.options.signal, 'addEventListener');
    const remove = vi.spyOn(f.options.signal, 'removeEventListener');
    const listener = vi.fn();
    f.call.mockImplementation(
      (_rpc, _request, signal) =>
        new Promise((_resolve, reject) => {
          listener.mockImplementation(() => {
            signal.removeEventListener('abort', listener);
            reject(DEADLINE);
          });
          signal.addEventListener('abort', listener, { once: true });
          entered.complete();
        }),
    );
    try {
      const pending = f.worker.process(f.input, f.options);
      await entered.promise;
      f.controller.abort();
      expect(await pending).toStrictEqual({
        kind: 'resolution_failed',
        failure: DEADLINE,
      });
      expect(f.call.mock.calls).toStrictEqual([readCall(f)]);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(add).toHaveBeenCalledWith('abort', listener, { once: true });
      expect(remove).toHaveBeenCalledWith('abort', listener);
      f.options.signal.dispatchEvent(new Event('abort'));
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      f.options.signal.removeEventListener('abort', listener);
      add.mockRestore();
      remove.mockRestore();
    }
  });

  it('uses resolved plan version for initial plan lease and retains receipt and report on stage retry', async () => {
    const f = fixture();
    const response = {
      ...f.response,
      plan: { ...f.response.plan, state: 'draft', progress: 0 },
    };
    expect(CmsSchemaDryRunClaimResponseSchema.safeParse(response).success).toBe(
      true,
    );
    f.call.mockImplementation(async (rpc) => {
      if (rpc === RPC.readPlan) return response;
      throw { code: 'DEPENDENCY_UNAVAILABLE', retryable: true };
    });
    expect(await f.worker.process(f.input, f.options)).toStrictEqual(
      processed(f, {
        outcome: 'retry',
        state: 'draft',
        progress: 0,
        reasonCode: 'DEPENDENCY_UNAVAILABLE',
        retryAfterMs: 300_000,
      }),
    );
    expect(f.call.mock.calls).toStrictEqual([
      readCall(f),
      [
        RPC.claimLease,
        {
          migrationPlanId: IDS.plan,
          schemaVersionId: IDS.target,
          expectedVersion: '13',
          cursor: '0',
          leaseOwner: 'claimed-worker',
          workerId: 'claimed-worker',
          leaseDurationMs: 30_000,
          now: '1970-01-01T00:00:01.000Z',
          transformKey: null,
          transformVersion: null,
          compilerHash: 'a'.repeat(64),
          sourceHash: '0'.repeat(64),
          targetHash: 'c'.repeat(64),
        },
        f.options.signal,
      ],
    ]);
  });

  it('independently resolves distinct receipts for the same plan behind explicit barriers', async () => {
    const first = fixture(null, '9223372036854775806');
    const second = fixture();
    const enteredFirst = deferred<void>();
    const enteredSecond = deferred<void>();
    const firstReply = deferred<unknown>();
    const secondReply = deferred<unknown>();
    first.call
      .mockImplementationOnce(() => {
        enteredFirst.complete();
        return firstReply.promise;
      })
      .mockImplementationOnce(() => {
        enteredSecond.complete();
        return secondReply.promise;
      });
    expect(
      CmsSchemaDryRunClaimResponseSchema.safeParse(second.response).success,
    ).toBe(true);
    const one = first.worker.process(first.input, first.options);
    await enteredFirst.promise;
    const two = first.worker.process(second.input, second.options);
    await enteredSecond.promise;
    expect(first.call.mock.calls).toStrictEqual([
      readCall(first),
      readCall(second),
    ]);
    firstReply.complete(second.response);
    expect(await one).toStrictEqual({ kind: 'invalid_resolution' });
    secondReply.complete(second.response);
    expect(await two).toStrictEqual(processed(second));
    expect(first.call.mock.calls).toStrictEqual([
      readCall(first),
      readCall(second),
    ]);
  });
});
