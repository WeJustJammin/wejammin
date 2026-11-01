/**
 * The dispatcher's CMS preparation seam on the Job path (DEC-183 / DEC-184, tracked boundary #128): the
 * Worker-layer delivery context reaches the preparation callback and nothing else, and an unavailable
 * callback returns the Job to queued (failed on the last delivery) instead of parking it in manual review.
 */
import type {
  CmsLeaseControl,
  JobEffectInput,
  JobEffectResult,
} from '@wejammin/application';
import { describe, expect, it, vi } from 'vitest';

import type { AsyncWorkerBindings } from './async-entrypoint';
import type { JobEffectDeliveryContext } from './async-runtime-job-context';
import {
  createProductionJobEffectDispatcher,
  type ProductionJobEffectDependencies,
} from './production-job-effect-dispatcher';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const input = (type: string): JobEffectInput => ({
  job: { id: JOB_ID, type, state: 'running', version: '19', leaseUntilMs: 1 },
  envelope: {
    aggregateId: JOB_ID,
    aggregateType: 'job',
    aggregateVersion: '3',
    causationId: null,
    correlationId: '33333333-3333-4333-8333-333333333333',
    eventId: '22222222-2222-4222-8222-222222222222',
    eventType: 'job.requested',
    schemaVersion: 1,
  },
  leaseToken: '44444444-4444-4444-8444-444444444444',
});
const context = (deliveryAttempt: number): JobEffectDeliveryContext => ({
  env: { APP_ENVIRONMENT: 'production' } as unknown as AsyncWorkerBindings,
  signal: new AbortController().signal,
  deliveryAttempt,
});
const control: CmsLeaseControl = {
  checkpoint: async () => ({ kind: 'lost' }),
};
const succeeded: JobEffectResult = {
  state: 'succeeded',
  errorCode: null,
  resultRef: null,
};
type Prepare = NonNullable<
  ProductionJobEffectDependencies['prepareSchemaDryRun']
>;
const queuedUnavailable = {
  state: 'queued',
  errorCode: 'DEPENDENCY_UNAVAILABLE',
  resultRef: null,
};
const exhausted = {
  state: 'failed',
  errorCode: 'MIGRATION_RETRIES_EXHAUSTED',
  resultRef: null,
};

