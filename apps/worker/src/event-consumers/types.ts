import type { Logger } from '@wejammin/observability/logging';

import type { EventConsumerRpcName } from './rpc-names';

/** What the queue entrypoint does with a consumed message. */
export type EventConsumerOutcome = Readonly<{
  outcome: 'ack' | 'retry';
  /** Queue retry delay; absent means the queue default (or its DLQ once retries are exhausted). */
  delaySeconds?: number;
}>;

export type EventConsumerMessage = Readonly<{
  body: unknown;
  /** One-based Queue delivery attempt. */
  attempts: number;
}>;

export type EventConsumerRpc = <T>(
  operation: EventConsumerRpcName,
  input: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<T>;

/** Safe identity of an event, extracted without trusting any field. */
export type DeadLetterIdentity = Readonly<{
  eventId: string | null;
  eventType: string | null;
  schemaVersion: number | null;
  aggregateType: string | null;
  aggregateId: string | null;
  aggregateVersion: string | null;
}>;

export type DeadLetterReason =
  | 'INVALID_QUEUE_PAYLOAD'
  | 'SOURCE_RECORD_NOT_FOUND'
  | 'UNKNOWN_EVENT_VERSION'
  | 'UNSUPPORTED_NOTIFICATION_TEMPLATE';

export type DeadLetterPort = Readonly<{
  /** Durably records the dead letter; throws unless the record is accepted. */
  record: (
    input: Readonly<{
      consumer: string;
      identity: DeadLetterIdentity;
      reasonCode: DeadLetterReason;
    }>,
    signal: AbortSignal,
  ) => Promise<void>;
}>;

export type ConsumerClock = Readonly<{
  now: () => number;
  randomUuid: () => string;
}>;

export type ConsumerTelemetry = Pick<Logger, 'error' | 'info' | 'warn'>;

export const defaultConsumerClock: ConsumerClock = {
  now: () => Date.now(),
  randomUuid: () => crypto.randomUUID(),
};

/** Each consumer call is bounded by the BE00 protected-command deadline. */
export const CONSUMER_DEADLINE_MS = 15_000;
