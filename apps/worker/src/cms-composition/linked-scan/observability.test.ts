import { LogEventDetailsSchema } from '@wejammin/observability/logging';
import { describe, expect, it, vi } from 'vitest';

import {
  CMS_SLICE_12_METRICS,
  CMS_SLICE_12_UNEMITTED_METRICS,
  metricKeyConforms,
} from '../observability-registry';
import { createLinkedScanJob } from './job';
import {
  buildScanSourceDependencies,
  fakeScanQueue,
  IDS,
  NOW,
  recordingTelemetry,
  scanJobBody,
  scanRunResult,
  sourceBody,
} from './linked-scan.test-support';
import { createLinkedScanSourceConsumer } from './source-consumer';

/*
 * [P2-S12-AC-263] The scan job lands where cms_pattern_linked_update_pending_total is incremented (BE03c Observability: the counter of
 * pending_diff rows the scan appended), so it leaves the registry's list of metrics with no Worker-observable event; the consumers are
 * the "consumer refetch" stage of the BE03c trace chain.
 */
const STEP = 'cms.composition.consumer_refetch';

describe('linked-update scan observability', () => {
  it('registers the counter label-free and no longer lists it as unemitted', () => {
    expect(Object.keys(CMS_SLICE_12_METRICS)).toContain(
      'cms_pattern_linked_update_pending_total',
    );
    expect(
      CMS_SLICE_12_METRICS.cms_pattern_linked_update_pending_total,
    ).toEqual({});
    expect(
      CMS_SLICE_12_UNEMITTED_METRICS.map((entry) => entry.metric),
    ).not.toContain('cms_pattern_linked_update_pending_total');
  });

  it('emits the counter under a key the registry accepts, and every other job metric outside the Slice 12 registry', async () => {
    const { logs, telemetry } = recordingTelemetry();
    const job = createLinkedScanJob({
      run: vi.fn(async () => scanRunResult()),
      queue: fakeScanQueue().queue,
      telemetry,
      clock: { now: () => NOW, randomUuid: () => IDS.request },
    });
    await job.process({ body: scanJobBody(), attempts: 1 });
    const keys = Object.keys(
      (logs[0]?.details.metrics ?? {}) as Record<string, number>,
    );
    expect(keys).toContain('cms_pattern_linked_update_pending_total');
    expect(metricKeyConforms('cms_pattern_linked_update_pending_total')).toBe(
      true,
    );
    for (const key of keys.filter((candidate) => candidate.startsWith('cms_')))
      expect(metricKeyConforms(key)).toBe(true);
    expect(LogEventDetailsSchema.safeParse(logs[0]?.details).success).toBe(
      true,
    );
  });

  it('lists the consumer refetch step on every event the source consumer emits', async () => {
    for (const resolve of ['found', 'missing', 'throws'] as const) {
      const built = buildScanSourceDependencies();
      if (resolve === 'missing')
        built.resolveEvent.mockResolvedValueOnce({ found: false } as never);
      if (resolve === 'throws')
        built.resolveEvent.mockRejectedValueOnce(new Error('private'));
      await createLinkedScanSourceConsumer(built.dependencies).process({
        body: sourceBody('cms.pattern.activated.v1'),
        attempts: 1,
      });
      expect(built.logs).toHaveLength(1);
      expect(built.logs[0]?.details.traceSteps).toEqual([STEP]);
      expect(
        LogEventDetailsSchema.safeParse(built.logs[0]?.details).success,
      ).toBe(true);
    }
  });

  it('lists the consumer refetch and RPC steps on the job event of a finished walk, and none for a rejected envelope', async () => {
    const { logs, telemetry } = recordingTelemetry();
    const job = createLinkedScanJob({
      run: vi.fn(async () => scanRunResult()),
      queue: fakeScanQueue().queue,
      telemetry,
      clock: { now: () => NOW, randomUuid: () => IDS.request },
    });
    await job.process({ body: scanJobBody(), attempts: 1 });
    await job.process({ body: { jobType: 'wrong' }, attempts: 1 });
    expect(logs[0]?.details.traceSteps).toEqual([STEP, 'cms.composition.rpc']);
    expect(logs[1]?.details.traceSteps).toBeUndefined();
  });
});
