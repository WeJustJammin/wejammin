/**
 * The dispatcher guard of `cms.taxonomy.merge_converge` (effect not wired, effect threw, answer outside the closed
 * disposition set) settles the job `failed` without the effect's own telemetry, so the guard emits the same
 * `cms_taxonomy_merge_converge.settled` event and `cms_taxonomy_merge_total{outcome="failed"}` metric the effect's own
 * failures carry (runbook alert trigger: any `outcome="failed"`; lane taxonomy-terms f2, review n-f1).
 */
import type { JobEffectInput, JobEffectResult } from '@wejammin/application';
import { createLogger, type Logger } from '@wejammin/observability/logging';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AsyncWorkerBindings } from './async-entrypoint';
import type { JobEffectDeliveryContext } from './async-runtime-job-context';
import { createProductionJobEffectDispatcher } from './production-job-effect-dispatcher';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const CORRELATION_ID = '33333333-3333-4333-8333-333333333333';
const TOKEN = '44444444-4444-4444-8444-444444444444';
const TYPE = 'cms.taxonomy.merge_converge';
const input = (type = TYPE): JobEffectInput => ({
  job: { id: JOB_ID, type, state: 'queued', version: '1', leaseUntilMs: null },
  envelope: {
    aggregateId: JOB_ID,
    aggregateType: 'job',
    aggregateVersion: '1',
    causationId: null,
    correlationId: CORRELATION_ID,
    eventId: '22222222-2222-4222-8222-222222222222',
    eventType: 'job.requested',
    schemaVersion: 1,
  },
  leaseToken: TOKEN,
});
const context = (deliveryAttempt = 3): JobEffectDeliveryContext => ({
  env: { APP_ENVIRONMENT: 'staging' } as unknown as AsyncWorkerBindings,
  signal: new AbortController().signal,
  deliveryAttempt,
});
const sink = () => {
  const lines: string[] = [];
  const logger = createLogger(
    { environment: 'staging', release: 'local', service: 'test' },
    { sink: (line) => lines.push(line) },
  );
  return {
    logger,
    events: () => lines.map((l) => JSON.parse(l) as Record<string, unknown>),
  };
};
const failedEvent = (errorCode: string) => ({
  severity: 'ERROR',
  eventName: 'cms_taxonomy_merge_converge.settled',
  operation: 'cms_taxonomy_merge_converge',
  outcome: 'failure',
  errorCode,
  retryable: false,
  jobId: JOB_ID,
  correlationId: CORRELATION_ID,
  attempt: 3,
  metrics: { 'cms_taxonomy_merge_total{outcome="failed"}': 1 },
});
const succeeded: JobEffectResult = {
  state: 'succeeded',
  errorCode: null,
  resultRef: { type: TYPE, id: JOB_ID },
};

