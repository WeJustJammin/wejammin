import { runWithDeadline } from '../../event-consumers/deadline';
import {
  defaultConsumerClock,
  type ConsumerClock,
  type ConsumerTelemetry,
  type EventConsumerMessage,
  type EventConsumerOutcome,
} from '../../event-consumers/types';
import { traceStepsOf } from '../observability-registry';
import {
  LinkedScanMessageSchema,
  type LinkedScanRunRequest,
  type LinkedScanRunResult,
} from './contract';
import type { LinkedScanQueue } from './message';
import { linkedScanRetry } from './retry';

export const LINKED_SCAN_JOB_CONSUMER = 'cms.linked-update-scan' as const;
const EVENT_NAME = 'cms.linked_update_scan' as const;

export type LinkedScanJobDependencies = Readonly<{
  /** One bounded run of the job in the database: at most 500 instances after the cursor. */
  run: (
    request: LinkedScanRunRequest,
    signal: AbortSignal,
  ) => Promise<LinkedScanRunResult>;
  /** The platform jobs queue, for the continuation of a run that left instances behind. */
  queue: LinkedScanQueue;
  telemetry: ConsumerTelemetry;
  clock?: ConsumerClock;
  /** The jitter sample source, a number in `[0, 1)`; `Math.random` by default. */
  random?: () => number;
}>;

/**
 * The typed platform-queue job `cms.pattern.linked_update_scan` (BE03c "Linked update", "Job
 * transport", DEC-166). One queue message is one run of at most 500 instances: the database
 * selects the linked instances on draft revisions whose pin is older than the activated version
 * and whose entry type is compatible, and appends a `pending_diff` row for each. A run that leaves
 * instances behind hands back a cursor and this job enqueues the continuation message that carries
 * it before it acknowledges. The rows a run appended increment
 * `cms_pattern_linked_update_pending_total`, whether or not the continuation could be enqueued
 * (the rows are committed either way, and a redelivery appends none of them again).
 *
 * Delivery is at least once and every step is idempotent. A message that is not exactly a scan
 * message is never acknowledged, so the platform queue moves it to its dead-letter queue.
 */
export const createLinkedScanJob = (
  dependencies: LinkedScanJobDependencies,
) => {
  const clock = dependencies.clock ?? defaultConsumerClock;
  const random = dependencies.random ?? Math.random;
  const { telemetry } = dependencies;

  const process = async (
    message: EventConsumerMessage,
  ): Promise<EventConsumerOutcome> => {
    const startedAt = clock.now();
    return runWithDeadline(async (signal) => {
      const parsed = LinkedScanMessageSchema.safeParse(message.body);
      if (!parsed.success) {
        telemetry.error(
          {
            eventName: `${EVENT_NAME}.admission`,
            operation: 'consume',
            consumer: LINKED_SCAN_JOB_CONSUMER,
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
        run: LinkedScanRunResult | null,
      ): void => {
        const details = {
          eventName: EVENT_NAME,
          operation: 'run',
          consumer: LINKED_SCAN_JOB_CONSUMER,
          outcome,
          attempt: Math.max(1, message.attempts),
          correlationId: job.correlationId,
          traceId: job.correlationId,
          dependency: 'supabase-postgres',
          durationMs: Math.max(0, clock.now() - startedAt),
          retryable: outcome === 'retry',
          ...(errorCode === null ? {} : { errorCode }),
          // BE03c Observability trace: the job rebuilds every candidate from canonical state through the protected RPC.
          traceSteps: traceStepsOf('consumer_refetch', 'rpc'),
          ...(run === null
            ? {}
            : {
                attributes: {
                  examined: run.examined,
                  appended: run.appended,
                  continued: run.nextCursor !== null,
                },
              }),
          metrics: {
            'cms.linked_scan.run.total': 1,
            ...(run === null
              ? {}
              : {
                  'cms.linked_scan.examined.total': run.examined,
                  // BE03c Observability: the pending_diff rows the scan appended.
                  cms_pattern_linked_update_pending_total: run.appended,
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

      let run: LinkedScanRunResult;
      try {
        run = await dependencies.run(
          {
            ...job.payload,
            cursor: job.cursor,
            correlationId: job.correlationId,
          },
          signal,
        );
      } catch {
        emit('retry', 'LINKED_SCAN_RUN_FAILED', null);
        return linkedScanRetry(message.attempts, random);
      }
      if (run.nextCursor !== null) {
        try {
          await dependencies.queue.send({ ...job, cursor: run.nextCursor });
        } catch {
          emit('retry', 'CONTINUATION_ENQUEUE_FAILED', run);
          return linkedScanRetry(message.attempts, random);
        }
      }
      emit('success', null, run);
      return { outcome: 'ack' };
    });
  };

  return { process };
};

export type LinkedScanJob = ReturnType<typeof createLinkedScanJob>;
