import { metricKey } from '../../content-schema-registry/route-metric-key';
import { traceStepsOf } from '../observability-registry';
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
  GovernedRecheckMessageSchema,
  type GovernedRecheckRunRequest,
  type GovernedRecheckRunResult,
} from './contract';
import type { GovernedRecheckQueue } from './message';

export const GOVERNED_RECHECK_JOB_CONSUMER =
  'cms.governed-review-recheck' as const;
const EVENT_NAME = 'cms.governed_review_recheck' as const;

export type GovernedRecheckJobDependencies = Readonly<{
  /** One bounded run of the job in the database: at most 500 live reviews after the cursor. */
  run: (
    request: GovernedRecheckRunRequest,
    signal: AbortSignal,
  ) => Promise<GovernedRecheckRunResult>;
  /** The platform jobs queue, for the continuation of a run that left reviews behind. */
  queue: GovernedRecheckQueue;
  telemetry: ConsumerTelemetry;
  clock?: ConsumerClock;
}>;

/**
 * The typed platform-queue job `cms.governed_review.recheck` (BE03c "Job
 * transport", DEC-166). One queue message is one run of at most 500 live
 * governed reviews: the database selects them through the dependency index,
 * rebuilds hash, policy basis and identities of each and invalidates a review
 * that no longer holds (`dependency_changed` or `reviewer_authority_changed`).
 * A run that leaves reviews behind hands back a cursor and this job enqueues the
 * continuation message that carries it before it acknowledges.
 *
 * Delivery is at least once and every step is idempotent. A message that is not
 * exactly a governed recheck message is never acknowledged, so the platform queue
 * moves it to its dead-letter queue.
 */
export const createGovernedRecheckJob = (
  dependencies: GovernedRecheckJobDependencies,
) => {
  const clock = dependencies.clock ?? defaultConsumerClock;
  const { telemetry } = dependencies;

  const process = async (
    message: EventConsumerMessage,
  ): Promise<EventConsumerOutcome> => {
    const startedAt = clock.now();
    return runWithDeadline(async (signal) => {
      const parsed = GovernedRecheckMessageSchema.safeParse(message.body);
      if (!parsed.success) {
        telemetry.error(
          {
            eventName: `${EVENT_NAME}.admission`,
            operation: 'consume',
            consumer: GOVERNED_RECHECK_JOB_CONSUMER,
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
        run: GovernedRecheckRunResult | null,
      ): void => {
        const details = {
          eventName: EVENT_NAME,
          operation: 'run',
          consumer: GOVERNED_RECHECK_JOB_CONSUMER,
          outcome,
          attempt: Math.max(1, message.attempts),
          correlationId: job.correlationId,
          traceId: job.payload.eventId,
          dependency: 'supabase-postgres',
          durationMs: Math.max(0, clock.now() - startedAt),
          retryable: outcome === 'retry',
          ...(errorCode === null ? {} : { errorCode }),
          // BE03c Observability trace: the job rebuilds every review from canonical state through the protected RPC.
          traceSteps: traceStepsOf('consumer_refetch', 'rpc'),
          attributes: {
            dependencyKind: job.payload.kind,
            ...(run === null
              ? {}
              : {
                  examined: run.examined,
                  invalidated: run.invalidated,
                  unavailable: run.unavailable,
                  continued: run.nextCursor !== null,
                }),
          },
          metrics: {
            'cms.governed_recheck.run.total': 1,
            ...(run === null
              ? {}
              : {
                  'cms.governed_recheck.examined.total': run.examined,
                  'cms.governed_recheck.unavailable.total': run.unavailable,
                  [metricKey('cms_governed_review_invalidated_total', {
                    reason: 'dependency_changed',
                  })]: run.dependencyChanged,
                  [metricKey('cms_governed_review_invalidated_total', {
                    reason: 'reviewer_authority_changed',
                  })]: run.reviewerAuthorityChanged,
                }),
          },
        } as const;
        // DEC-218: a review whose verdict or invalidation failed (not a lock failure) is isolated, left live and
        // counted `unavailable`; the run still succeeds and is acknowledged (a retry cannot help a systemic fault),
        // so the count is what an operator sees: a success with `unavailable > 0` is logged at warn level.
        const degraded = run !== null && run.unavailable > 0;
        const options = {
          samplingClass: 'always',
          highRisk: outcome !== 'success' || degraded,
        } as const;
        if (outcome === 'success' && !degraded)
          telemetry.info(details, options);
        else telemetry.warn(details, options);
      };
      const retry = (code: string): EventConsumerOutcome => {
        emit('retry', code, null);
        return retryAfterAttempt(message.attempts);
      };

      let run: GovernedRecheckRunResult;
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

export type GovernedRecheckJob = ReturnType<typeof createGovernedRecheckJob>;
