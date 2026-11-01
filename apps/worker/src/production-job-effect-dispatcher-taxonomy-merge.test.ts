/**
 * The dispatcher's `cms.taxonomy.merge_converge` seam (BE03c 1334; lane taxonomy-terms f2): the Worker-layer delivery
 * context reaches the merge callback and nothing else, the callback receives no lease control (the consumer opens one
 * for the CMS dry-run only), and the family settles the job `succeeded` or `failed` only: a `queued` answer would be
 * parked for good (the redelivered envelope is stale once the claim advanced the job) and manual review leaves the job
 * `running`.
 */
import type { JobEffectInput, JobEffectResult } from '@wejammin/application';
import { describe, expect, it, vi } from 'vitest';

import type { AsyncWorkerBindings } from './async-entrypoint';
import type { JobEffectDeliveryContext } from './async-runtime-job-context';
import {
  createProductionJobEffectDispatcher,
  type ProductionJobEffectDependencies,
} from './production-job-effect-dispatcher';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const TYPE = 'cms.taxonomy.merge_converge';
const input = (type = TYPE): JobEffectInput => ({
  job: { id: JOB_ID, type, state: 'queued', version: '1', leaseUntilMs: null },
  envelope: {
    aggregateId: JOB_ID,
    aggregateType: 'job',
    aggregateVersion: '1',
    causationId: null,
    correlationId: '33333333-3333-4333-8333-333333333333',
    eventId: '22222222-2222-4222-8222-222222222222',
    eventType: 'job.requested',
    schemaVersion: 1,
  },
  leaseToken: '44444444-4444-4444-8444-444444444444',
});
const context = (deliveryAttempt = 1): JobEffectDeliveryContext => ({
  env: { APP_ENVIRONMENT: 'production' } as unknown as AsyncWorkerBindings,
  signal: new AbortController().signal,
  deliveryAttempt,
});
type Converge = NonNullable<
  ProductionJobEffectDependencies['convergeTaxonomyMerge']
>;
const succeeded: JobEffectResult = {
  state: 'succeeded',
  errorCode: null,
  resultRef: { type: TYPE, id: JOB_ID },
};
const unmapped = {
  state: 'failed',
  errorCode: 'MERGE_CONVERGE_OUTCOME_UNMAPPED',
  resultRef: null,
};
const unavailable = {
  state: 'failed',
  errorCode: 'DEPENDENCY_UNAVAILABLE',
  resultRef: null,
};

describe('merge-converge dispatch', () => {
  it('forwards the original input and the delivery context to the merge callback only', async () => {
    const convergeTaxonomyMerge = vi.fn<Converge>(async () => succeeded);
    const verifyObject = vi.fn(async () => succeeded);
    const prepareSchemaDryRun = vi.fn(async () => succeeded);
    const dispatch = createProductionJobEffectDispatcher({
      convergeTaxonomyMerge,
      verifyObject,
      prepareSchemaDryRun,
    });
    const request = input();
    const ctx = context(3);
    expect(await dispatch(request, undefined, ctx)).toBe(succeeded);
    expect(convergeTaxonomyMerge.mock.calls).toEqual([[request, ctx]]);
    expect(convergeTaxonomyMerge.mock.calls[0]?.[0]).toBe(request);
    expect(convergeTaxonomyMerge.mock.calls[0]?.[1]).toBe(ctx);
    expect(verifyObject).not.toHaveBeenCalled();
    expect(prepareSchemaDryRun).not.toHaveBeenCalled();
  });

  it('no other effect ever receives the merge callback or the context', async () => {
    const convergeTaxonomyMerge = vi.fn<Converge>(async () => succeeded);
    const verifyObject = vi.fn(async () => succeeded);
    const dispatch = createProductionJobEffectDispatcher({
      convergeTaxonomyMerge,
      verifyObject,
    });
    await dispatch(input('object.verify'), undefined, context());
    expect(convergeTaxonomyMerge).not.toHaveBeenCalled();
    expect(verifyObject.mock.calls[0]).toHaveLength(1);
  });

  it('an unconfigured callback fails the job (never manual review, never queued)', async () => {
    expect(
      await createProductionJobEffectDispatcher({})(
        input(),
        undefined,
        context(),
      ),
    ).toEqual(unavailable);
    expect(
      await createProductionJobEffectDispatcher({
        verifyObject: async () => succeeded,
      })(input(), undefined, context()),
    ).toEqual(unavailable);
  });

  it('a callback that throws fails the job', async () => {
    const dispatch = createProductionJobEffectDispatcher({
      convergeTaxonomyMerge: async () => {
        throw new Error('boom');
      },
    });
    expect(await dispatch(input(), undefined, context())).toEqual(unavailable);
  });

  it.each([
    [
      'queued',
      { state: 'queued', errorCode: 'DEPENDENCY_UNAVAILABLE', resultRef: null },
    ],
    [
      'pending_manual_review',
      { state: 'pending_manual_review', errorCode: 'X', resultRef: null },
    ],
    ['cancelled', { state: 'cancelled', errorCode: 'X', resultRef: null }],
    ['an unknown state', { state: 'weird', errorCode: null, resultRef: null }],
    ['a non-object', 'x'],
    ['null', null],
    [
      'an invalid error code',
      { state: 'failed', errorCode: 'lower', resultRef: null },
    ],
    [
      'a succeeded job without a result reference',
      { state: 'succeeded', errorCode: null, resultRef: null },
    ],
    [
      'a succeeded job with an error code',
      {
        state: 'succeeded',
        errorCode: 'X',
        resultRef: { type: TYPE, id: JOB_ID },
      },
    ],
    [
      'a failed job with a result reference',
      {
        state: 'failed',
        errorCode: 'X',
        resultRef: { type: TYPE, id: JOB_ID },
      },
    ],
    [
      'a result reference that is not a UUID',
      {
        state: 'succeeded',
        errorCode: null,
        resultRef: { type: TYPE, id: 'abc' },
      },
    ],
    [
      'a result reference with another member',
      {
        state: 'succeeded',
        errorCode: null,
        resultRef: { type: TYPE, id: JOB_ID, extra: 1 },
      },
    ],
  ])('%s is settled as the unmapped failure', async (_name, answer) => {
    const dispatch = createProductionJobEffectDispatcher({
      convergeTaxonomyMerge: async () => answer as never,
    });
    expect(await dispatch(input(), undefined, context())).toEqual(unmapped);
  });

  it('a failed answer passes through with its code and no result reference', async () => {
    const answer = {
      state: 'failed',
      errorCode: 'CAPABILITY_MISSING',
      resultRef: null,
    };
    const dispatch = createProductionJobEffectDispatcher({
      convergeTaxonomyMerge: async () => answer as never,
    });
    expect(await dispatch(input(), undefined, context())).toEqual(answer);
  });

  it('answers the same on every delivery number (there is no queued backstop to apply)', async () => {
    const dispatch = createProductionJobEffectDispatcher({
      convergeTaxonomyMerge: async () => succeeded,
    });
    for (const attempt of [1, 2, 3, 4, 5])
      expect(await dispatch(input(), undefined, context(attempt))).toBe(
        succeeded,
      );
  });
});
