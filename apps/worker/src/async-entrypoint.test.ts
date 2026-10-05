import { describe, expect, it, vi } from 'vitest';

import {
  createAsyncEntrypoint,
  enqueuePlatformJob,
  type AsyncExecutionContext,
  type AsyncWorkerBindings,
  type PlatformJobsBatch,
  type PlatformJobsMessage,
  type PlatformJobsQueue,
} from './async-entrypoint';

const createQueue = (): PlatformJobsQueue => ({
  send: vi.fn(async () => ({
    metadata: { metrics: { backlogBytes: 0, backlogCount: 0 } },
  })),
});

const bindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'local',
  PLATFORM_JOBS: createQueue(),
  SUPABASE_SECRET_KEY: 'server-secret',
  SUPABASE_URL: 'https://staging.example.supabase.co',
} satisfies AsyncWorkerBindings;

const executionContext = {
  waitUntil: vi.fn(),
} satisfies AsyncExecutionContext;

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

const schemaMigrationEvent = {
  eventId: '44444444-4444-4444-8444-444444444444',
  eventType: 'cms.schema.activated.v1' as const,
  schemaVersion: 1 as const,
  occurredAt: '2026-09-02T12:00:00.000Z',
  producer: 'cms.schema_registry',
  correlationId: '55555555-5555-4555-8555-555555555555',
  causationId: null,
  aggregateType: 'cms.schema.migration',
  aggregateId: '66666666-6666-4666-8666-666666666666',
  aggregateVersion: '7',
  payload: {
    contentTypeId: '77777777-7777-4777-8777-777777777777',
    schemaVersionId: '88888888-8888-4888-8888-888888888888',
    migrationPlanId: null,
    localeConfigHash: 'c'.repeat(64),
    activationEvidence: {
      key: 'cms.schema.activate',
      version: '1',
      policyHash: 'a'.repeat(64),
      riskClass: 'ordinary',
      requiredDecisionCount: 1,
      requiredCapabilities: ['cms.schema_designer'],
      approvalEvidenceHash: 'b'.repeat(64),
    },
  },
} as const;

const createMessage = (body: unknown, attempts = 1): PlatformJobsMessage => ({
  ack: vi.fn(),
  attempts,
  body,
  id: 'message-1',
  retry: vi.fn(),
});

const createBatch = (
  messages: readonly PlatformJobsMessage[],
  queue = 'platform-jobs-staging',
): PlatformJobsBatch => ({ messages, queue });

