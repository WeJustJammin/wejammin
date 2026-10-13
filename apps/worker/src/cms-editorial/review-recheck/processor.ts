import type { ReviewRecheckSourceEventType } from '@wejammin/contracts';

import type {
  EventConsumerMessage,
  EventConsumerOutcome,
} from '../../event-consumers/types';
import type { ReviewRecheckJob } from './job';
import { classifyReviewRecheckMessage } from './message';
import type { ReviewRecheckSourceConsumer } from './source-consumers';

export type ReviewRecheckProcessorDependencies = Readonly<{
  consumers: Readonly<
    Record<ReviewRecheckSourceEventType, ReviewRecheckSourceConsumer>
  >;
  job: ReviewRecheckJob;
}>;

/**
 * Routes a platform queue message of the dependency recheck to the consumer of
 * its source event family or to the job. The queue entrypoint only sends it
 * messages `classifyReviewRecheckMessage` recognises; anything else is retried
 * so it can reach the dead-letter queue instead of being dropped.
 */
export const createReviewRecheckProcessor = (
  dependencies: ReviewRecheckProcessorDependencies,
) => ({
  process: async (
    message: EventConsumerMessage,
  ): Promise<EventConsumerOutcome> => {
    const recognised = classifyReviewRecheckMessage(message.body);
    if (recognised === null) return { outcome: 'retry' };
    return recognised.kind === 'job'
      ? dependencies.job.process(message)
      : dependencies.consumers[recognised.eventType].process(message);
  },
});

export type ReviewRecheckProcessor = ReturnType<
  typeof createReviewRecheckProcessor
>;
