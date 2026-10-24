import { LogEventDetailsSchema } from '@wejammin/observability/logging';
import { describe, expect, it, vi } from 'vitest';

import { CMS_SLICE_12_METRICS } from '../observability-registry';
import { metricKeyConforms } from '../observability-registry';
import {
  buildGovernedSourceDependencies,
  fakeGovernedQueue,
  governedJobBody,
  governedRunResult,
  IDS,
  NOW,
  recordingTelemetry,
  sourceBody,
} from './governed-recheck.test-support';
import { createGovernedRecheckJob } from './job';
import { createGovernedRecheckSourceConsumers } from './source-consumers';

/*
 * [P2-S12-AC-263] [P2-S12-AC-264] The governed recheck consumers are the "consumer refetch" stage of the BE03c
 * trace chain (they reread the committed event or rebuild every review from canonical state), and the job's
 * invalidation counters stay inside the registry.
 */

const STEP = 'cms.composition.consumer_refetch';

describe('governed recheck consumer traces', () => {
  it('lists the consumer refetch step on every event the source consumers emit', async () => {
    for (const resolve of ['found', 'missing', 'throws'] as const) {
      const built = buildGovernedSourceDependencies(
        resolve === 'found' ? {} : {},
        'content_type',
      );
      if (resolve === 'missing')
        built.resolveEvent.mockResolvedValueOnce({ found: false } as never);
      if (resolve === 'throws')
        built.resolveEvent.mockRejectedValueOnce(new Error('private'));
      await createGovernedRecheckSourceConsumers(built.dependencies)[
        'cms.schema.activated.v1'
      ].process({ body: sourceBody('cms.schema.activated.v1'), attempts: 1 });
      expect(built.logs).toHaveLength(1);
      expect(built.logs[0]?.details.traceSteps).toEqual([STEP]);
      expect(
        LogEventDetailsSchema.safeParse(built.logs[0]?.details).success,
      ).toBe(true);
    }
  });

  it('lists the consumer refetch and RPC steps on the job event of a finished walk', async () => {
    const { logs, telemetry } = recordingTelemetry();
    const job = createGovernedRecheckJob({
      run: vi.fn(async () => governedRunResult()),
      queue: fakeGovernedQueue().queue,
      telemetry,
      clock: { now: () => NOW, randomUuid: () => IDS.request },
    });
    await job.process({ body: governedJobBody(), attempts: 1 });
    expect(logs[0]?.details.traceSteps).toEqual([STEP, 'cms.composition.rpc']);
  });

  it('lists no trace step for an envelope rejected before any refetch', async () => {
    const { logs, telemetry } = recordingTelemetry();
    const job = createGovernedRecheckJob({
      run: vi.fn(async () => governedRunResult()),
      queue: fakeGovernedQueue().queue,
      telemetry,
    });
    await job.process({ body: { jobType: 'wrong' }, attempts: 1 });
    expect(logs[0]?.details.traceSteps).toBeUndefined();
  });

  it('keeps every job metric inside the registry: the invalidation reasons are closed', async () => {
    const { logs, telemetry } = recordingTelemetry();
    const job = createGovernedRecheckJob({
      run: vi.fn(async () => governedRunResult()),
      queue: fakeGovernedQueue().queue,
      telemetry,
      clock: { now: () => NOW, randomUuid: () => IDS.request },
    });
    await job.process({ body: governedJobBody(), attempts: 1 });
    const keys = Object.keys(
      (logs[0]?.details.metrics ?? {}) as Record<string, number>,
    ).filter((key) => key.startsWith('cms_governed_review_invalidated_total'));
    expect(keys.length).toBe(2);
    for (const key of keys) expect(metricKeyConforms(key)).toBe(true);
    expect(Object.keys(CMS_SLICE_12_METRICS)).toContain(
      'cms_governed_review_invalidated_total',
    );
  });
});
