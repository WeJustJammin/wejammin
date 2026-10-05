import {
  isConsumerEventType,
  type ConsumerQueueEnvelope,
  QueueEnvelopeSchema,
  type QueueEnvelope,
} from '@wejammin/contracts';
import type { ServerEnvironment } from '@wejammin/config/environment';

import type { EventConsumerOutcome } from './event-consumers/types';
import {
  SchemaMigrationQueueEnvelopeSchema,
  type SchemaMigrationQueueEnvelope,
} from './content-schema-registry/migration-worker';

const PLATFORM_QUEUE_NAMES = {
  development: 'platform-jobs',
  production: 'platform-jobs',
  staging: 'platform-jobs-staging',
} as const satisfies Record<ServerEnvironment['APP_ENVIRONMENT'], string>;
const OUTBOX_SWEEP_CRON = '* * * * *' as const;

type MaybePromise<T> = T | Promise<T>;

export type PlatformJobsQueue = Pick<
  Queue<QueueEnvelope | ConsumerQueueEnvelope>,
  'send'
>;

export type AsyncWorkerBindings = ServerEnvironment &
  Readonly<{
    CLOUDFLARE_ACCOUNT_ID?: string;
    CLOUDFLARE_OBSERVABILITY_API_TOKEN?: string;
    CLOUDFLARE_PLATFORM_DLQ_ID?: string;
    PLATFORM_JOBS: PlatformJobsQueue;
    PLATFORM_ALERT_EMAIL?: Readonly<{
      send: (message: Readonly<Record<string, unknown>>) => Promise<unknown>;
    }>;
  }>;

export type PlatformJobsMessage = Pick<
  Message<unknown>,
  'ack' | 'attempts' | 'body' | 'id' | 'retry'
> &
  Readonly<{ timestamp?: Date }>;

export type PlatformJobsBatch = Readonly<{
  messages: readonly PlatformJobsMessage[];
  queue: string;
}>;

export type AsyncExecutionContext = Pick<ExecutionContext, 'waitUntil'>;

export type AsyncScheduledController = Pick<
  ScheduledController,
  'cron' | 'scheduledTime'
>;

export type QueueMessageOutcome = 'ack' | 'retry';
export type OutboxSweepOutcome = 'completed' | 'retry';

export type QueueOrchestrationInput = Readonly<{
  env: AsyncWorkerBindings;
  executionContext: AsyncExecutionContext;
  message: PlatformJobsMessage;
}>;

export type SchemaMigrationOrchestrationInput = Readonly<{
  env: AsyncWorkerBindings;
  executionContext: AsyncExecutionContext;
  message: PlatformJobsMessage;
  /** The raw queue body is retained so malformed events can be DLQ'd. */
  event: SchemaMigrationQueueEnvelope | unknown;
}>;

export type EventConsumerOrchestrationInput = Readonly<{
  env: AsyncWorkerBindings;
  executionContext: AsyncExecutionContext;
  message: PlatformJobsMessage;
}>;

export type OutboxSweepInput = Readonly<{
  controller: AsyncScheduledController;
  env: AsyncWorkerBindings;
  executionContext: AsyncExecutionContext;
}>;

export type AsyncEntrypointDependencies = Readonly<{
  orchestrateQueueMessage?: (
    input: QueueOrchestrationInput,
  ) => MaybePromise<QueueMessageOutcome>;
  processSchemaMigration?: (
    input: SchemaMigrationOrchestrationInput,
  ) => MaybePromise<QueueMessageOutcome>;
  /**
   * Registered event consumers (BE01a identity consumers, BE03a grant
   * consumer). Receives every message of a consumer event family at any
   * version; the consumer decides ack, delayed retry or durable dead letter.
   */
  processEventConsumer?: (
    input: EventConsumerOrchestrationInput,
  ) => MaybePromise<EventConsumerOutcome>;
  sweepOutbox?: (input: OutboxSweepInput) => MaybePromise<OutboxSweepOutcome>;
  /**
   * Samples the oldest reconciling MFA factor age once per sweep tick. It is
   * observability only: a rejection is contained and never fails the sweep.
   */
  observeReconcilingAge?: (input: OutboxSweepInput) => MaybePromise<void>;
}>;

