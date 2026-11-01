import { LogEventDetailsSchema } from '@wejammin/observability/logging';
import { describe, expect, it } from 'vitest';

import {
  buildGovernedSourceDependencies,
  IDS,
  REF,
  sourceBody,
} from './governed-recheck.test-support';
import {
  createGovernedRecheckSourceConsumers,
  GOVERNED_RECHECK_SOURCES,
  governedRecheckConsumerName,
} from './source-consumers';

type Owned = keyof typeof GOVERNED_RECHECK_SOURCES;
const OWNED = Object.keys(GOVERNED_RECHECK_SOURCES) as Owned[];

const consumerFor = (
  eventType: Owned,
  built: ReturnType<typeof buildGovernedSourceDependencies>,
) => createGovernedRecheckSourceConsumers(built.dependencies)[eventType];

describe('[P2-S12-AC-202] the governed recheck producers', () => {
  it('are exactly the consumers of the withdrawn-block, schema-activated and pattern-activated events', () => {
    expect([...OWNED].sort()).toEqual([
      'cms.block.lifecycle.changed.v1',
      'cms.pattern.activated.v1',
      'cms.schema.activated.v1',
    ]);
    expect(
      Object.keys(
        createGovernedRecheckSourceConsumers(
          buildGovernedSourceDependencies().dependencies,
        ),
      ).sort(),
    ).toEqual([...OWNED].sort());
  });

  it('name one consumer per event type', () => {
    expect(governedRecheckConsumerName('cms.schema.activated.v1')).toBe(
      'cms.governed-recheck.schema-activated',
    );
    expect(governedRecheckConsumerName('cms.block.lifecycle.changed.v1')).toBe(
      'cms.governed-recheck.block-lifecycle-changed',
    );
  });

  it.each([
    ['cms.block.lifecycle.changed.v1', 'block'],
    ['cms.schema.activated.v1', 'content_type'],
    ['cms.pattern.activated.v1', 'pattern'],
  ] as const)(
    'enqueue the typed job for %s: its identity is looked up as dependency kind %s',
    async (eventType, kind) => {
      const built = buildGovernedSourceDependencies({}, kind);
      const outcome = await consumerFor(eventType, built).process({
        body: sourceBody(eventType),
        attempts: 1,
      });
      expect(outcome).toEqual({ outcome: 'ack' });
      expect(built.resolveEvent).toHaveBeenCalledWith(
        IDS.event,
        expect.any(AbortSignal),
      );
      expect(built.queue.sent).toEqual([
        {
          jobType: 'cms.governed_review.recheck',
          schemaVersion: 1,
          payload: { eventId: IDS.event, kind, refId: REF },
          cursor: null,
          correlationId: IDS.correlation,
        },
      ]);
      expect(built.logs).toHaveLength(1);
      expect(built.logs[0]).toMatchObject({
        level: 'info',
        details: {
          eventName: 'cms.governed_review_recheck_source',
          operation: 'enqueue',
          consumer: governedRecheckConsumerName(eventType),
          outcome: 'success',
          correlationId: IDS.correlation,
          traceId: IDS.event,
          retryable: false,
          attributes: { dependencyKind: kind },
          metrics: { 'cms.governed_recheck.enqueue.total': 1 },
        },
      });
      expect(
        LogEventDetailsSchema.safeParse(built.logs[0]?.details).success,
      ).toBe(true);
    },
  );

  it.each(OWNED)(
    'leave %s to the editorial consumer when the database cannot resolve it or resolves another dependency kind, and never dead-letter it themselves',
    async (eventType) => {
      for (const resolution of [
        { found: false } as const,
        {
          found: true,
          kind: eventType === 'cms.pattern.activated.v1' ? 'block' : 'pattern',
          refId: REF,
        } as const,
      ]) {
        const built = buildGovernedSourceDependencies({ resolution });
        await expect(
          consumerFor(eventType, built).process({
            body: sourceBody(eventType),
            attempts: 1,
          }),
        ).resolves.toEqual({ outcome: 'ack' });
        expect(built.queue.sent).toEqual([]);
        expect(built.logs[0]).toMatchObject({
          level: 'warn',
          details: { outcome: 'failure', errorCode: 'SOURCE_RECORD_NOT_FOUND' },
        });
      }
    },
  );

  it.each([
    [
      'an unknown event version',
      (eventType: Owned) => sourceBody(eventType, { schemaVersion: 2 }),
    ],
    ['a body that is not an envelope', () => 'event'],
    [
      'an envelope of another family',
      () => sourceBody('cms.taxonomy.changed.v1'),
    ],
    [
      'an envelope with a stray member',
      (eventType: Owned) => sourceBody(eventType, { content: 'x' }),
    ],
  ])(
    'ignore %s without a database call: the editorial consumer owns its dead letter',
    async (_name, body) => {
      const built = buildGovernedSourceDependencies();
      await expect(
        consumerFor('cms.schema.activated.v1', built).process({
          body: body('cms.schema.activated.v1'),
          attempts: 1,
        }),
      ).resolves.toEqual({ outcome: 'ack' });
      expect(built.resolveEvent).not.toHaveBeenCalled();
      expect(built.queue.sent).toEqual([]);
      expect(built.logs).toEqual([]);
    },
  );

  it('retries on the 15 second ladder when the event cannot be read, enqueueing nothing', async () => {
    const built = buildGovernedSourceDependencies({
      resolution: new Error('rpc down'),
    });
    await expect(
      consumerFor('cms.pattern.activated.v1', built).process({
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
    const built = buildGovernedSourceDependencies({ queueFails: true });
    await expect(
      consumerFor('cms.schema.activated.v1', built).process({
        body: sourceBody('cms.schema.activated.v1'),
        attempts: 2,
      }),
    ).resolves.toEqual({ outcome: 'retry', delaySeconds: 60 });
    expect(built.logs[0]).toMatchObject({
      level: 'warn',
      details: { outcome: 'retry', errorCode: 'GOVERNED_JOB_ENQUEUE_FAILED' },
    });
  });

  it('runs with the default clock and logs no identifier of a review', async () => {
    const built = buildGovernedSourceDependencies({ withClock: false });
    await expect(
      consumerFor('cms.schema.activated.v1', built).process({
        body: sourceBody('cms.schema.activated.v1'),
        attempts: 1,
      }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(built.logs[0]?.details.durationMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(built.logs)).not.toContain(REF);
  });
});
