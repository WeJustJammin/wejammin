import { describe, expect, it, vi } from 'vitest';

import {
  createAsyncEntrypoint,
  type AsyncExecutionContext,
  type AsyncWorkerBindings,
  type PlatformJobsMessage,
} from './async-entrypoint';

const bindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'local',
  PLATFORM_JOBS: { send: vi.fn() },
  SUPABASE_SECRET_KEY: 'server-secret',
  SUPABASE_URL: 'https://staging.example.supabase.co',
} as unknown as AsyncWorkerBindings;

const executionContext = { waitUntil: vi.fn() } satisfies AsyncExecutionContext;

const consumerBody = (eventType: string, aggregateType: string) => ({
  eventId: '11111111-1111-4111-8111-111111111111',
  eventType,
  schemaVersion: 1,
  aggregateType,
  aggregateId: '22222222-2222-4222-8222-222222222222',
  aggregateVersion: '4',
  correlationId: '33333333-3333-4333-8333-333333333333',
  causationId: null,
});

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

describe('async entrypoint event consumer routing', () => {
  it.each([
    'identity.mfa-factor.changed.v1',
    'identity.security-notification.requested.v1',
    'cms.capability.grant.changed.v1',
    'cms.capability.grant.changed.v2',
  ])(
    '[P2-S09-AC-913] hands %s to the registered event consumer seam',
    async (eventType) => {
      const queued = message(consumerBody(eventType, 'x'), 3);
      const processEventConsumer = vi.fn(async () => ({
        outcome: 'ack' as const,
      }));
      await createAsyncEntrypoint({ processEventConsumer }).queue(
        batch([queued]),
        bindings,
        executionContext,
      );
      expect(processEventConsumer).toHaveBeenCalledWith({
        env: bindings,
        executionContext,
        message: queued,
      });
      expect(queued.ack).toHaveBeenCalledOnce();
      expect(queued.retry).not.toHaveBeenCalled();
    },
  );

  it('[P2-S09-AC-916] retries with the consumer-chosen delay', async () => {
    const queued = message(
      consumerBody(
        'identity.security-notification.requested.v1',
        'security_event',
      ),
    );
    await createAsyncEntrypoint({
      processEventConsumer: async () => ({
        outcome: 'retry',
        delaySeconds: 60,
      }),
    }).queue(batch([queued]), bindings, executionContext);
    expect(queued.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
    expect(queued.ack).not.toHaveBeenCalled();
  });

  it('retries without a delay when the consumer names none, which lets an exhausted message reach the DLQ', async () => {
    const queued = message(
      consumerBody('identity.mfa-factor.changed.v1', 'mfa_factor'),
      4,
    );
    await createAsyncEntrypoint({
      processEventConsumer: async () => ({ outcome: 'retry' }),
    }).queue(batch([queued]), bindings, executionContext);
    expect(queued.retry).toHaveBeenCalledWith();
  });

  it('retries when no consumer is registered, when it throws, and on a wrong queue', async () => {
    const body = consumerBody(
      'cms.capability.grant.changed.v1',
      'cms_capability_grant',
    );
    const unregistered = message(body);
    await createAsyncEntrypoint().queue(
      batch([unregistered]),
      bindings,
      executionContext,
    );
    expect(unregistered.retry).toHaveBeenCalledOnce();

    const throwing = message(body);
    await createAsyncEntrypoint({
      processEventConsumer: async () => {
        throw new Error('boom');
      },
    }).queue(batch([throwing]), bindings, executionContext);
    expect(throwing.retry).toHaveBeenCalledOnce();

    const wrongQueue = message(body);
    const processEventConsumer = vi.fn(async () => ({
      outcome: 'ack' as const,
    }));
    await createAsyncEntrypoint({ processEventConsumer }).queue(
      { messages: [wrongQueue], queue: 'platform-jobs' },
      bindings,
      executionContext,
    );
    expect(processEventConsumer).not.toHaveBeenCalled();
    expect(wrongQueue.retry).toHaveBeenCalledOnce();
  });

  it('keeps job and schema-migration routing unchanged', async () => {
    const processEventConsumer = vi.fn(async () => ({
      outcome: 'ack' as const,
    }));
    const orchestrateQueueMessage = vi.fn(async () => 'ack' as const);
    const job = message({
      ...consumerBody('job.requested', 'job'),
    });
    await createAsyncEntrypoint({
      processEventConsumer,
      orchestrateQueueMessage,
    }).queue(batch([job]), bindings, executionContext);
    expect(orchestrateQueueMessage).toHaveBeenCalledOnce();
    expect(processEventConsumer).not.toHaveBeenCalled();
  });
});

describe('async entrypoint scheduled reconciling-age sample', () => {
  const controller = { cron: '* * * * *', scheduledTime: 1_756_560_000_000 };

  it('[P2-S09-AC-908] samples the reconciling age on every outbox sweep tick', async () => {
    const observeReconcilingAge = vi.fn(async () => undefined);
    const sweepOutbox = vi.fn(async () => 'completed' as const);
    await createAsyncEntrypoint({
      observeReconcilingAge,
      sweepOutbox,
    }).scheduled(controller, bindings, executionContext);
    expect(sweepOutbox).toHaveBeenCalledOnce();
    expect(observeReconcilingAge).toHaveBeenCalledWith({
      controller,
      env: bindings,
      executionContext,
    });
  });

  it('[P2-S09-AC-908] a failing sample never fails or skips the sweep', async () => {
    const sweepOutbox = vi.fn(async () => 'completed' as const);
    await expect(
      createAsyncEntrypoint({
        observeReconcilingAge: async () => {
          throw new Error('probe');
        },
        sweepOutbox,
      }).scheduled(controller, bindings, executionContext),
    ).resolves.toBeUndefined();
    expect(sweepOutbox).toHaveBeenCalledOnce();
  });

  it('still samples when the sweep requests a retry, and the retry still surfaces', async () => {
    const observeReconcilingAge = vi.fn(async () => undefined);
    await expect(
      createAsyncEntrypoint({
        observeReconcilingAge,
        sweepOutbox: async () => 'retry' as const,
      }).scheduled(controller, bindings, executionContext),
    ).rejects.toThrow('Outbox sweep requested retry');
    expect(observeReconcilingAge).toHaveBeenCalledOnce();
  });

  it('does not sample on a cron the sweep does not own', async () => {
    const observeReconcilingAge = vi.fn(async () => undefined);
    await expect(
      createAsyncEntrypoint({
        observeReconcilingAge,
        sweepOutbox: async () => 'completed' as const,
      }).scheduled(
        { ...controller, cron: '0 * * * *' },
        bindings,
        executionContext,
      ),
    ).rejects.toThrow('Outbox sweep dependency unavailable');
    expect(observeReconcilingAge).not.toHaveBeenCalled();
  });
});
