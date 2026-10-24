import type {
  EventConsumerMessage,
  EventConsumerOutcome,
} from '../../event-consumers/types';
import type { GovernedRecheckJob } from './job';
import { isGovernedRecheckJobMessage } from './message';
import {
  isGovernedRecheckSourceFamily,
  type GovernedRecheckSourceConsumer,
  type GovernedRecheckSourceEventType,
} from './source-consumers';

export type GovernedRecheckProcessorDependencies = Readonly<{
  job: GovernedRecheckJob;
  sources: Readonly<
    Record<GovernedRecheckSourceEventType, GovernedRecheckSourceConsumer>
  >;
  /** The Slice 11 editorial review recheck, which keeps every message this one does not own. */
  delegate: Readonly<{
    process: (message: EventConsumerMessage) => Promise<EventConsumerOutcome>;
  }>;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Routes a platform queue message of the review recheck family. A governed job
 * message runs in the governed job alone. A source event of the three governed
 * families first lets the governed producer put its job on the queue (a retry
 * returns at once, leaving the editorial recheck untouched until the job is
 * safely queued) and then goes to the editorial recheck, which consumes the
 * same event. Every other message belongs to the editorial recheck alone.
 */
export const createGovernedRecheckProcessor = (
  dependencies: GovernedRecheckProcessorDependencies,
) => ({
  process: async (
    message: EventConsumerMessage,
  ): Promise<EventConsumerOutcome> => {
    const { body } = message;
    if (isGovernedRecheckJobMessage(body))
      return dependencies.job.process(message);
    if (isRecord(body) && isGovernedRecheckSourceFamily(body.eventType)) {
      const eventType = body.eventType.replace(
        /\.v[0-9]+$/u,
        '.v1',
      ) as GovernedRecheckSourceEventType;
      const governed = await dependencies.sources[eventType].process(message);
      if (governed.outcome !== 'ack') return governed;
    }
    return dependencies.delegate.process(message);
  },
});

export type GovernedRecheckProcessor = ReturnType<
  typeof createGovernedRecheckProcessor
>;
