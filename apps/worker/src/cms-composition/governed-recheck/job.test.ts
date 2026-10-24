import { LogEventDetailsSchema } from '@wejammin/observability/logging';
import { describe, expect, it, vi } from 'vitest';

import {
  CURSOR,
  fakeGovernedQueue,
  governedJobBody,
  governedRunResult,
  IDS,
  NOW,
  recordingTelemetry,
} from './governed-recheck.test-support';
import { createGovernedRecheckJob, GOVERNED_RECHECK_JOB_CONSUMER } from './job';

const build = (
  options: Readonly<{
    run?: ReturnType<typeof governedRunResult> | Error;
    queueFails?: boolean;
    withClock?: boolean;
  }> = {},
) => {
  const run = vi.fn(async () => {
    const result = options.run ?? governedRunResult();
    if (result instanceof Error) throw result;
    return result;
  });
  const queue = fakeGovernedQueue(options.queueFails);
  const { logs, telemetry } = recordingTelemetry();
  const job = createGovernedRecheckJob({
    run,
    queue: queue.queue,
    telemetry,
    ...(options.withClock === false
      ? {}
      : { clock: { now: () => NOW, randomUuid: () => IDS.request } }),
  });
  return { job, run, queue, logs };
};

describe('[P2-S12-AC-203] the cms.governed_review.recheck job', () => {
  it('names the consumer it logs under', () => {
    expect(GOVERNED_RECHECK_JOB_CONSUMER).toBe('cms.governed-review-recheck');
  });

  it('runs { eventId, kind, refId } from the start with a null cursor and acknowledges a finished walk', async () => {
    const { job, run, queue, logs } = build();
    await expect(
      job.process({ body: governedJobBody(), attempts: 1 }),
    ).resolves.toEqual({
      outcome: 'ack',
    });
    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith(
      {
        eventId: IDS.event,
        kind: 'content_type',
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
        eventName: 'cms.governed_review_recheck',
        operation: 'run',
        consumer: 'cms.governed-review-recheck',
        outcome: 'success',
        correlationId: IDS.correlation,
        traceId: IDS.event,
        retryable: false,
        attributes: {
          dependencyKind: 'content_type',
          examined: 3,
          invalidated: 2,
          unavailable: 0,
          continued: false,
        },
        metrics: {
          'cms.governed_recheck.run.total': 1,
          'cms.governed_recheck.examined.total': 3,
          'cms.governed_recheck.unavailable.total': 0,
          'cms_governed_review_invalidated_total{reason="dependency_changed"}': 1,
          'cms_governed_review_invalidated_total{reason="reviewer_authority_changed"}': 1,
        },
      },
    });
  });

  it('forwards the unavailable count as an attribute and a metric and logs the success at warn level (DEC-218)', async () => {
    // two of three examined reviews were isolated and left live: the run is acknowledged (a retry could not help
    // a systemic fault) but an operator must see it, so the event is a warning with outcome success
    const { job, queue, logs } = build({
      run: governedRunResult({
        examined: 3,
        invalidated: 1,
        dependencyChanged: 1,
        reviewerAuthorityChanged: 0,
        unavailable: 2,
      }),
    });
    await expect(
      job.process({ body: governedJobBody(), attempts: 1 }),
    ).resolves.toEqual({
      outcome: 'ack',
    });
    expect(queue.sent).toEqual([]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      level: 'warn',
      details: {
        outcome: 'success',
        retryable: false,
        attributes: {
          examined: 3,
          invalidated: 1,
          unavailable: 2,
          continued: false,
        },
        metrics: {
          'cms.governed_recheck.examined.total': 3,
          'cms.governed_recheck.unavailable.total': 2,
          'cms_governed_review_invalidated_total{reason="dependency_changed"}': 1,
          'cms_governed_review_invalidated_total{reason="reviewer_authority_changed"}': 0,
        },
      },
    });
    expect(logs[0]?.details).not.toHaveProperty('errorCode');
    expect(LogEventDetailsSchema.safeParse(logs[0]?.details).success).toBe(
      true,
    );
  });

  it('still acknowledges, warns and continues when every review of a full run was unavailable', async () => {
    const { job, queue, logs } = build({
      run: governedRunResult({
        examined: 500,
        invalidated: 0,
        dependencyChanged: 0,
        reviewerAuthorityChanged: 0,
        unavailable: 500,
        nextCursor: CURSOR,
      }),
    });
    const message = governedJobBody();
    await expect(job.process({ body: message, attempts: 1 })).resolves.toEqual({
      outcome: 'ack',
    });
    expect(queue.sent).toEqual([{ ...message, cursor: CURSOR }]);
    expect(logs[0]).toMatchObject({
      level: 'warn',
      details: {
        outcome: 'success',
        attributes: { unavailable: 500, continued: true },
      },
    });
  });

  it('logs a run with nothing unavailable at info level', async () => {
    const { job, logs } = build();
    await job.process({ body: governedJobBody(), attempts: 1 });
    expect(logs[0]?.level).toBe('info');
  });

  it('continues from the cursor the previous run handed back', async () => {
    const { job, run } = build();
    await job.process({
      body: governedJobBody({ cursor: CURSOR }),
      attempts: 1,
    });
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: CURSOR }),
      expect.any(AbortSignal),
    );
  });

  it('enqueues the continuation message with the new cursor before it acknowledges', async () => {
    const { job, queue, logs } = build({
      run: governedRunResult({
        examined: 500,
        invalidated: 12,
        dependencyChanged: 12,
        reviewerAuthorityChanged: 0,
        nextCursor: CURSOR,
      }),
    });
    const message = governedJobBody();
    await expect(job.process({ body: message, attempts: 1 })).resolves.toEqual({
      outcome: 'ack',
    });
    expect(queue.sent).toEqual([{ ...message, cursor: CURSOR }]);
    expect(logs[0]?.details.attributes).toMatchObject({ continued: true });
  });

  it('retries the same message when the continuation cannot be enqueued, so nothing is lost', async () => {
    const { job, queue, logs } = build({
      run: governedRunResult({ examined: 500, nextCursor: CURSOR }),
      queueFails: true,
    });
    await expect(
      job.process({ body: governedJobBody(), attempts: 2 }),
    ).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 60,
    });
    expect(queue.sent).toEqual([]);
    expect(logs[0]).toMatchObject({
      level: 'warn',
      details: { outcome: 'retry', errorCode: 'CONTINUATION_ENQUEUE_FAILED' },
    });
  });

  it('retries on the 15 second ladder when the run fails, and enqueues no continuation', async () => {
    const { job, queue, logs } = build({ run: new Error('rpc down') });
    await expect(
      job.process({ body: governedJobBody(), attempts: 1 }),
    ).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 15,
    });
    expect(queue.sent).toEqual([]);
    expect(logs[0]).toMatchObject({
      level: 'warn',
      details: {
        outcome: 'retry',
        errorCode: 'RECHECK_RUN_FAILED',
        retryable: true,
        metrics: { 'cms.governed_recheck.run.total': 1 },
      },
    });
    expect(logs[0]?.details.attributes).toEqual({
      dependencyKind: 'content_type',
    });
  });

  it.each([
    [
      'a message without the payload',
      { jobType: 'cms.governed_review.recheck' },
    ],
    [
      'the editorial job type',
      { ...governedJobBody(), jobType: 'cms.review.dependency_recheck' },
    ],
    [
      'a payload with a caller-named review',
      {
        ...governedJobBody(),
        payload: { ...governedJobBody().payload, reviewId: IDS.person },
      },
    ],
    [
      'an editorial dependency kind',
      {
        ...governedJobBody(),
        payload: { ...governedJobBody().payload, kind: 'schema' },
      },
    ],
    ['no cursor member', { ...governedJobBody(), cursor: undefined }],
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
          eventName: 'cms.governed_review_recheck.admission',
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
      job.process({ body: governedJobBody(), attempts: 1 }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(logs[0]?.details.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('writes only log events the platform logger accepts, on every path', async () => {
    const cases = [
      build(),
      build({ run: governedRunResult({ examined: 500, nextCursor: CURSOR }) }),
      build({ run: new Error('rpc down') }),
      build({
        run: governedRunResult({ examined: 500, nextCursor: CURSOR }),
        queueFails: true,
      }),
      build({
        run: governedRunResult({
          examined: 3,
          invalidated: 1,
          dependencyChanged: 1,
          reviewerAuthorityChanged: 0,
          unavailable: 2,
        }),
      }),
    ];
    for (const built of cases)
      await built.job.process({ body: governedJobBody(), attempts: 1 });
    const invalid = build();
    await invalid.job.process({ body: {}, attempts: 1 });
    const logs = [...cases, invalid].flatMap((built) => built.logs);
    expect(logs).toHaveLength(6);
    for (const log of logs)
      expect(LogEventDetailsSchema.safeParse(log.details).success).toBe(true);
  });

  it('logs no review, entry, content or authority identifier', async () => {
    const { job, logs } = build({
      run: governedRunResult({ examined: 500, nextCursor: CURSOR }),
    });
    await job.process({ body: governedJobBody(), attempts: 1 });
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain(CURSOR);
    expect(serialized).not.toContain(governedJobBody().payload.refId);
  });
});
