import { ReviewRecheckSourceEnvelopeSchema } from '@wejammin/contracts';

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
  CMS_LINKED_SCAN_JOB_TYPE,
  type LinkedScanEventResolution,
  type LinkedScanMessage,
} from './contract';
import type { LinkedScanQueue } from './message';
import { linkedScanRetry } from './retry';

const EVENT_NAME = 'cms.linked_update_scan_source' as const;

/** The one event whose consumer enqueues the scan (BE03c "Event schemas"). */
export const LINKED_SCAN_SOURCE_EVENT_TYPE =
  'cms.pattern.activated.v1' as const;

export const LINKED_SCAN_SOURCE_CONSUMER =
  'cms.linked-scan.pattern-activated' as const;

/** True for every version of the pattern-activated family (an unknown version included). */
export const isLinkedScanSourceFamily = (
  eventType: unknown,
): eventType is string =>
  typeof eventType === 'string' &&
  /^cms\.pattern\.activated\.v[0-9]+$/u.test(eventType);

export type LinkedScanSourceDependencies = Readonly<{
  /** Rereads the committed event as the job payload it names. */
  resolveEvent: (
    eventId: string,
    signal: AbortSignal,
  ) => Promise<LinkedScanEventResolution>;
  /** Puts the `cms.pattern.linked_update_scan` job on the platform jobs queue. */
  queue: LinkedScanQueue;
  telemetry: ConsumerTelemetry;
  clock?: ConsumerClock;
  /** The jitter sample source, a number in `[0, 1)`; `Math.random` by default. */
  random?: () => number;
}>;

/**
 * The producer of the linked-update scan. It rereads the committed `cms.pattern.activated.v1`
 * event and enqueues `cms.pattern.linked_update_scan` with `{ patternId, patternVersionId }`. It never
 * treats the event as proof that anything is pending: the job rebuilds every candidate from
 * canonical state.
 *
 * The editorial recheck consumer (Slice 11) owns the dead letter of the same envelope, so an
 * envelope that is not exactly this event's v1 envelope and an event the database cannot resolve
 * are acknowledged here without a dead letter.
 */
export const createLinkedScanSourceConsumer = (
  dependencies: LinkedScanSourceDependencies,
) => {
  const clock = dependencies.clock ?? defaultConsumerClock;
  const random = dependencies.random ?? Math.random;
  const { telemetry } = dependencies;

  const process = async (
    message: EventConsumerMessage,
  ): Promise<EventConsumerOutcome> => {
    const startedAt = clock.now();
    return runWithDeadline(async (signal) => {
      const parsed = ReviewRecheckSourceEnvelopeSchema.safeParse(message.body);
      if (
        !parsed.success ||
        parsed.data.eventType !== LINKED_SCAN_SOURCE_EVENT_TYPE
      )
        return { outcome: 'ack' };
      const envelope = parsed.data;
      const emit = (
        outcome: 'success' | 'retry' | 'failure',
        errorCode: string | null,
      ): void => {
        const details = {
          eventName: EVENT_NAME,
          operation: 'enqueue',
          consumer: LINKED_SCAN_SOURCE_CONSUMER,
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
          // BE03c Observability trace: the consumer rereads the committed event before it enqueues anything.
          traceSteps: traceStepsOf('consumer_refetch'),
          metrics: { 'cms.linked_scan.enqueue.total': 1 },
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
        return linkedScanRetry(message.attempts, random);
      };

      let resolution: LinkedScanEventResolution;
      try {
        resolution = await dependencies.resolveEvent(envelope.eventId, signal);
      } catch {
        return retry('EVENT_READ_FAILED');
      }
      if (!resolution.found) {
        emit('failure', 'SOURCE_RECORD_NOT_FOUND');
        return { outcome: 'ack' };
      }

      const job: LinkedScanMessage = {
        jobType: CMS_LINKED_SCAN_JOB_TYPE,
        schemaVersion: 1,
        payload: {
          patternId: resolution.patternId,
          patternVersionId: resolution.patternVersionId,
        },
        cursor: null,
        correlationId: envelope.correlationId,
      };
      try {
        await dependencies.queue.send(job);
      } catch {
        return retry('LINKED_SCAN_ENQUEUE_FAILED');
      }
      emit('success', null);
      return { outcome: 'ack' };
    });
  };

  return { process };
};

export type LinkedScanSourceConsumer = ReturnType<
  typeof createLinkedScanSourceConsumer
>;
