import type {
  EventConsumerMessage,
  EventConsumerOutcome,
} from '../../event-consumers/types';
import type { LinkedScanJob } from './job';
import { isLinkedScanJobMessage } from './message';
import {
  isLinkedScanSourceFamily,
  type LinkedScanSourceConsumer,
} from './source-consumer';

export type LinkedScanProcessorDependencies = Readonly<{
  job: LinkedScanJob;
  source: LinkedScanSourceConsumer;
  /** The governed recheck family (which composes the Slice 11 editorial recheck), which keeps every message this one does not own. */
  delegate: Readonly<{
    process: (message: EventConsumerMessage) => Promise<EventConsumerOutcome>;
  }>;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Routes a platform queue message of the linked-update scan. A scan job message runs in the job
 * alone. A pattern-activation source event first lets the producer put its scan job on the queue (a
 * retry returns at once, leaving the other consumers of the event untouched until the job is
 * safely queued) and then goes on to the recheck family, which consumes the same event. Every
 * other message belongs to the recheck family alone.
 */
export const createLinkedScanProcessor = (
  dependencies: LinkedScanProcessorDependencies,
) => ({
  process: async (
    message: EventConsumerMessage,
  ): Promise<EventConsumerOutcome> => {
    const { body } = message;
    if (isLinkedScanJobMessage(body)) return dependencies.job.process(message);
    if (isRecord(body) && isLinkedScanSourceFamily(body.eventType)) {
      const scan = await dependencies.source.process(message);
      if (scan.outcome !== 'ack') return scan;
    }
    return dependencies.delegate.process(message);
  },
});

export type LinkedScanProcessor = ReturnType<typeof createLinkedScanProcessor>;
