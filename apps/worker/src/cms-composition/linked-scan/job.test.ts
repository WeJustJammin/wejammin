import { LogEventDetailsSchema } from '@wejammin/observability/logging';
import { describe, expect, it, vi } from 'vitest';

import { CONSUMER_DEADLINE_MS } from '../../event-consumers/types';

import { createLinkedScanJob, LINKED_SCAN_JOB_CONSUMER } from './job';
import {
  CURSOR,
  fakeScanQueue,
  IDS,
  NEXT_CURSOR,
  NOW,
  PATTERN,
  recordingTelemetry,
  scanJobBody,
  scanRunResult,
  VERSION,
} from './linked-scan.test-support';

const build = (
  options: Readonly<{
    run?: ReturnType<typeof scanRunResult> | Error;
    queueFails?: boolean;
    withClock?: boolean;
    random?: () => number;
  }> = {},
) => {
  const run = vi.fn(async () => {
    const result = options.run ?? scanRunResult();
    if (result instanceof Error) throw result;
    return result;
  });
  const queue = fakeScanQueue(options.queueFails);
  const { logs, telemetry } = recordingTelemetry();
  const job = createLinkedScanJob({
    run,
    queue: queue.queue,
    telemetry,
    random: options.random ?? (() => 0),
    ...(options.withClock === false
      ? {}
      : { clock: { now: () => NOW, randomUuid: () => IDS.request } }),
  });
  return { job, run, queue, logs };
};

const full = (patch: Partial<ReturnType<typeof scanRunResult>> = {}) =>
  scanRunResult({
    examined: 500,
    appended: 500,
    nextCursor: NEXT_CURSOR,
    ...patch,
  });