describe('[P2-S12-AC-050] CMS preparation delivery context (DEC-184)', () => {
  it('forwards the original input, the lease control and the delivery context, in that order, to the preparation callback only', async () => {
    const prepareSchemaDryRun = vi.fn<Prepare>(async () => succeeded);
    const verifyObject = vi.fn(async () => succeeded);
    const dispatch = createProductionJobEffectDispatcher({
      prepareSchemaDryRun,
      verifyObject,
    });
    const request = input('cms.schema.dry_run');
    const ctx = context(2);

    expect(await dispatch(request, control, ctx)).toBe(succeeded);

    expect(prepareSchemaDryRun.mock.calls).toEqual([[request, control, ctx]]);
    expect(prepareSchemaDryRun.mock.calls[0]?.[0]).toBe(request);
    expect(prepareSchemaDryRun.mock.calls[0]?.[1]).toBe(control);
    expect(prepareSchemaDryRun.mock.calls[0]?.[2]).toBe(ctx);
    expect(verifyObject).not.toHaveBeenCalled();
  });

  it('forwards a context without a lease control as an explicit undefined second argument', async () => {
    const prepareSchemaDryRun = vi.fn<Prepare>(async () => succeeded);
    const dispatch = createProductionJobEffectDispatcher({
      prepareSchemaDryRun,
    });
    const ctx = context(1);

    await dispatch(input('cms.schema.dry_run'), undefined, ctx);

    expect(prepareSchemaDryRun.mock.calls[0]).toHaveLength(3);
    expect(prepareSchemaDryRun.mock.calls[0]?.[1]).toBeUndefined();
    expect(prepareSchemaDryRun.mock.calls[0]?.[2]).toBe(ctx);
  });

  it.each(['object.verify', 'platform.object.verify'])(
    '%s verification never sees the lease control or the delivery context',
    async (type) => {
      const verifyObject = vi.fn(async () => succeeded);
      const prepareSchemaDryRun = vi.fn(async () => succeeded);
      const dispatch = createProductionJobEffectDispatcher({
        prepareSchemaDryRun,
        verifyObject,
      });
      const request = input(type);

      await dispatch(request, control, context(1));

      expect(verifyObject.mock.calls).toEqual([[request]]);
      expect(verifyObject.mock.calls[0]).toHaveLength(1);
      expect(prepareSchemaDryRun).not.toHaveBeenCalled();
    },
  );

  it.each([1, 2, 3])(
    'an unavailable callback on delivery %s returns the Job to queued',
    async (deliveryAttempt) => {
      const dispatch = createProductionJobEffectDispatcher({
        prepareSchemaDryRun: async () => {
          throw new Error('controlled failure');
        },
      });
      expect(
        await dispatch(
          input('cms.schema.dry_run'),
          control,
          context(deliveryAttempt),
        ),
      ).toEqual(queuedUnavailable);
    },
  );

  it.each([4, 5, 9])(
    'an unavailable callback on delivery %s fails the Job as retries exhausted',
    async (deliveryAttempt) => {
      const dispatch = createProductionJobEffectDispatcher({
        prepareSchemaDryRun: async () => {
          throw new Error('controlled failure');
        },
      });
      expect(
        await dispatch(
          input('cms.schema.dry_run'),
          control,
          context(deliveryAttempt),
        ),
      ).toEqual(exhausted);
    },
  );

  it.each([
    ['an absent dependency container', undefined],
    [
      'a malformed result',
      { state: 'running', errorCode: null, resultRef: null },
    ],
  ])(
    '%s on the last delivery fails the Job as retries exhausted',
    async (_label, bad) => {
      const dispatch = createProductionJobEffectDispatcher(
        bad === undefined
          ? undefined
          : {
              prepareSchemaDryRun: (async () =>
                bad) as unknown as () => Promise<JobEffectResult>,
            },
      );
      expect(
        await dispatch(input('cms.schema.dry_run'), control, context(4)),
      ).toEqual(exhausted);
    },
  );

  it('treats a malformed delivery number as the first delivery', async () => {
    const dispatch = createProductionJobEffectDispatcher({
      prepareSchemaDryRun: async () => {
        throw new Error('controlled failure');
      },
    });
    const ctx = { ...context(1), deliveryAttempt: Number.NaN };
    expect(await dispatch(input('cms.schema.dry_run'), control, ctx)).toEqual(
      queuedUnavailable,
    );
  });

  it('leaves a successful or failed callback result untouched on the last delivery', async () => {
    const failedResult = {
      state: 'failed',
      errorCode: 'MIGRATION_BLOCKED',
      resultRef: null,
    } as const;
    const dispatch = createProductionJobEffectDispatcher({
      prepareSchemaDryRun: async () => failedResult,
    });
    expect(
      await dispatch(input('cms.schema.dry_run'), control, context(4)),
    ).toBe(failedResult);
  });

  it.each([
    ['a progress continuation', null],
    ['a retry disposition', 'LEASE_UNAVAILABLE'],
  ])(
    'backstop: %s returned by the callback on the last delivery is failed as retries exhausted',
    async (_label, errorCode) => {
      const dispatch = createProductionJobEffectDispatcher({
        prepareSchemaDryRun: async () => ({
          state: 'queued',
          errorCode,
          resultRef: null,
        }),
      });
      expect(
        await dispatch(input('cms.schema.dry_run'), control, context(4)),
      ).toEqual(exhausted);
      expect(
        await dispatch(input('cms.schema.dry_run'), control, context(3)),
      ).toEqual({ state: 'queued', errorCode, resultRef: null });
    },
  );

  it('forwards the lease control alone, with no explicit context argument, when the Job path supplied no context', async () => {
    const prepareSchemaDryRun = vi.fn<Prepare>(async () => succeeded);
    const dispatch = createProductionJobEffectDispatcher({
      prepareSchemaDryRun,
    });
    const request = input('cms.schema.dry_run');

    await dispatch(request, control);

    expect(prepareSchemaDryRun.mock.calls[0]).toHaveLength(2);
    expect(prepareSchemaDryRun.mock.calls[0]?.[1]).toBe(control);
  });
});