describe('Worker asynchronous entrypoint', () => {
  it('sends only a validated QueueEnvelope through the typed PLATFORM_JOBS producer', async () => {
    const queue = createQueue();

    await enqueuePlatformJob(queue, envelope);

    expect(queue.send).toHaveBeenCalledWith(envelope);
    await expect(
      enqueuePlatformJob(queue, { ...envelope, schemaVersion: 2 }),
    ).rejects.toThrow();
    expect(queue.send).toHaveBeenCalledTimes(1);
  });

  it('delegates each platform queue message to application orchestration and acknowledges success', async () => {
    const message = createMessage(envelope);
    const orchestrateQueueMessage = vi.fn(async () => 'ack' as const);
    const entrypoint = createAsyncEntrypoint({ orchestrateQueueMessage });

    await entrypoint.queue(createBatch([message]), bindings, executionContext);

    expect(orchestrateQueueMessage).toHaveBeenCalledWith({
      env: bindings,
      executionContext,
      message,
    });
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it('routes validated schema activation events to the migration worker seam', async () => {
    const message = createMessage(schemaMigrationEvent);
    const processSchemaMigration = vi.fn(async () => 'ack' as const);
    const entrypoint = createAsyncEntrypoint({ processSchemaMigration });

    await entrypoint.queue(createBatch([message]), bindings, executionContext);

    expect(processSchemaMigration).toHaveBeenCalledWith({
      env: bindings,
      executionContext,
      message,
      event: schemaMigrationEvent,
    });
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it('forwards malformed schema activation candidates for worker DLQ handling', async () => {
    const malformed = { ...schemaMigrationEvent, schemaVersion: 2 };
    const message = createMessage(malformed);
    const processSchemaMigration = vi.fn(async () => 'ack' as const);
    const entrypoint = createAsyncEntrypoint({ processSchemaMigration });

    await entrypoint.queue(createBatch([message]), bindings, executionContext);

    expect(processSchemaMigration).toHaveBeenCalledWith(
      expect.objectContaining({ event: malformed }),
    );
    expect(message.ack).toHaveBeenCalledOnce();
  });

  it('keeps an exhausted schema message retryable when DLQ persistence throws', async () => {
    const message = createMessage(
      { ...schemaMigrationEvent, schemaVersion: 2 },
      4,
    );
    const processSchemaMigration = vi.fn(async () => {
      throw Object.assign(new Error('DLQ unavailable'), {
        code: 'DEPENDENCY_UNAVAILABLE',
      });
    });
    const entrypoint = createAsyncEntrypoint({ processSchemaMigration });

    await entrypoint.queue(createBatch([message]), bindings, executionContext);

    expect(processSchemaMigration).toHaveBeenCalledOnce();
    expect(message.retry).toHaveBeenCalledOnce();
    expect(message.ack).not.toHaveBeenCalled();
  });

  it('admits the platform queue name assigned to each hosted environment', async () => {
    const stagingMessage = createMessage(envelope);
    const productionMessage = createMessage(envelope);
    const orchestrateQueueMessage = vi.fn(async () => 'ack' as const);
    const entrypoint = createAsyncEntrypoint({ orchestrateQueueMessage });

    await entrypoint.queue(
      createBatch([stagingMessage], 'platform-jobs-staging'),
      bindings,
      executionContext,
    );
    await entrypoint.queue(
      createBatch([productionMessage], 'platform-jobs'),
      { ...bindings, APP_ENVIRONMENT: 'production' },
      executionContext,
    );

    expect(orchestrateQueueMessage).toHaveBeenCalledTimes(2);
    expect(stagingMessage.ack).toHaveBeenCalledOnce();
    expect(productionMessage.ack).toHaveBeenCalledOnce();
    expect(stagingMessage.retry).not.toHaveBeenCalled();
    expect(productionMessage.retry).not.toHaveBeenCalled();
  });

  it('retries a message when application orchestration returns retry', async () => {
    const message = createMessage(envelope);
    const entrypoint = createAsyncEntrypoint({
      orchestrateQueueMessage: async () => 'retry' as const,
    });

    await entrypoint.queue(createBatch([message]), bindings, executionContext);

    expect(message.retry).toHaveBeenCalledOnce();
    expect(message.ack).not.toHaveBeenCalled();
  });

  it('retries a message when orchestration throws or is unavailable', async () => {
    const failedMessage = createMessage(envelope);
    const throwingEntrypoint = createAsyncEntrypoint({
      orchestrateQueueMessage: async () => {
        throw new Error('dependency unavailable');
      },
    });
    await throwingEntrypoint.queue(
      createBatch([failedMessage]),
      bindings,
      executionContext,
    );
    expect(failedMessage.retry).toHaveBeenCalledOnce();
    expect(failedMessage.ack).not.toHaveBeenCalled();

    const unavailableMessage = createMessage(envelope);
    await createAsyncEntrypoint().queue(
      createBatch([unavailableMessage]),
      bindings,
      executionContext,
    );
    expect(unavailableMessage.retry).toHaveBeenCalledOnce();
    expect(unavailableMessage.ack).not.toHaveBeenCalled();
  });

  it('retries schema candidates when migration processing is unavailable or asks for retry', async () => {
    const unavailableMessage = createMessage(schemaMigrationEvent);
    await createAsyncEntrypoint().queue(
      createBatch([unavailableMessage]),
      bindings,
      executionContext,
    );
    expect(unavailableMessage.retry).toHaveBeenCalledOnce();
    expect(unavailableMessage.ack).not.toHaveBeenCalled();

    const retryMessage = createMessage(schemaMigrationEvent);
    await createAsyncEntrypoint({
      processSchemaMigration: async () => 'retry' as const,
    }).queue(createBatch([retryMessage]), bindings, executionContext);
    expect(retryMessage.retry).toHaveBeenCalledOnce();
    expect(retryMessage.ack).not.toHaveBeenCalled();
  });

  it('fails closed for a queue that is not the registered platform queue', async () => {
    const message = createMessage(envelope);
    const orchestrateQueueMessage = vi.fn(async () => 'ack' as const);
    const entrypoint = createAsyncEntrypoint({ orchestrateQueueMessage });

    await entrypoint.queue(
      createBatch([message], 'unregistered-queue'),
      bindings,
      executionContext,
    );

    expect(orchestrateQueueMessage).not.toHaveBeenCalled();
    expect(message.retry).toHaveBeenCalledOnce();
    expect(message.ack).not.toHaveBeenCalled();
  });

  it('delegates the one-minute scheduled sweep and leaves Cloudflare retries enabled', async () => {
    const controller = {
      cron: '* * * * *',
      scheduledTime: 1_756_560_000_000,
    };
    const sweepOutbox = vi.fn(async () => 'completed' as const);
    const entrypoint = createAsyncEntrypoint({ sweepOutbox });

    await entrypoint.scheduled(controller, bindings, executionContext);

    expect(sweepOutbox).toHaveBeenCalledWith({
      controller,
      env: bindings,
      executionContext,
    });
  });

  it('throws when the scheduled sweep is unavailable or requests retry', async () => {
    const controller = {
      cron: '* * * * *',
      scheduledTime: 1_756_560_000_000,
    };

    await expect(
      createAsyncEntrypoint().scheduled(controller, bindings, executionContext),
    ).rejects.toThrow();
    await expect(
      createAsyncEntrypoint({
        sweepOutbox: async () => 'retry' as const,
      }).scheduled(controller, bindings, executionContext),
    ).rejects.toThrow();
  });
});
