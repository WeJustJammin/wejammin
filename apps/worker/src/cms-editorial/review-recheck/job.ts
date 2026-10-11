import {
  ReviewDependencyRecheckMessageSchema,
  type ReviewDependencyRecheckRunRequest,
  type ReviewDependencyRecheckRunResult,
} from '@wejammin/contracts';

import { metricKey } from '../../content-schema-registry/route-metric-key';
import { runWithDeadline } from '../../event-consumers/deadline';
import { retryAfterAttempt } from '../../event-consumers/retry-schedule';
import {
  defaultConsumerClock,
  type ConsumerClock,
  type ConsumerTelemetry,
  type EventConsumerMessage,
  type EventConsumerOutcome,
} from '../../event-consumers/types';
import type { ReviewRecheckQueue } from './message';

export const REVIEW_RECHECK_JOB_CONSUMER =
  'cms.review-dependency-recheck' as const;
const EVENT_NAME = 'cms.review_dependency_recheck' as const;

export type ReviewRecheckJobDependencies = Readonly<{
  /** One bounded run of the job in the database: at most 500 live reviews after the cursor. */
  run: (
    request: ReviewDependencyRecheckRunRequest,
    signal: AbortSignal,
  ) => Promise<ReviewDependencyRecheckRunResult>;
  /** The platform jobs queue, for the continuation of a run that left reviews behind. */
  queue: ReviewRecheckQueue;
  telemetry: ConsumerTelemetry;
  clock?: ConsumerClock;
}>;

/**
 * The BE00 job `cms.review.dependency_recheck` (BE03b "Review invalidation /
 * Dependency recheck"). One queue message is one run of at most 500 live
 * reviews: the database selects them through the dependency index, rebuilds each
 * manifest and invalidates `dependency_changed` on inequality or a non-current
 * identity. A run that leaves reviews behind hands back a cursor and this job
 * enqueues the continuation message that carries it, so a message is
 * acknowledged only after its successor is on the queue.
 *
 * Delivery is at least once and every step is idempotent: an invalidated review
 * is no longer selected, a repeated run from the same cursor invalidates
 * nothing twice, and a duplicate continuation only repeats a walk that finds
 * nothing left to do. A message that is not exactly a recheck message is never
 * acknowledged, so the platform queue moves it to its dead-letter queue.
 */
export const createReviewRecheckJob = (
  dependencies: ReviewRecheckJobDependencies,
) => {
  const clock = dependencies.clock ?? defaultConsumerClock;
  const { telemetry } = dependencies;

  const process = async (
    message: EventConsumerMessage,
  ): Promise<EventConsumerOutcome> => {
    const startedAt = clock.now();
    return runWithDeadline(async (signal) => {
      const parsed = ReviewDependencyRecheckMessageSchema.safeParse(
        message.body,
      );
      if (!parsed.success) {
        telemetry.error(
          {
            eventName: `${EVENT_NAME}.admission`,
            operation: 'consume',
            consumer: REVIEW_RECHECK_JOB_CONSUMER,
            outcome: 'retry',
            retryable: true,
            errorCode: 'INVALID_QUEUE_PAYLOAD',
            attempt: Math.max(1, message.attempts),
          },
          { samplingClass: 'always', highRisk: true },
        );
        return { outcome: 'retry' };
      }
      const job = parsed.data;
      const emit = (
        outcome: 'success' | 'retry',
        errorCode: string | null,
        run: ReviewDependencyRecheckRunResult | null,
      ): void => {
        const details = {
          eventName: EVENT_NAME,
          operation: 'run',
          consumer: REVIEW_RECHECK_JOB_CONSUMER,
          outcome,
          attempt: Math.max(1, message.attempts),
          correlationId: job.correlationId,
          traceId: job.payload.eventId,
          dependency: 'supabase-postgres',
          durationMs: Math.max(0, clock.now() - startedAt),
          retryable: outcome === 'retry',
          ...(errorCode === null ? {} : { errorCode }),
          attributes: {
            dependencyKind: job.payload.kind,
            ...(run === null
              ? {}
              : {
                  examined: run.examined,
                  invalidated: run.invalidated,
                  continued: run.nextCursor !== null,
                }),
          },
          metrics: {
            'cms.review_recheck.run.total': 1,
            ...(run === null
              ? {}
              : {
                  'cms.review_recheck.examined.total': run.examined,
                  [metricKey('cms_review_invalidated_total', {
                    reason: 'dependency_changed',
                  })]: run.invalidated,
                }),
          },
        } as const;
        const options = {
          samplingClass: 'always',
          highRisk: outcome !== 'success',
        } as const;
        if (outcome === 'success') telemetry.info(details, options);
        else telemetry.warn(details, options);
      };
      const retry = (code: string): EventConsumerOutcome => {
        emit('retry', code, null);
        return retryAfterAttempt(message.attempts);
      };

      let run: ReviewDependencyRecheckRunResult;
      try {
        run = await dependencies.run(
          { ...job.payload, cursor: job.cursor },
          signal,
        );
      } catch {
        return retry('RECHECK_RUN_FAILED');
      }
      if (run.nextCursor !== null) {
        try {
          await dependencies.queue.send({ ...job, cursor: run.nextCursor });
        } catch {
          return retry('CONTINUATION_ENQUEUE_FAILED');
        }
      }
      emit('success', null, run);
      return { outcome: 'ack' };
    });
  };

  return { process };
};

export type ReviewRecheckJob = ReturnType<typeof createReviewRecheckJob>;