export type AsyncEntrypoint = Readonly<{
  queue: (
    batch: PlatformJobsBatch,
    env: AsyncWorkerBindings,
    executionContext: AsyncExecutionContext,
  ) => Promise<void>;
  scheduled: (
    controller: AsyncScheduledController,
    env: AsyncWorkerBindings,
    executionContext: AsyncExecutionContext,
  ) => Promise<void>;
}>;

const retryMessage = (message: PlatformJobsMessage): void => {
  message.retry();
};

const isEventConsumerCandidate = (body: unknown): boolean =>
  typeof body === 'object' &&
  body !== null &&
  !Array.isArray(body) &&
  isConsumerEventType((body as { eventType?: unknown }).eventType);

const isSchemaMigrationCandidate = (body: unknown): boolean =>
  typeof body === 'object' &&
  body !== null &&
  !Array.isArray(body) &&
  typeof (body as { eventType?: unknown }).eventType === 'string' &&
  (body as { eventType: string }).eventType.startsWith('cms.schema.');

export const enqueuePlatformJob = async (
  queue: PlatformJobsQueue,
  envelope: unknown,
): Promise<void> => {
  const validatedEnvelope = QueueEnvelopeSchema.parse(envelope);
  await queue.send(validatedEnvelope);
};

export const createAsyncEntrypoint = (
  dependencies: AsyncEntrypointDependencies = {},
): AsyncEntrypoint => ({
  queue: async (batch, env, executionContext): Promise<void> => {
    for (const message of batch.messages) {
      if (batch.queue !== PLATFORM_QUEUE_NAMES[env.APP_ENVIRONMENT]) {
        retryMessage(message);
        continue;
      }

      if (isSchemaMigrationCandidate(message.body)) {
        if (dependencies.processSchemaMigration === undefined) {
          retryMessage(message);
          continue;
        }
        const event = SchemaMigrationQueueEnvelopeSchema.safeParse(
          message.body,
        );
        try {
          const outcome = await dependencies.processSchemaMigration({
            env,
            executionContext,
            message,
            event: event.success ? event.data : message.body,
          });
          if (outcome === 'ack') message.ack();
          else retryMessage(message);
        } catch {
          retryMessage(message);
        }
        continue;
      }

      if (isEventConsumerCandidate(message.body)) {
        if (dependencies.processEventConsumer === undefined) {
          retryMessage(message);
          continue;
        }
        try {
          const result = await dependencies.processEventConsumer({
            env,
            executionContext,
            message,
          });
          if (result.outcome === 'ack') message.ack();
          else if (result.delaySeconds === undefined) retryMessage(message);
          else message.retry({ delaySeconds: result.delaySeconds });
        } catch {
          retryMessage(message);
        }
        continue;
      }

      if (dependencies.orchestrateQueueMessage === undefined) {
        retryMessage(message);
        continue;
      }
      const envelope = QueueEnvelopeSchema.safeParse(message.body);
      if (
        !envelope.success ||
        envelope.data.eventType !== 'job.requested' ||
        envelope.data.schemaVersion !== 1 ||
        envelope.data.aggregateType !== 'job'
      ) {
        retryMessage(message);
        continue;
      }

      try {
        const outcome = await dependencies.orchestrateQueueMessage({
          env,
          executionContext,
          message,
        });
        if (outcome === 'ack') {
          message.ack();
        } else {
          retryMessage(message);
        }
      } catch {
        retryMessage(message);
      }
    }
  },

  scheduled: async (controller, env, executionContext): Promise<void> => {
    if (
      controller.cron !== OUTBOX_SWEEP_CRON ||
      dependencies.sweepOutbox === undefined
    ) {
      throw new Error('Outbox sweep dependency unavailable');
    }

    const input = { controller, env, executionContext };
    const sample = (async (): Promise<void> => {
      try {
        await dependencies.observeReconcilingAge?.(input);
      } catch {
        // Observability only; the sweep outcome decides success.
      }
    })();
    let outcome: OutboxSweepOutcome;
    try {
      outcome = await dependencies.sweepOutbox(input);
    } finally {
      await sample;
    }
    if (outcome !== 'completed') {
      throw new Error('Outbox sweep requested retry');
    }
  },
});
