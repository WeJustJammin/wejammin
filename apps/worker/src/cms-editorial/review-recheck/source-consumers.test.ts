import {
  ReviewDependencyRecheckJobSchema,
  ReviewDependencyRecheckMessageSchema,
  REVIEW_RECHECK_SOURCES,
  REVIEW_RECHECK_SOURCE_EVENT_TYPES,
} from '@wejammin/contracts';
import { LogEventDetailsSchema } from '@wejammin/observability/logging';
import { describe, expect, it } from 'vitest';

import {
  buildSourceDependencies,
  IDS,
  REF,
  sourceBody,
} from './review-recheck.test-support';
import {
  createReviewRecheckSourceConsumer,
  createReviewRecheckSourceConsumers,
  reviewRecheckConsumerName,
} from './source-consumers';

const consume = (
  eventType: (typeof REVIEW_RECHECK_SOURCE_EVENT_TYPES)[number],
  built: ReturnType<typeof buildSourceDependencies>,
  body: unknown = sourceBody(eventType),
  attempts = 1,
) =>
  createReviewRecheckSourceConsumer(eventType, built.dependencies).process({
    body,
    attempts,
  });

describe('[P2-S11-AC-113] the six consumers of the review recheck source events', () => {
  it('names one registered consumer per source event type', () => {
    expect(
      REVIEW_RECHECK_SOURCE_EVENT_TYPES.map(reviewRecheckConsumerName),
    ).toEqual([
      'cms.review-recheck.schema-activated',
      'cms.review-recheck.template-activated',
      'cms.review-recheck.pattern-activated',
      'cms.review-recheck.taxonomy-changed',
      'cms.review-recheck.localization-changed',
      'cms.review-recheck.block-lifecycle-changed',
    ]);
    const consumers = createReviewRecheckSourceConsumers(
      buildSourceDependencies().dependencies,
    );
    expect(Object.keys(consumers)).toEqual([
      ...REVIEW_RECHECK_SOURCE_EVENT_TYPES,
    ]);
  });

  it.each(REVIEW_RECHECK_SOURCE_EVENT_TYPES)(
    '%s: rereads the committed event and enqueues cms.review.dependency_recheck with { eventId, kind, refId }',
    async (eventType) => {
      const kind = REVIEW_RECHECK_SOURCES[eventType].kind;
      const built = buildSourceDependencies({}, kind);
      await expect(consume(eventType, built)).resolves.toEqual({
        outcome: 'ack',
      });
      expect(built.resolveEvent).toHaveBeenCalledWith(
        IDS.event,
        expect.any(AbortSignal),
      );
      expect(built.queue.sent).toEqual([
        {
          jobType: 'cms.review.dependency_recheck',
          schemaVersion: 1,
          payload: { eventId: IDS.event, kind, refId: REF },
          cursor: null,
          correlationId: IDS.correlation,
        },
      ]);
      const [job] = built.queue.sent;
      expect(ReviewDependencyRecheckMessageSchema.safeParse(job).success).toBe(
        true,
      );
      expect(
        ReviewDependencyRecheckJobSchema.safeParse(job?.payload).success,
      ).toBe(true);
      expect(built.deadLetter.records).toEqual([]);
    },
  );

  it('enqueues the identity the database resolved, never one read from the queue envelope', async () => {
    const built = buildSourceDependencies({}, 'locale_source');
    await consume('cms.localization.changed.v1', built);
    const [job] = built.queue.sent;
    expect(job?.payload.refId).toBe(REF);
    expect(job?.payload.refId).not.toBe(IDS.aggregate);
  });

  it('records one success log with identifiers and counts only', async () => {
    const built = buildSourceDependencies();
    await consume('cms.schema.activated.v1', built);
    expect(built.logs).toHaveLength(1);
    expect(built.logs[0]).toMatchObject({
      level: 'info',
      details: {
        eventName: 'cms.review_recheck_source',
        operation: 'enqueue',
        consumer: 'cms.review-recheck.schema-activated',
        outcome: 'success',
        attempt: 1,
        correlationId: IDS.correlation,
        traceId: IDS.event,
        retryable: false,
        attributes: { dependencyKind: 'schema' },
        metrics: { 'cms.review_recheck.enqueue.total': 1 },
      },
    });
    expect(JSON.stringify(built.logs)).not.toContain(REF);
  });

  it('works with the default clock', async () => {
    const built = buildSourceDependencies({ withClock: false });
    await expect(
      consume('cms.block.lifecycle.changed.v1', built),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(built.logs[0]?.details.durationMs).toBeGreaterThanOrEqual(0);
  });

  it.each([
    ['an event that is not found', { found: false } as const],
    [
      'an identity of another kind than the event owns',
      { found: true, kind: 'block', refId: REF } as const,
    ],
  ])(
    'durably dead-letters %s and acknowledges without enqueueing',
    async (_name, resolution) => {
      const built = buildSourceDependencies({ resolution });
      await expect(consume('cms.schema.activated.v1', built)).resolves.toEqual({
        outcome: 'ack',
      });
      expect(built.deadLetter.records).toEqual([
        {
          consumer: 'cms.review-recheck.schema-activated',
          identity: {
            eventId: IDS.event,
            eventType: 'cms.schema.activated.v1',
            schemaVersion: 1,
            aggregateType: 'cms_content_type_version',
            aggregateId: IDS.aggregate,
            aggregateVersion: '4',
          },
          reasonCode: 'SOURCE_RECORD_NOT_FOUND',
        },
      ]);
      expect(built.queue.sent).toEqual([]);
      expect(built.logs[0]).toMatchObject({
        level: 'warn',
        details: { outcome: 'failure', errorCode: 'SOURCE_RECORD_NOT_FOUND' },
      });
    },
  );

  it('retries when the dead letter of an unresolvable event cannot be recorded', async () => {
    const built = buildSourceDependencies({
      resolution: { found: false },
      deadLetterFails: true,
    });
    await expect(consume('cms.schema.activated.v1', built)).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 15,
    });
    expect(built.queue.sent).toEqual([]);
    expect(built.logs[0]).toMatchObject({
      level: 'warn',
      details: {
        outcome: 'retry',
        errorCode: 'DEAD_LETTER_UNAVAILABLE',
        retryable: true,
      },
    });
  });

  it('retries on the 15/60/300 second ladder when the event cannot be reread', async () => {
    const delays: Array<number | undefined> = [];
    for (const attempts of [1, 2, 3, 4]) {
      const built = buildSourceDependencies({
        resolution: new Error('rpc down'),
      });
      const outcome = await consume(
        'cms.schema.activated.v1',
        built,
        sourceBody('cms.schema.activated.v1'),
        attempts,
      );
      expect(outcome.outcome).toBe('retry');
      delays.push(outcome.delaySeconds);
      expect(built.queue.sent).toEqual([]);
      expect(built.logs[0]?.details).toMatchObject({
        errorCode: 'EVENT_READ_FAILED',
        attempt: attempts,
      });
    }
    expect(delays).toEqual([15, 60, 300, undefined]);
  });

  it('retries without acknowledging when the job cannot be enqueued, so the event is redelivered', async () => {
    const built = buildSourceDependencies({ queueFails: true }, 'pattern');
    await expect(consume('cms.pattern.activated.v1', built)).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 15,
    });
    expect(built.logs[0]?.details).toMatchObject({
      outcome: 'retry',
      errorCode: 'JOB_ENQUEUE_FAILED',
    });
  });

  it('clamps a non-positive delivery attempt to one in the log', async () => {
    const built = buildSourceDependencies();
    await consume(
      'cms.schema.activated.v1',
      built,
      sourceBody('cms.schema.activated.v1'),
      0,
    );
    expect(built.logs[0]?.details.attempt).toBe(1);
  });

  it('writes only log events the platform logger accepts, on every path', async () => {
    const outcomes = [
      buildSourceDependencies(),
      buildSourceDependencies({ resolution: { found: false } }),
      buildSourceDependencies({ resolution: new Error('rpc down') }),
      buildSourceDependencies({ queueFails: true }),
      buildSourceDependencies({
        resolution: { found: false },
        deadLetterFails: true,
      }),
    ];
    for (const built of outcomes)
      await consume('cms.schema.activated.v1', built);
    const invalid = buildSourceDependencies();
    await consume('cms.schema.activated.v1', invalid, { payload: {} });
    const logs = [...outcomes, invalid].flatMap((built) => built.logs);
    expect(logs).toHaveLength(6);
    for (const log of logs)
      expect(LogEventDetailsSchema.safeParse(log.details).success).toBe(true);
  });

  describe('admission', () => {
    it.each([
      ['a payload on the identifier-only envelope', { payload: {} }],
      ['another producer', { producer: 'cms.editorial' }],
      ['a malformed event id', { eventId: 'x' }],
      ['another aggregate than the producer uses', { aggregateType: 'job' }],
    ])(
      'dead-letters %s as INVALID_QUEUE_PAYLOAD and acknowledges',
      async (_name, patch) => {
        const built = buildSourceDependencies();
        await expect(
          consume(
            'cms.schema.activated.v1',
            built,
            sourceBody('cms.schema.activated.v1', patch),
          ),
        ).resolves.toEqual({ outcome: 'ack' });
        expect(built.deadLetter.records[0]?.reasonCode).toBe(
          'INVALID_QUEUE_PAYLOAD',
        );
        expect(built.resolveEvent).not.toHaveBeenCalled();
        expect(built.queue.sent).toEqual([]);
      },
    );

    it('dead-letters an unknown version of the family as UNKNOWN_EVENT_VERSION', async () => {
      const built = buildSourceDependencies();
      await expect(
        consume(
          'cms.pattern.activated.v1',
          built,
          sourceBody('cms.pattern.activated.v1', {
            eventType: 'cms.pattern.activated.v2',
            schemaVersion: 2,
          }),
        ),
      ).resolves.toEqual({ outcome: 'ack' });
      expect(built.deadLetter.records[0]).toMatchObject({
        consumer: 'cms.review-recheck.pattern-activated',
        reasonCode: 'UNKNOWN_EVENT_VERSION',
      });
      expect(built.queue.sent).toEqual([]);
    });

    it('retries rather than dropping an invalid envelope whose dead letter cannot be recorded', async () => {
      const built = buildSourceDependencies({ deadLetterFails: true });
      await expect(
        consume('cms.schema.activated.v1', built, { not: 'an envelope' }),
      ).resolves.toEqual({ outcome: 'retry' });
    });

    it('accepts any registry key as the aggregate of the Slice 12 events', async () => {
      const built = buildSourceDependencies({}, 'template');
      await expect(
        consume(
          'cms.template.activated.v1',
          built,
          sourceBody('cms.template.activated.v1', {
            aggregateType: 'cms_template_lineage',
          }),
        ),
      ).resolves.toEqual({ outcome: 'ack' });
      expect(built.queue.sent).toHaveLength(1);
    });
  });
});
