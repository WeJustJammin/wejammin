import { describe, expect, it, vi } from 'vitest';

import { createReviewRecheckProcessor } from './processor';
import { jobBody, sourceBody } from './review-recheck.test-support';
import { REVIEW_RECHECK_SOURCE_EVENT_TYPES } from '@wejammin/contracts';
import type { ReviewRecheckSourceConsumer } from './source-consumers';
import type { ReviewRecheckJob } from './job';

const build = () => {
  const consumers = Object.fromEntries(
    REVIEW_RECHECK_SOURCE_EVENT_TYPES.map((eventType) => [
      eventType,
      { process: vi.fn(async () => ({ outcome: 'ack' as const })) },
    ]),
  ) as unknown as Record<
    (typeof REVIEW_RECHECK_SOURCE_EVENT_TYPES)[number],
    ReviewRecheckSourceConsumer & { process: ReturnType<typeof vi.fn> }
  >;
  const job = {
    process: vi.fn(async () => ({ outcome: 'ack' as const })),
  } as unknown as ReviewRecheckJob & { process: ReturnType<typeof vi.fn> };
  return {
    consumers,
    job,
    processor: createReviewRecheckProcessor({ consumers, job }),
  };
};

describe('[P2-S11-AC-113] the review recheck router', () => {
  it('hands a job message to the job and nothing else', async () => {
    const { processor, consumers, job } = build();
    const message = { body: jobBody(), attempts: 1 };
    await expect(processor.process(message)).resolves.toEqual({
      outcome: 'ack',
    });
    expect(job.process).toHaveBeenCalledWith(message);
    for (const consumer of Object.values(consumers))
      expect(consumer.process).not.toHaveBeenCalled();
  });

  it.each(REVIEW_RECHECK_SOURCE_EVENT_TYPES)(
    'hands %s to its own consumer and to no other',
    async (eventType) => {
      const { processor, consumers, job } = build();
      const message = { body: sourceBody(eventType), attempts: 2 };
      await processor.process(message);
      for (const [type, consumer] of Object.entries(consumers))
        expect(consumer.process).toHaveBeenCalledTimes(
          type === eventType ? 1 : 0,
        );
      expect(consumers[eventType].process).toHaveBeenCalledWith(message);
      expect(job.process).not.toHaveBeenCalled();
    },
  );

  it('hands an unknown version to the consumer of its family, which dead-letters it', async () => {
    const { processor, consumers } = build();
    await processor.process({
      body: sourceBody('cms.pattern.activated.v1', {
        eventType: 'cms.pattern.activated.v3',
      }),
      attempts: 1,
    });
    expect(
      consumers['cms.pattern.activated.v1'].process,
    ).toHaveBeenCalledOnce();
  });

  it('retries a message that is none of its own so the queue can dead-letter it', async () => {
    const { processor, consumers, job } = build();
    await expect(
      processor.process({ body: { eventType: 'job.requested' }, attempts: 1 }),
    ).resolves.toEqual({ outcome: 'retry' });
    expect(job.process).not.toHaveBeenCalled();
    for (const consumer of Object.values(consumers))
      expect(consumer.process).not.toHaveBeenCalled();
  });
});
