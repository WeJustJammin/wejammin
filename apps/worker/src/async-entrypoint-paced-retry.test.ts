/**
 * DEC-184: an orchestration outcome of `{ outcome: 'retry', delaySeconds }` is the BE00 paced redelivery;
 * every other outcome keeps the bare `retry()` or `ack()` it always had.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  createAsyncEntrypoint,
  type AsyncWorkerBindings,
  type JobQueueMessageOutcome,
} from './async-entrypoint';

const envelope = {
  aggregateId: '11111111-1111-4111-8111-111111111111',
  aggregateType: 'job',
  aggregateVersion: '1',
  causationId: null,
  correlationId: '22222222-2222-4222-8222-222222222222',
  eventId: '33333333-3333-4333-8333-333333333333',
  eventType: 'job.requested',
  schemaVersion: 1,
} as const;
const env = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'paced',
  PLATFORM_JOBS: { send: vi.fn() },
  SUPABASE_SECRET_KEY: 'server-secret',
  SUPABASE_URL: 'https://staging.example.supabase.co',
} satisfies AsyncWorkerBindings;

const deliver = async (outcome: unknown) => {
  const ack = vi.fn();
  const retry = vi.fn();
  await createAsyncEntrypoint({
    orchestrateQueueMessage: async () => outcome as JobQueueMessageOutcome,
  }).queue(
    {
      queue: 'platform-jobs-staging',
      messages: [{ ack, retry, attempts: 1, body: envelope, id: 'm' }],
    },
    env,
    { waitUntil: vi.fn() },
  );
  return { ack, retry };
};

describe('[P2-S12-AC-050] paced Job redelivery in the queue handler (DEC-184)', () => {
  it.each([15, 60, 300])(
    'redelivers after %s seconds',
    async (delaySeconds) => {
      const { ack, retry } = await deliver({ outcome: 'retry', delaySeconds });
      expect(retry.mock.calls).toEqual([[{ delaySeconds }]]);
      expect(ack).not.toHaveBeenCalled();
    },
  );

  it('keeps the bare retry and the acknowledgement', async () => {
    const retried = await deliver('retry');
    expect(retried.retry.mock.calls).toEqual([[]]);
    const acked = await deliver('ack');
    expect(acked.ack).toHaveBeenCalledTimes(1);
    expect(acked.retry).not.toHaveBeenCalled();
  });

  it.each([
    ['a zero delay', { outcome: 'retry', delaySeconds: 0 }],
    ['a negative delay', { outcome: 'retry', delaySeconds: -5 }],
    ['a fractional delay', { outcome: 'retry', delaySeconds: 1.5 }],
    ['a non-finite delay', { outcome: 'retry', delaySeconds: Number.NaN }],
    ['a missing delay', { outcome: 'retry' }],
    ['null', null],
    ['an unknown word', 'later'],
  ])(
    'falls back to a bare retry for %s and never acknowledges it',
    async (_label, outcome) => {
      const { ack, retry } = await deliver(outcome);
      expect(retry.mock.calls).toEqual([[]]);
      expect(ack).not.toHaveBeenCalled();
    },
  );
});
