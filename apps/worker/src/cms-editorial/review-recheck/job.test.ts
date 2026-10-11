import { LogEventDetailsSchema } from '@wejammin/observability/logging';
import { describe, expect, it, vi } from 'vitest';

import { createReviewRecheckJob, REVIEW_RECHECK_JOB_CONSUMER } from './job';
import {
  CURSOR,
  fakeQueue,
  IDS,
  jobBody,
  NOW,
  recordingTelemetry,
  runResult,
} from './review-recheck.test-support';

const build = (
  options: Readonly<{
    run?: ReturnType<typeof runResult> | Error;
    queueFails?: boolean;
    withClock?: boolean;
  }> = {},
) => {
  const run = vi.fn(async () => {
    const result = options.run ?? runResult();
    if (result instanceof Error) throw result;
    return result;
  });
  const queue = fakeQueue(options.queueFails);
  const { logs, telemetry } = recordingTelemetry();
  const job = createReviewRecheckJob({
    run,
    queue: queue.queue,
    telemetry,
    ...(options.withClock === false
      ? {}
      : { clock: { now: () => NOW, randomUuid: () => IDS.request } }),
  });
  return { job, run, queue, logs };
};

describe('[P2-S11-AC-113] the cms.review.dependency_recheck job', () => {
  it('names the consumer it logs under', () => {
    expect(REVIEW_RECHECK_JOB_CONSUMER).toBe('cms.review-dependency-recheck');
  });

  it('runs { eventId, kind, refId } from the start with a null cursor and acknowledges a finished walk', async () => {
    const { job, run, queue, logs } = build();
    await expect(
      job.process({ body: jobBody(), attempts: 1 }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith(
      {
        eventId: IDS.event,
        kind: 'schema',
        refId: expect.any(String),
        cursor: null,
      },
      expect.any(AbortSignal),
    );
    expect(queue.sent).toEqual([]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      level: 'info',
      details: {
        eventName: 'cms.review_dependency_recheck',
        operation: 'run',
        consumer: 'cms.review-dependency-recheck',
        outcome: 'success',
        correlationId: IDS.correlation,
        traceId: IDS.event,
        retryable: false,
        attributes: {
          dependencyKind: 'schema',
          examined: 3,
          invalidated: 1,
          continued: false,
        },
        metrics: {
          'cms.review_recheck.run.total': 1,
          'cms.review_recheck.examined.total': 3,
          'cms_review_invalidated_total{reason="dependency_changed"}': 1,
        },
      },
    });
  });

  it('continues from the cursor the previous run handed back', async () => {
    const { job, run } = build();
    await job.process({ body: jobBody({ cursor: CURSOR }), attempts: 1 });
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: CURSOR }),
      expect.any(AbortSignal),
    );
  });

  it('enqueues the continuation message with the new cursor before it acknowledges', async () => {
    const { job, queue, logs } = build({
      run: runResult({ examined: 500, invalidated: 12, nextCursor: CURSOR }),
    });
    const message = jobBody();
    await expect(job.process({ body: message, attempts: 1 })).resolves.toEqual({
      outcome: 'ack',
    });
    expect(queue.sent).toEqual([{ ...message, cursor: CURSOR }]);
    expect(logs[0]?.details.attributes).toMatchObject({ continued: true });
  });

  it('retries the same message when the continuation cannot be enqueued, so nothing is lost', async () => {
    const { job, queue, logs } = build({
      run: runResult({ examined: 500, nextCursor: CURSOR }),
      queueFails: true,
    });
    await expect(
      job.process({ body: jobBody(), attempts: 2 }),
    ).resolves.toEqual({ outcome: 'retry', delaySeconds: 60 });
    expect(queue.sent).toEqual([]);
    expect(logs[0]).toMatchObject({
      level: 'warn',
      details: { outcome: 'retry', errorCode: 'CONTINUATION_ENQUEUE_FAILED' },
    });
  });

  it('retries on the 15 second ladder when the run fails, and enqueues no continuation', async () => {
    const { job, queue, logs } = build({ run: new Error('rpc down') });
    await expect(
      job.process({ body: jobBody(), attempts: 1 }),
    ).resolves.toEqual({ outcome: 'retry', delaySeconds: 15 });
    expect(queue.sent).toEqual([]);
    expect(logs[0]).toMatchObject({
      level: 'warn',
      details: {
        outcome: 'retry',
        errorCode: 'RECHECK_RUN_FAILED',
        retryable: true,
        metrics: { 'cms.review_recheck.run.total': 1 },
      },
    });
    expect(logs[0]?.details.attributes).toEqual({ dependencyKind: 'schema' });
  });

  it.each([
    [
      'a message without the payload',
      { jobType: 'cms.review.dependency_recheck' },
    ],
    [
      'another job type',
      { ...jobBody(), jobType: 'cms.publication_schedule.execute' },
    ],
    [
      'a payload with a caller-named review',
      { ...jobBody(), payload: { ...jobBody().payload, reviewId: IDS.person } },
    ],
    [
      'a kind outside the nine',
      { ...jobBody(), payload: { ...jobBody().payload, kind: 'media' } },
    ],
    ['no cursor member', { ...jobBody(), cursor: undefined }],
    ['a body that is not an object', 'recheck'],
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
          eventName: 'cms.review_dependency_recheck.admission',
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
      job.process({ body: jobBody(), attempts: 1 }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(logs[0]?.details.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('writes only log events the platform logger accepts, on every path', async () => {
    const cases = [
      build(),
      build({ run: runResult({ examined: 500, nextCursor: CURSOR }) }),
      build({ run: new Error('rpc down') }),
      build({
        run: runResult({ examined: 500, nextCursor: CURSOR }),
        queueFails: true,
      }),
    ];
    for (const built of cases)
      await built.job.process({ body: jobBody(), attempts: 1 });
    const invalid = build();
    await invalid.job.process({ body: {}, attempts: 1 });
    const logs = [...cases, invalid].flatMap((built) => built.logs);
    expect(logs).toHaveLength(5);
    for (const log of logs)
      expect(LogEventDetailsSchema.safeParse(log.details).success).toBe(true);
  });

  it('logs no review, entry, content or authority identifier', async () => {
    const { job, logs } = build({
      run: runResult({ examined: 500, nextCursor: CURSOR }),
    });
    await job.process({ body: jobBody(), attempts: 1 });
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain(CURSOR);
    expect(serialized).not.toContain(jobBody().payload.refId);
  });
});
