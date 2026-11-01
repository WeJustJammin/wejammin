import {
  ReviewRecheckSourceEnvelopeSchema,
  type ReviewRecheckSourceEventType,
} from '@wejammin/contracts';

import { runWithDeadline } from '../../event-consumers/deadline';
import { retryAfterAttempt } from '../../event-consumers/retry-schedule';
import {
  defaultConsumerClock,
  type ConsumerClock,
  type ConsumerTelemetry,
  type EventConsumerMessage,
  type EventConsumerOutcome,
} from '../../event-consumers/types';
import {
  CMS_GOVERNED_RECHECK_JOB_TYPE,
  type GovernedRecheckEventResolution,
  type GovernedRecheckKind,
  type GovernedRecheckMessage,
} from './contract';
import type { GovernedRecheckQueue } from './message';
import { traceStepsOf } from '../observability-registry';

const EVENT_NAME = 'cms.governed_review_recheck_source' as const;

/**
 * The three events whose consumers enqueue the governed recheck (BE03c
 * "Invalidation"): a block lifecycle change (a withdrawn block), a schema
 * activation (a changed bound policy or type version) and a pattern
 * activation. `kind` is the governed dependency kind its identity is looked up
 * under.
 */
export const GOVERNED_RECHECK_SOURCES = {
  'cms.block.lifecycle.changed.v1': { kind: 'block' },
  'cms.schema.activated.v1': { kind: 'content_type' },
  'cms.pattern.activated.v1': { kind: 'pattern' },
} as const satisfies Readonly<
  Record<
    Extract<
      ReviewRecheckSourceEventType,
      | 'cms.block.lifecycle.changed.v1'
      | 'cms.schema.activated.v1'
      | 'cms.pattern.activated.v1'
    >,
    Readonly<{ kind: GovernedRecheckKind }>
  >
>;

export type GovernedRecheckSourceEventType =
  keyof typeof GOVERNED_RECHECK_SOURCES;

export const GOVERNED_RECHECK_SOURCE_EVENT_TYPES = Object.keys(
  GOVERNED_RECHECK_SOURCES,
) as readonly GovernedRecheckSourceEventType[];

/** True for every version of the three families (an unknown version included). */
export const isGovernedRecheckSourceFamily = (
  eventType: unknown,
): eventType is string =>
  typeof eventType === 'string' &&
  /^cms\.(?:block\.lifecycle\.changed|schema\.activated|pattern\.activated)\.v[0-9]+$/u.test(
    eventType,
  );

/** One consumer name per event type, e.g. `cms.governed-recheck.schema-activated`. */
export const governedRecheckConsumerName = (
  eventType: GovernedRecheckSourceEventType,
): string =>
  `cms.governed-recheck.${eventType
    .replace(/^cms\./u, '')
    .replace(/\.v1$/u, '')
    .replaceAll('.', '-')}`;

export type GovernedRecheckSourceDependencies = Readonly<{
  /** Rereads the committed event as the governed dependency lookup it names. */
  resolveEvent: (
    eventId: string,
    signal: AbortSignal,
  ) => Promise<GovernedRecheckEventResolution>;
  /** Puts the `cms.governed_review.recheck` job on the platform jobs queue. */
  queue: GovernedRecheckQueue;
  telemetry: ConsumerTelemetry;
  clock?: ConsumerClock;
}>;

/**
 * The producer of the governed recheck for one source event type. It rereads the
 * committed event, checks the identity is of the kind the event owns and enqueues
 * `cms.governed_review.recheck` with `{ eventId, kind, refId }`. It never treats
 * the event as proof that anything changed: the job rebuilds every review from
 * canonical state.
 *
 * The editorial recheck consumer (Slice 11) owns the dead letter of the same
 * envelope, so an envelope that is not exactly this event's v1 envelope and an
 * event the database cannot resolve are acknowledged here without a dead letter.
 */
export const createGovernedRecheckSourceConsumer = (
  eventType: GovernedRecheckSourceEventType,
  dependencies: GovernedRecheckSourceDependencies,
) => {
  const consumer = governedRecheckConsumerName(eventType);
  const clock = dependencies.clock ?? defaultConsumerClock;
  const { telemetry } = dependencies;
  const owned = GOVERNED_RECHECK_SOURCES[eventType];

  const process = async (
    message: EventConsumerMessage,
  ): Promise<EventConsumerOutcome> => {
    const startedAt = clock.now();
    return runWithDeadline(async (signal) => {
      const parsed = ReviewRecheckSourceEnvelopeSchema.safeParse(message.body);
      if (!parsed.success || parsed.data.eventType !== eventType)
        return { outcome: 'ack' };
      const envelope = parsed.data;
      const emit = (
        outcome: 'success' | 'retry' | 'failure',
        errorCode: string | null,
      ): void => {
        const details = {
          eventName: EVENT_NAME,
          operation: 'enqueue',
          consumer,
          outcome,
          attempt: Math.max(1, message.attempts),
          correlationId: envelope.correlationId,
          traceId: envelope.eventId,
          entityType: envelope.aggregateType,
          entityVersion: envelope.aggregateVersion,
          dependency: 'supabase-postgres',
          durationMs: Math.max(0, clock.now() - startedAt),
          retryable: outcome === 'retry',
          ...(errorCode === null ? {} : { errorCode }),
          attributes: { dependencyKind: owned.kind },
          // BE03c Observability trace: the consumer rereads the committed event before it enqueues anything.
          traceSteps: traceStepsOf('consumer_refetch'),
          metrics: { 'cms.governed_recheck.enqueue.total': 1 },
        } as const;
        const options = {
          samplingClass: 'always',
          highRisk: outcome !== 'success',
        } as const;
        if (outcome === 'success') telemetry.info(details, options);
        else telemetry.warn(details, options);
      };
      const retry = (code: string): EventConsumerOutcome => {
        emit('retry', code);
        return retryAfterAttempt(message.attempts);
      };

      let resolution: GovernedRecheckEventResolution;
      try {
        resolution = await dependencies.resolveEvent(envelope.eventId, signal);
      } catch {
        return retry('EVENT_READ_FAILED');
      }
      if (!resolution.found || resolution.kind !== owned.kind) {
        emit('failure', 'SOURCE_RECORD_NOT_FOUND');
        return { outcome: 'ack' };
      }

      const job: GovernedRecheckMessage = {
        jobType: CMS_GOVERNED_RECHECK_JOB_TYPE,
        schemaVersion: 1,
        payload: {
          eventId: envelope.eventId,
          kind: owned.kind,
          refId: resolution.refId,
        },
        cursor: null,
        correlationId: envelope.correlationId,
      };
      try {
        await dependencies.queue.send(job);
      } catch {
        return retry('GOVERNED_JOB_ENQUEUE_FAILED');
      }
      emit('success', null);
      return { outcome: 'ack' };
    });
  };

  return { process };
};

export type GovernedRecheckSourceConsumer = ReturnType<
  typeof createGovernedRecheckSourceConsumer
>;

/** The three producers, keyed by the v1 event type they own. */
export const createGovernedRecheckSourceConsumers = (
  dependencies: GovernedRecheckSourceDependencies,
): Readonly<
  Record<GovernedRecheckSourceEventType, GovernedRecheckSourceConsumer>
> =>
  Object.fromEntries(
    GOVERNED_RECHECK_SOURCE_EVENT_TYPES.map((eventType) => [
      eventType,
      createGovernedRecheckSourceConsumer(eventType, dependencies),
    ]),
  ) as Record<GovernedRecheckSourceEventType, GovernedRecheckSourceConsumer>;
