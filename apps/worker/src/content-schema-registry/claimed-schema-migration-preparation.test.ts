import { describe, expect, it, vi } from 'vitest';

import {
  ACQUIRED,
  CAUSE,
  DEADLINE,
  deferred,
  fixture,
  FOREIGN,
  ORIGINAL,
  PRECLAIM,
  preserve,
  processed,
  readCall,
} from './claimed-schema-migration-preparation-test-support';
import { SCHEMA_MIGRATION_RPC as RPC } from './migration-worker-constants';
import { CmsSchemaDryRunClaimResponseSchema } from './schema-dry-run-claim-response';
import { IDS } from './schema-dry-run-claim-response-test-support';

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
      const unchanged = preserve(f);
      expect(await f.worker.process(f.input, f.options)).toStrictEqual({
        kind: 'invalid_claim',
      });
      expect(f.call.mock.calls).toStrictEqual([]);
      expect(f.telemetry.mock.calls).toStrictEqual([]);
      unchanged();
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
      const unchanged = preserve(f, value);
      expect(await f.worker.process(f.input, f.options)).toStrictEqual({
        kind: 'invalid_resolution',
      });
      expect(f.call.mock.calls).toStrictEqual([readCall(f)]);
      expect(f.telemetry.mock.calls).toStrictEqual([]);
      unchanged();
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
    const unchanged = preserve(f, value);
    expect(await f.worker.process(f.input, f.options)).toStrictEqual({
      kind: 'invalid_resolution',
    });
    expect(f.call.mock.calls).toStrictEqual([readCall(f)]);
    expect(f.telemetry.mock.calls).toStrictEqual([]);
    unchanged();
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
      const unchanged = preserve(f, error);
      expect(await f.worker.process(f.input, f.options)).toStrictEqual({
        kind: 'resolution_failed',
        failure,
      });
      expect(f.call.mock.calls).toStrictEqual([readCall(f)]);
      expect(f.telemetry.mock.calls).toStrictEqual([]);
      unchanged();
    },
  );

  it('preserves a pre-aborted invocation as retryable deadline failure without calling the port', async () => {
    const f = fixture();
    f.controller.abort();
    const unchanged = preserve(f);
    expect(await f.worker.process(f.input, f.options)).toStrictEqual({
      kind: 'resolution_failed',
      failure: DEADLINE,
    });
    expect(f.call.mock.calls).toStrictEqual([]);
    expect(f.telemetry.mock.calls).toStrictEqual([]);
    unchanged();
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
    const unchanged = preserve(f, DEADLINE);
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
      unchanged();
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
    const unchanged = preserve(f, response);
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
    unchanged();
  });

  it('independently resolves distinct receipts for the same plan behind explicit barriers', async () => {
    const first = fixture(null, '9223372036854775806');
    const second = fixture(null, ACQUIRED, FOREIGN);
    expect(first.input.claimedLease.version).not.toBe(
      second.input.claimedLease.version,
    );
    expect(first.input.claimedLease.leaseToken).not.toBe(
      second.input.claimedLease.leaseToken,
    );
    expect(second.request.claimedJob).toStrictEqual({
      jobId: IDS.job,
      version: ACQUIRED,
      leaseToken: FOREIGN,
    });
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
    const firstUnchanged = preserve(first, second.response);
    const secondUnchanged = preserve(second);
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
    firstUnchanged();
    secondReply.complete(second.response);
    expect(await two).toStrictEqual(processed(second));
    expect(first.call.mock.calls).toStrictEqual([
      readCall(first),
      readCall(second),
    ]);
    firstUnchanged();
    secondUnchanged();
  });
});