describe('merge-converge dispatcher guard telemetry', () => {
  it('an effect that is not wired logs one failed event', async () => {
    const { logger, events } = sink();
    const result = await createProductionJobEffectDispatcher({
      taxonomyMergeLogger: logger,
    })(input(), undefined, context());
    expect(result).toMatchObject({
      state: 'failed',
      errorCode: 'DEPENDENCY_UNAVAILABLE',
    });
    expect(events()).toHaveLength(1);
    expect(events()[0]).toMatchObject(failedEvent('DEPENDENCY_UNAVAILABLE'));
  });

  it('an effect that throws logs one failed event', async () => {
    const { logger, events } = sink();
    const result = await createProductionJobEffectDispatcher({
      taxonomyMergeLogger: logger,
      convergeTaxonomyMerge: async () => {
        throw new Error('boom with a private value');
      },
    })(input(), undefined, context());
    expect(result).toMatchObject({ errorCode: 'DEPENDENCY_UNAVAILABLE' });
    expect(events()).toHaveLength(1);
    expect(events()[0]).toMatchObject(failedEvent('DEPENDENCY_UNAVAILABLE'));
    // The thrown message is never logged.
    expect(JSON.stringify(events())).not.toContain('private value');
  });

  it.each([
    ['queued', { state: 'queued', errorCode: 'X', resultRef: null }],
    ['a non-object', 'x'],
    ['null', null],
    [
      'a succeeded job without a result reference',
      { state: 'succeeded', errorCode: null, resultRef: null },
    ],
  ])(
    'an answer outside the disposition set (%s) logs one failed event with the unmapped code',
    async (_name, answer) => {
      const { logger, events } = sink();
      const result = await createProductionJobEffectDispatcher({
        taxonomyMergeLogger: logger,
        convergeTaxonomyMerge: async () => answer as never,
      })(input(), undefined, context());
      expect(result).toMatchObject({
        errorCode: 'MERGE_CONVERGE_OUTCOME_UNMAPPED',
      });
      expect(events()).toHaveLength(1);
      expect(events()[0]).toMatchObject(
        failedEvent('MERGE_CONVERGE_OUTCOME_UNMAPPED'),
      );
    },
  );

  it('a valid answer from the effect adds no dispatcher event (the effect logged its own)', async () => {
    const { logger, events } = sink();
    const dispatch = createProductionJobEffectDispatcher({
      taxonomyMergeLogger: logger,
      convergeTaxonomyMerge: async () => succeeded,
    });
    expect(await dispatch(input(), undefined, context())).toBe(succeeded);
    const failedAnswer = {
      state: 'failed',
      errorCode: 'CAPABILITY_MISSING',
      resultRef: null,
    };
    expect(
      await createProductionJobEffectDispatcher({
        taxonomyMergeLogger: logger,
        convergeTaxonomyMerge: async () => failedAnswer as never,
      })(input(), undefined, context()),
    ).toEqual(failedAnswer);
    expect(events()).toHaveLength(0);
  });

  it('no Worker context: the delivery counts as attempt 1 and the injected logger still hears it', async () => {
    const { logger, events } = sink();
    await createProductionJobEffectDispatcher({ taxonomyMergeLogger: logger })(
      input(),
    );
    expect(events()).toHaveLength(1);
    expect(events()[0]).toMatchObject({
      ...failedEvent('DEPENDENCY_UNAVAILABLE'),
      attempt: 1,
    });
  });

  describe('production composition (no injected logger)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });
    // Production never injects `taxonomyMergeLogger` (production-async-entrypoint.ts), so the guard must reach the
    // Worker-environment logger through `context.env`; the default sink is `console.info`.
    const productionContext = (): JobEffectDeliveryContext => ({
      ...context(),
      env: {
        APP_ENVIRONMENT: 'staging',
        APP_RELEASE: 'local',
      } as unknown as AsyncWorkerBindings,
    });

    it.each([
      ['an effect that is not wired', {}, 'DEPENDENCY_UNAVAILABLE'],
      [
        'an effect that throws',
        {
          convergeTaxonomyMerge: async (): Promise<JobEffectResult> => {
            throw new Error('boom');
          },
        },
        'DEPENDENCY_UNAVAILABLE',
      ],
      [
        'an answer outside the disposition set',
        { convergeTaxonomyMerge: async () => null as never },
        'MERGE_CONVERGE_OUTCOME_UNMAPPED',
      ],
    ])(
      '%s logs one failed event through the Worker-environment logger',
      async (_name, dependencies, errorCode) => {
        const info = vi
          .spyOn(console, 'info')
          .mockImplementation(() => undefined);
        const result = await createProductionJobEffectDispatcher(dependencies)(
          input(),
          undefined,
          productionContext(),
        );
        expect(result).toMatchObject({ state: 'failed', errorCode });
        expect(info).toHaveBeenCalledTimes(1);
        expect(info.mock.calls[0]?.[0]).toMatchObject({
          ...failedEvent(errorCode),
          environment: 'staging',
          release: 'local',
          service: 'wejammin-cms-taxonomy-merge',
        });
        expect(JSON.stringify(info.mock.calls)).not.toContain(TOKEN);
      },
    );
  });

  it('no logger and no environment: the disposition is unchanged and nothing throws', async () => {
    expect(
      await createProductionJobEffectDispatcher({})(input()),
    ).toMatchObject({ state: 'failed', errorCode: 'DEPENDENCY_UNAVAILABLE' });
  });

  it('a logger that throws never changes the disposition', async () => {
    const broken = {
      error: () => {
        throw new Error('sink down');
      },
      info: () => {
        throw new Error('sink down');
      },
    } as unknown as Logger;
    expect(
      await createProductionJobEffectDispatcher({
        taxonomyMergeLogger: broken,
      })(input(), undefined, context()),
    ).toMatchObject({ state: 'failed', errorCode: 'DEPENDENCY_UNAVAILABLE' });
  });

  it('other job types never log a merge event', async () => {
    const { logger, events } = sink();
    const dispatch = createProductionJobEffectDispatcher({
      taxonomyMergeLogger: logger,
    });
    await dispatch(input('object.verify'), undefined, context());
    await dispatch(input('unknown.type'), undefined, context());
    expect(events()).toHaveLength(0);
  });

  it('never logs the lease token', async () => {
    const { logger, events } = sink();
    await createProductionJobEffectDispatcher({
      taxonomyMergeLogger: logger,
    })(input(), undefined, context());
    expect(events()).toHaveLength(1);
    expect(JSON.stringify(events())).not.toContain(TOKEN);
  });
});
