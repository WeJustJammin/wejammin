import {
  CMS_EDITORIAL_JOB_TYPES,
  isReviewRecheckSourceEventType,
  REVIEW_RECHECK_SOURCES,
  REVIEW_RECHECK_SOURCE_EVENT_TYPES,
  ReviewRecheckSourceEnvelopeSchema,
  type ReviewDependencyEventResolution,
  type ReviewDependencyRecheckMessage,
  type ReviewRecheckSourceEventType,
} from '@wejammin/contracts';

import {
  admitConsumerEvent,
  recordEnvelopeDeadLetter,
} from '../../event-consumers/admit';
import { runWithDeadline } from '../../event-consumers/deadline';
import { retryAfterAttempt } from '../../event-consumers/retry-schedule';
import {
  defaultConsumerClock,
  type ConsumerClock,
  type ConsumerTelemetry,
  type DeadLetterPort,
  type EventConsumerMessage,
  type EventConsumerOutcome,
} from '../../event-consumers/types';
import type { ReviewRecheckQueue } from './message';

const EVENT_NAME = 'cms.review_recheck_source' as const;

/** One registered consumer name per source event type, e.g. `cms.review-recheck.schema-activated`. */
export const reviewRecheckConsumerName = (
  eventType: ReviewRecheckSourceEventType,
): string =>
  `cms.review-recheck.${eventType
    .replace(/^cms\./u, '')
    .replace(/\.v1$/u, '')
    .replaceAll('.', '-')}`;

export type ReviewRecheckSourceDependencies = Readonly<{
  /** Rereads the committed event as the dependency index lookup it names. */
  resolveEvent: (
    eventId: string,
    signal: AbortSignal,
  ) => Promise<ReviewDependencyEventResolution>;
  /** Puts the `cms.review.dependency_recheck` job on the platform jobs queue. */
  queue: ReviewRecheckQueue;
  deadLetter: DeadLetterPort;
  telemetry: ConsumerTelemetry;
  clock?: ConsumerClock;
}>;

/**
 * The consumer of one source event type (BE03b "Review invalidation / Dependency
 * recheck"). The queue envelope is identifier-only, so the consumer rereads the
 * committed event through the protected resolver, checks that the identity it
 * names is of the kind this event type owns, and enqueues the job
 * `cms.review.dependency_recheck` with `{ eventId, kind, refId }`. It never
 * treats the event as proof that anything changed: the job rebuilds each
 * manifest from canonical state. Delivery is at least once and enqueueing is
 * idempotent in effect, because the job is.
 *
 * An envelope that is not exactly the event's v1 envelope (an unknown version
 * included) and an event the database cannot resolve are durably dead-lettered
 * and acknowledged; if the dead letter cannot be recorded the message is retried.
 */
export const createReviewRecheckSourceConsumer = (
  eventType: ReviewRecheckSourceEventType,
  dependencies: ReviewRecheckSourceDependencies,
) => {
  const consumer = reviewRecheckConsumerName(eventType);
  const clock = dependencies.clock ?? defaultConsumerClock;
  const { telemetry } = dependencies;
  const owned = REVIEW_RECHECK_SOURCES[eventType];

  const process = async (
    message: EventConsumerMessage,
  ): Promise<EventConsumerOutcome> => {
    const startedAt = clock.now();
    return runWithDeadline(async (signal) => {
      const admitted = await admitConsumerEvent({
        consumer,
        schema: ReviewRecheckSourceEnvelopeSchema,
        isKnownFamily: isReviewRecheckSourceEventType,
        message,
        deadLetter: dependencies.deadLetter,
        telemetry,
        signal,
      });
      if (!admitted.ok) return admitted.outcome;
      const { envelope } = admitted;
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
          metrics: { 'cms.review_recheck.enqueue.total': 1 },
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

      let resolution: ReviewDependencyEventResolution;
      try {
        resolution = await dependencies.resolveEvent(envelope.eventId, signal);
      } catch {
        return retry('EVENT_READ_FAILED');
      }
      // The identity must be of the kind this event type owns; anything else
      // is a source record this consumer cannot act on.
      if (!resolution.found || resolution.kind !== owned.kind) {
        const recorded = await recordEnvelopeDeadLetter({
          consumer,
          envelope,
          reasonCode: 'SOURCE_RECORD_NOT_FOUND',
          deadLetter: dependencies.deadLetter,
          signal,
        });
        if (!recorded) return retry('DEAD_LETTER_UNAVAILABLE');
        emit('failure', 'SOURCE_RECORD_NOT_FOUND');
        return { outcome: 'ack' };
      }

      const job: ReviewDependencyRecheckMessage = {
        jobType: CMS_EDITORIAL_JOB_TYPES.dependencyRecheck,
        schemaVersion: 1,
        payload: {
          eventId: envelope.eventId,
          kind: resolution.kind,
          refId: resolution.refId,
        },
        cursor: null,
        correlationId: envelope.correlationId,
      };
      try {
        await dependencies.queue.send(job);
      } catch {
        return retry('JOB_ENQUEUE_FAILED');
      }
      emit('success', null);
      return { outcome: 'ack' };
    });
  };

  return { process };
};

export type ReviewRecheckSourceConsumer = ReturnType<
  typeof createReviewRecheckSourceConsumer
>;

/** The six consumers, keyed by the v1 event type they own. */
export const createReviewRecheckSourceConsumers = (
  dependencies: ReviewRecheckSourceDependencies,
): Readonly<
  Record<ReviewRecheckSourceEventType, ReviewRecheckSourceConsumer>
> =>
  Object.fromEntries(
    REVIEW_RECHECK_SOURCE_EVENT_TYPES.map((eventType) => [
      eventType,
      createReviewRecheckSourceConsumer(eventType, dependencies),
    ]),
  ) as Record<ReviewRecheckSourceEventType, ReviewRecheckSourceConsumer>;
