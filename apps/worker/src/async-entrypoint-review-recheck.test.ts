import { REVIEW_RECHECK_SOURCE_EVENT_TYPES } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createAsyncEntrypoint,
  type AsyncExecutionContext,
  type AsyncWorkerBindings,
  type PlatformJobsMessage,
} from './async-entrypoint';
import {
  jobBody,
  sourceBody,
} from './cms-editorial/review-recheck/review-recheck.test-support';

const bindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'local',
  PLATFORM_JOBS: { send: vi.fn() },
  SUPABASE_SECRET_KEY: 'server-secret',
  SUPABASE_URL: 'https://staging.example.supabase.co',
} as unknown as AsyncWorkerBindings;

const executionContext = { waitUntil: vi.fn() } satisfies AsyncExecutionContext;

const message = (body: unknown, attempts = 1): PlatformJobsMessage => ({
  ack: vi.fn(),
  attempts,
  body,
  id: 'message-1',
  retry: vi.fn(),
});

const batch = (messages: readonly PlatformJobsMessage[]) => ({
  messages,
  queue: 'platform-jobs-staging',
});

describe('[P2-S11-AC-113] async entrypoint routing of the review recheck', () => {
  it.each(REVIEW_RECHECK_SOURCE_EVENT_TYPES)(
    'hands the relayed %s envelope to the review recheck seam and acknowledges',
    async (eventType) => {
      const queued = message(sourceBody(eventType), 2);
      const processReviewRecheck = vi.fn(async () => ({
        outcome: 'ack' as const,
      }));
      const processEventConsumer = vi.fn();
      const processSchemaMigration = vi.fn();
      await createAsyncEntrypoint({
        processReviewRecheck,
        processEventConsumer,
        processSchemaMigration,
      }).queue(batch([queued]), bindings, executionContext);
      expect(processReviewRecheck).toHaveBeenCalledWith({
        env: bindings,
        executionContext,
        message: queued,
      });
      expect(queued.ack).toHaveBeenCalledOnce();
      expect(queued.retry).not.toHaveBeenCalled();
      expect(processEventConsumer).not.toHaveBeenCalled();
      expect(processSchemaMigration).not.toHaveBeenCalled();
    },
  );

  it('hands a recheck job message to the same seam', async () => {
    const queued = message(jobBody());
    const processReviewRecheck = vi.fn(async () => ({
      outcome: 'ack' as const,
    }));
    await createAsyncEntrypoint({ processReviewRecheck }).queue(
      batch([queued]),
      bindings,
      executionContext,
    );
    expect(processReviewRecheck).toHaveBeenCalledOnce();
    expect(queued.ack).toHaveBeenCalledOnce();
  });

  it('keeps the full schema activation envelope with the schema migration worker', async () => {
    const queued = message({
      ...sourceBody('cms.schema.activated.v1'),
      aggregateType: 'cms.schema.migration',
      payload: { contentTypeId: 'x' },
    });
    const processReviewRecheck = vi.fn();
    const processSchemaMigration = vi.fn(async () => 'ack' as const);
    await createAsyncEntrypoint({
      processReviewRecheck,
      processSchemaMigration,
    }).queue(batch([queued]), bindings, executionContext);
    expect(processSchemaMigration).toHaveBeenCalledOnce();
    expect(processReviewRecheck).not.toHaveBeenCalled();
  });

  it('retries with the delay the recheck chose', async () => {
    const queued = message(jobBody());
    await createAsyncEntrypoint({
      processReviewRecheck: async () => ({
        outcome: 'retry',
        delaySeconds: 60,
      }),
    }).queue(batch([queued]), bindings, executionContext);
    expect(queued.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
    expect(queued.ack).not.toHaveBeenCalled();
  });

  it('retries without a delay when the recheck names none, which lets an exhausted message reach the DLQ', async () => {
    const queued = message(jobBody());
    await createAsyncEntrypoint({
      processReviewRecheck: async () => ({ outcome: 'retry' }),
    }).queue(batch([queued]), bindings, executionContext);
    expect(queued.retry).toHaveBeenCalledWith();
  });

  it('retries when no recheck is registered and when it throws', async () => {
    const unregistered = message(sourceBody('cms.schema.activated.v1'));
    await createAsyncEntrypoint().queue(
      batch([unregistered]),
      bindings,
      executionContext,
    );
    expect(unregistered.retry).toHaveBeenCalledOnce();
    expect(unregistered.ack).not.toHaveBeenCalled();

    const throwing = message(jobBody());
    await createAsyncEntrypoint({
      processReviewRecheck: async () => {
        throw new Error('boom');
      },
    }).queue(batch([throwing]), bindings, executionContext);
    expect(throwing.retry).toHaveBeenCalledOnce();
    expect(throwing.ack).not.toHaveBeenCalled();
  });

  it('retries on a wrong queue before it looks at the message', async () => {
    const queued = message(jobBody());
    const processReviewRecheck = vi.fn();
    await createAsyncEntrypoint({ processReviewRecheck }).queue(
      { messages: [queued], queue: 'platform-jobs' },
      bindings,
      executionContext,
    );
    expect(processReviewRecheck).not.toHaveBeenCalled();
    expect(queued.retry).toHaveBeenCalledOnce();
  });
});