describe('[P2-S12-AC-212] the cms.pattern.linked_update_scan job', () => {
  it('names the consumer it logs under', () => {
    expect(LINKED_SCAN_JOB_CONSUMER).toBe('cms.linked-update-scan');
  });

  it('runs { patternId, patternVersionId } from the start with a null cursor and acknowledges a finished walk', async () => {
    const { job, run, queue, logs } = build();
    await expect(
      job.process({ body: scanJobBody(), attempts: 1 }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith(
      {
        patternId: PATTERN,
        patternVersionId: VERSION,
        cursor: null,
        correlationId: IDS.correlation,
      },
      expect.any(AbortSignal),
    );
    expect(queue.sent).toEqual([]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      level: 'info',
      details: {
        eventName: 'cms.linked_update_scan',
        operation: 'run',
        consumer: 'cms.linked-update-scan',
        outcome: 'success',
        correlationId: IDS.correlation,
        traceId: IDS.correlation,
        retryable: false,
        attributes: { examined: 7, appended: 5, continued: false },
        traceSteps: ['cms.composition.consumer_refetch', 'cms.composition.rpc'],
      },
    });
  });

  it('increments cms_pattern_linked_update_pending_total by the rows the run appended [BE03c Observability]', async () => {
    const { job, logs } = build();
    await job.process({ body: scanJobBody(), attempts: 1 });
    expect(logs[0]?.details.metrics).toEqual({
      'cms.linked_scan.run.total': 1,
      'cms.linked_scan.examined.total': 7,
      cms_pattern_linked_update_pending_total: 5,
    });
  });

  it('counts a re-delivery that appended nothing as zero, so an idempotent repeat adds nothing', async () => {
    const { job, logs } = build({
      run: scanRunResult({ examined: 0, appended: 0 }),
    });
    await job.process({ body: scanJobBody(), attempts: 1 });
    expect(logs[0]?.details.metrics).toMatchObject({
      cms_pattern_linked_update_pending_total: 0,
    });
  });

  it('continues from the cursor the previous run handed back', async () => {
    const { job, run } = build();
    await job.process({ body: scanJobBody({ cursor: CURSOR }), attempts: 1 });
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: CURSOR }),
      expect.any(AbortSignal),
    );
  });

  it('enqueues the continuation message with the new cursor before it acknowledges [AC-213]', async () => {
    const { job, queue, logs } = build({ run: full() });
    const message = scanJobBody();
    await expect(job.process({ body: message, attempts: 1 })).resolves.toEqual({
      outcome: 'ack',
    });
    expect(queue.sent).toEqual([{ ...message, cursor: NEXT_CURSOR }]);
    expect(logs[0]?.details.attributes).toMatchObject({
      continued: true,
      examined: 500,
      appended: 500,
    });
    expect(logs[0]?.details.metrics).toMatchObject({
      cms_pattern_linked_update_pending_total: 500,
    });
  });

  it('retries the same message when the continuation cannot be enqueued, and still counts the rows already appended', async () => {
    const { job, queue, logs } = build({ run: full(), queueFails: true });
    await expect(
      job.process({ body: scanJobBody(), attempts: 2 }),
    ).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 60,
    });
    expect(queue.sent).toEqual([]);
    expect(logs[0]).toMatchObject({
      level: 'warn',
      details: {
        outcome: 'retry',
        errorCode: 'CONTINUATION_ENQUEUE_FAILED',
        metrics: { cms_pattern_linked_update_pending_total: 500 },
      },
    });
  });

  it('adds the bounded jitter to the ladder of a failed run', async () => {
    const { job } = build({ run: new Error('rpc down'), random: () => 0.9999 });
    await expect(
      job.process({ body: scanJobBody(), attempts: 1 }),
    ).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 16,
    });
  });

  it('retries on the 15 second ladder when the run fails, and enqueues no continuation or count', async () => {
    const { job, queue, logs } = build({ run: new Error('rpc down') });
    await expect(
      job.process({ body: scanJobBody(), attempts: 1 }),
    ).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 15,
    });
    expect(queue.sent).toEqual([]);
    expect(logs[0]).toMatchObject({
      level: 'warn',
      details: {
        outcome: 'retry',
        errorCode: 'LINKED_SCAN_RUN_FAILED',
        retryable: true,
        metrics: { 'cms.linked_scan.run.total': 1 },
      },
    });
    expect(logs[0]?.details.attributes).toBeUndefined();
    expect(JSON.stringify(logs[0]?.details.metrics)).not.toContain(
      'cms_pattern_linked_update_pending_total',
    );
  });

  it('lets the platform queue dead-letter a run that keeps failing beyond the ladder', async () => {
    const { job } = build({ run: new Error('rpc down') });
    await expect(
      job.process({ body: scanJobBody(), attempts: 4 }),
    ).resolves.toEqual({ outcome: 'retry' });
  });

  it.each([
    [
      'a message without the payload',
      { jobType: 'cms.pattern.linked_update_scan' },
    ],
    [
      'the governed job type',
      { ...scanJobBody(), jobType: 'cms.governed_review.recheck' },
    ],
    [
      'a payload with a caller-named entry',
      {
        ...scanJobBody(),
        payload: { ...scanJobBody().payload, entryId: IDS.person },
      },
    ],
    ['no cursor member', { ...scanJobBody(), cursor: undefined }],
    [
      'a cursor that is not entry id and hex path',
      { ...scanJobBody(), cursor: 'next' },
    ],
    ['a body that is not an object', 'scan'],
  ])(
    'never acknowledges %s, so the platform queue moves it to its dead-letter queue',
    async (_name, body) => {
      const { job, run, queue, logs } = build();
      await expect(job.process({ body, attempts: 0 })).resolves.toEqual({
        outcome: 'retry',
      });
      expect(run).not.toHaveBeenCalled();
      expect(queue.sent).toEqual([]);
      expect(logs[0]).toMatchObject({
        level: 'error',
        details: {
          eventName: 'cms.linked_update_scan.admission',
          outcome: 'retry',
          errorCode: 'INVALID_QUEUE_PAYLOAD',
          attempt: 1,
        },
      });
    },
  );

  it('runs with the default clock', async () => {
    const { job, logs } = build({ withClock: false });
    await expect(
      job.process({ body: scanJobBody(), attempts: 1 }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(logs[0]?.details.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('writes only log events the platform logger accepts, on every path', async () => {
    const cases = [
      build(),
      build({ run: full() }),
      build({ run: new Error('rpc down') }),
      build({ run: full(), queueFails: true }),
    ];
    for (const built of cases)
      await built.job.process({ body: scanJobBody(), attempts: 1 });
    const invalid = build();
    await invalid.job.process({ body: {}, attempts: 1 });
    const logs = [...cases, invalid].flatMap((built) => built.logs);
    expect(logs).toHaveLength(5);
    for (const log of logs)
      expect(LogEventDetailsSchema.safeParse(log.details).success).toBe(true);
  });

  it('logs no pattern, entry, path or cursor identifier', async () => {
    const { job, logs } = build({ run: full() });
    await job.process({ body: scanJobBody({ cursor: CURSOR }), attempts: 1 });
    const serialized = JSON.stringify(logs);
    for (const secret of [PATTERN, VERSION, CURSOR, NEXT_CURSOR, IDS.aggregate])
      expect(serialized).not.toContain(secret);
  });

  /*
   * Review V6-13 (surviving mutants): the pieces of the job that no durable state shows, pinned from the outside.
   */
  it('does not continue on a full run that ends the list: a run of exactly 500 with no cursor is finished (no extra empty run)', async () => {
    const { job, queue, logs } = build({
      run: scanRunResult({ examined: 500, appended: 3, nextCursor: null }),
    });
    await expect(
      job.process({ body: scanJobBody(), attempts: 1 }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(queue.send).not.toHaveBeenCalled();
    expect(logs[0]?.details.attributes).toMatchObject({
      examined: 500,
      appended: 3,
      continued: false,
    });
  });

  it('adds the bounded jitter to the retry of a failed continuation as well', async () => {
    const { job } = build({
      run: full(),
      queueFails: true,
      random: () => 0.9999,
    });
    await expect(
      job.process({ body: scanJobBody(), attempts: 1 }),
    ).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 16,
    });
  });

  it('writes every event with the always-sample class, high-risk exactly when the outcome is not a success', async () => {
    const success = build();
    await success.job.process({ body: scanJobBody(), attempts: 1 });
    const continued = build({ run: full() });
    await continued.job.process({ body: scanJobBody(), attempts: 1 });
    const runFailed = build({ run: new Error('rpc down') });
    await runFailed.job.process({ body: scanJobBody(), attempts: 1 });
    const enqueueFailed = build({ run: full(), queueFails: true });
    await enqueueFailed.job.process({ body: scanJobBody(), attempts: 1 });
    const invalid = build();
    await invalid.job.process({ body: {}, attempts: 1 });
    expect(success.logs[0]).toMatchObject({
      level: 'info',
      options: { samplingClass: 'always', highRisk: false },
    });
    expect(continued.logs[0]).toMatchObject({
      level: 'info',
      options: { samplingClass: 'always', highRisk: false },
    });
    expect(runFailed.logs[0]).toMatchObject({
      level: 'warn',
      options: { samplingClass: 'always', highRisk: true },
    });
    expect(enqueueFailed.logs[0]).toMatchObject({
      level: 'warn',
      options: { samplingClass: 'always', highRisk: true },
    });
    expect(invalid.logs[0]).toMatchObject({
      level: 'error',
      options: { samplingClass: 'always', highRisk: true },
    });
  });

  it('runs the database call under the BE00 deadline: the signal it receives aborts at 15 seconds and not before', async () => {
    vi.useFakeTimers();
    try {
      let seen: AbortSignal | undefined;
      const run = vi.fn(async (_request: unknown, signal: AbortSignal) => {
        seen = signal;
        await new Promise<void>((resolve) =>
          signal.addEventListener('abort', () => resolve(), { once: true }),
        );
        return scanRunResult();
      });
      const { telemetry } = recordingTelemetry();
      const job = createLinkedScanJob({
        run,
        queue: fakeScanQueue().queue,
        telemetry,
      });
      const pending = job.process({ body: scanJobBody(), attempts: 1 });
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
