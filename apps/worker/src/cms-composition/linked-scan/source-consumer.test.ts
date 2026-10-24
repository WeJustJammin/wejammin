import { LogEventDetailsSchema } from '@wejammin/observability/logging';
import { describe, expect, it, vi } from 'vitest';

import { CONSUMER_DEADLINE_MS } from '../../event-consumers/types';

import {
  buildScanSourceDependencies,
  IDS,
  PATTERN,
  sourceBody,
  VERSION,
} from './linked-scan.test-support';
import {
  createLinkedScanSourceConsumer,
  isLinkedScanSourceFamily,
  LINKED_SCAN_SOURCE_CONSUMER,
  LINKED_SCAN_SOURCE_EVENT_TYPE,
} from './source-consumer';

const consume = (built: ReturnType<typeof buildScanSourceDependencies>) =>
  createLinkedScanSourceConsumer(built.dependencies);

describe('[P2-S12-AC-212] the producer of the linked-update scan', () => {
  it('consumes exactly cms.pattern.activated.v1 and names its consumer', () => {
    expect(LINKED_SCAN_SOURCE_EVENT_TYPE).toBe('cms.pattern.activated.v1');
    expect(LINKED_SCAN_SOURCE_CONSUMER).toBe(
      'cms.linked-scan.pattern-activated',
    );
    expect(isLinkedScanSourceFamily('cms.pattern.activated.v1')).toBe(true);
    expect(isLinkedScanSourceFamily('cms.pattern.activated.v2')).toBe(true);
    for (const other of [
      'cms.template.activated.v1',
      'cms.schema.activated.v1',
      'cms.pattern.activated',
      'cms.pattern.activated.v1x',
      7,
      null,
    ])
      expect(isLinkedScanSourceFamily(other)).toBe(false);
  });

  it('rereads the committed event and enqueues the typed job with { patternId, patternVersionId } and a null cursor', async () => {
    const built = buildScanSourceDependencies();
    await expect(
      consume(built).process({
        body: sourceBody('cms.pattern.activated.v1'),
        attempts: 1,
      }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(built.resolveEvent).toHaveBeenCalledWith(
      IDS.event,
      expect.any(AbortSignal),
    );
    expect(built.queue.sent).toEqual([
      {
        jobType: 'cms.pattern.linked_update_scan',
        schemaVersion: 1,
        payload: { patternId: PATTERN, patternVersionId: VERSION },
        cursor: null,
        correlationId: IDS.correlation,
      },
    ]);
    expect(built.logs).toHaveLength(1);
    expect(built.logs[0]).toMatchObject({
      level: 'info',
      details: {
        eventName: 'cms.linked_update_scan_source',
        operation: 'enqueue',
        consumer: 'cms.linked-scan.pattern-activated',
        outcome: 'success',
        correlationId: IDS.correlation,
        traceId: IDS.event,
        retryable: false,
        metrics: { 'cms.linked_scan.enqueue.total': 1 },
        traceSteps: ['cms.composition.consumer_refetch'],
      },
    });
    expect(
      LogEventDetailsSchema.safeParse(built.logs[0]?.details).success,
    ).toBe(true);
  });

  it('leaves an event the database cannot resolve to the editorial consumer, which owns its dead letter', async () => {
    const built = buildScanSourceDependencies({ resolution: { found: false } });
    await expect(
      consume(built).process({
        body: sourceBody('cms.pattern.activated.v1'),
        attempts: 1,
      }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(built.queue.sent).toEqual([]);
    expect(built.logs[0]).toMatchObject({
      level: 'warn',
      details: { outcome: 'failure', errorCode: 'SOURCE_RECORD_NOT_FOUND' },
    });
  });

  it.each([
    [
      'an unknown event version',
      sourceBody('cms.pattern.activated.v1', { schemaVersion: 2 }),
    ],
    ['a body that is not an envelope', 'event'],
    ['an envelope of another family', sourceBody('cms.template.activated.v1')],
    [
      'an envelope with a stray member',
      sourceBody('cms.pattern.activated.v1', { content: 'x' }),
    ],
    ['a job message', { jobType: 'cms.pattern.linked_update_scan' }],
  ])('ignores %s without a database call', async (_name, body) => {
    const built = buildScanSourceDependencies();
    await expect(
      consume(built).process({ body, attempts: 1 }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(built.resolveEvent).not.toHaveBeenCalled();
    expect(built.queue.sent).toEqual([]);
    expect(built.logs).toEqual([]);
  });

  it('retries on the 15 second ladder when the event cannot be read, enqueueing nothing', async () => {
    const built = buildScanSourceDependencies({
      resolution: new Error('rpc down'),
    });
    await expect(
      consume(built).process({
        body: sourceBody('cms.pattern.activated.v1'),
        attempts: 1,
      }),
    ).resolves.toEqual({ outcome: 'retry', delaySeconds: 15 });
    expect(built.queue.sent).toEqual([]);
    expect(built.logs[0]).toMatchObject({
      level: 'warn',
      details: {
        outcome: 'retry',
        errorCode: 'EVENT_READ_FAILED',
        retryable: true,
      },
    });
  });

  it('retries on the 60 second ladder when the job cannot be enqueued', async () => {
    const built = buildScanSourceDependencies({ queueFails: true });
    await expect(
      consume(built).process({
        body: sourceBody('cms.pattern.activated.v1'),
        attempts: 2,
      }),
    ).resolves.toEqual({ outcome: 'retry', delaySeconds: 60 });
    expect(built.logs[0]).toMatchObject({
      level: 'warn',
      details: { outcome: 'retry', errorCode: 'LINKED_SCAN_ENQUEUE_FAILED' },
    });
  });

  it('adds the bounded jitter to the ladder', async () => {
    const built = buildScanSourceDependencies({
      queueFails: true,
      random: () => 0.5,
    });
    await expect(
      consume(built).process({
        body: sourceBody('cms.pattern.activated.v1'),
        attempts: 2,
      }),
    ).resolves.toEqual({ outcome: 'retry', delaySeconds: 63 });
  });

  it('runs with the default clock and logs no identifier of a pattern', async () => {
    const built = buildScanSourceDependencies({ withClock: false });
    await consume(built).process({
      body: sourceBody('cms.pattern.activated.v1'),
      attempts: 1,
    });
    expect(built.logs[0]?.details.durationMs).toBeGreaterThanOrEqual(0);
    const serialized = JSON.stringify(built.logs);
    expect(serialized).not.toContain(PATTERN);
    expect(serialized).not.toContain(VERSION);
  });

  /*
   * Review V6-13 (surviving mutants): the options of every event and the deadline signal of the event read.
   */
  it('writes every event with the always-sample class, high-risk exactly when the outcome is not a success', async () => {
    const success = buildScanSourceDependencies();
    await consume(success).process({
      body: sourceBody('cms.pattern.activated.v1'),
      attempts: 1,
    });
    const missing = buildScanSourceDependencies({
      resolution: { found: false },
    });
    await consume(missing).process({
      body: sourceBody('cms.pattern.activated.v1'),
      attempts: 1,
    });
    const readFailed = buildScanSourceDependencies({
      resolution: new Error('rpc down'),
    });
    await consume(readFailed).process({
      body: sourceBody('cms.pattern.activated.v1'),
      attempts: 1,
    });
    const enqueueFailed = buildScanSourceDependencies({ queueFails: true });
    await consume(enqueueFailed).process({
      body: sourceBody('cms.pattern.activated.v1'),
      attempts: 1,
    });
    expect(success.logs[0]).toMatchObject({
      level: 'info',
      options: { samplingClass: 'always', highRisk: false },
    });
    expect(missing.logs[0]).toMatchObject({
      level: 'warn',
      options: { samplingClass: 'always', highRisk: true },
    });
    expect(readFailed.logs[0]).toMatchObject({
      level: 'warn',
      options: { samplingClass: 'always', highRisk: true },
    });
    expect(enqueueFailed.logs[0]).toMatchObject({
      level: 'warn',
      options: { samplingClass: 'always', highRisk: true },
    });
  });

  it('rereads the event under the BE00 deadline: the signal it receives aborts at 15 seconds and not before', async () => {
    vi.useFakeTimers();
    try {
      const built = buildScanSourceDependencies();
      let seen: AbortSignal | undefined;
      const resolveEvent = vi.fn(
        async (_eventId: string, signal: AbortSignal) => {
          seen = signal;
          await new Promise<void>((resolve) =>
            signal.addEventListener('abort', () => resolve(), { once: true }),
          );
          return {
            found: true,
            patternId: PATTERN,
            patternVersionId: VERSION,
          } as const;
        },
      );
      const consumer = createLinkedScanSourceConsumer({
        ...built.dependencies,
        resolveEvent,
      });
      const pending = consumer.process({
        body: sourceBody('cms.pattern.activated.v1'),
        attempts: 1,
      });
      await vi.advanceTimersByTimeAsync(CONSUMER_DEADLINE_MS - 1);
      expect(seen?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(seen?.aborted).toBe(true);
      await expect(pending).resolves.toEqual({ outcome: 'ack' });
    } finally {
      vi.useRealTimers();
    }
  });
});
