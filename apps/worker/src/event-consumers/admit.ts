import { isConsumerEventType } from '@wejammin/contracts';

import type {
  ConsumerTelemetry,
  DeadLetterIdentity,
  DeadLetterPort,
  DeadLetterReason,
  EventConsumerMessage,
  EventConsumerOutcome,
} from './types';

type EnvelopeSchema<T> = Readonly<{
  safeParse: (
    value: unknown,
  ) => Readonly<{ success: true; data: T }> | Readonly<{ success: false }>;
}>;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const EVENT_TYPE = /^[a-z][a-z0-9._-]{0,159}$/u;
const AGGREGATE_TYPE = /^[a-z][a-z0-9_.:-]{0,127}$/u;
const VERSION = /^[1-9][0-9]{0,18}$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const matching = (value: unknown, pattern: RegExp): string | null =>
  typeof value === 'string' && pattern.test(value) ? value : null;

/**
 * Extracts only identifiers that match their canonical shape, so a hostile
 * body can never reach the dead-letter record or a log line.
 */
export const safeEventIdentity = (body: unknown): DeadLetterIdentity => {
  const source = isRecord(body) ? body : {};
  return {
    eventId: matching(source.eventId, UUID),
    eventType: matching(source.eventType, EVENT_TYPE),
    schemaVersion:
      typeof source.schemaVersion === 'number' &&
      Number.isInteger(source.schemaVersion) &&
      source.schemaVersion >= 1 &&
      source.schemaVersion <= 100
        ? source.schemaVersion
        : null,
    aggregateType: matching(source.aggregateType, AGGREGATE_TYPE),
    aggregateId: matching(source.aggregateId, UUID),
    aggregateVersion: matching(source.aggregateVersion, VERSION),
  };
};

/** An event of a known family at any version but exactly v1 is an unknown version. */
const reasonFor = (body: unknown): DeadLetterReason => {
  if (!isRecord(body) || !isConsumerEventType(body.eventType))
    return 'INVALID_QUEUE_PAYLOAD';
  const exactlyV1 = body.schemaVersion === 1 && body.eventType.endsWith('.v1');
  return exactlyV1 ? 'INVALID_QUEUE_PAYLOAD' : 'UNKNOWN_EVENT_VERSION';
};

export type AdmitInput<T> = Readonly<{
  consumer: string;
  schema: EnvelopeSchema<T>;
  message: EventConsumerMessage;
  deadLetter: DeadLetterPort;
  telemetry: ConsumerTelemetry;
  signal: AbortSignal;
}>;

export type Admission<T> =
  | Readonly<{ ok: true; envelope: T }>
  | Readonly<{ ok: false; outcome: EventConsumerOutcome }>;

/**
 * Validates one queue message against its consumer's exact envelope. A
 * message that is not exactly that envelope is recorded durably as a dead
 * letter (unknown versions included) and acknowledged; if the record cannot
 * be written the message is retried so it is never silently dropped.
 */
export const admitConsumerEvent = async <T>(
  input: AdmitInput<T>,
): Promise<Admission<T>> => {
  const parsed = input.schema.safeParse(input.message.body);
  if (parsed.success) return { ok: true, envelope: parsed.data };
  const reasonCode = reasonFor(input.message.body);
  const identity = safeEventIdentity(input.message.body);
  try {
    await input.deadLetter.record(
      { consumer: input.consumer, identity, reasonCode },
      input.signal,
    );
  } catch {
    input.telemetry.error(
      {
        eventName: `${input.consumer}.admission`,
        operation: 'consume',
        consumer: input.consumer,
        outcome: 'retry',
        retryable: true,
        errorCode: 'DEAD_LETTER_UNAVAILABLE',
        attempt: input.message.attempts,
        ...(identity.eventId === null ? {} : { traceId: identity.eventId }),
      },
      { samplingClass: 'always', highRisk: true },
    );
    return { ok: false, outcome: { outcome: 'retry' } };
  }
  input.telemetry.error(
    {
      eventName: `${input.consumer}.admission`,
      operation: 'consume',
      consumer: input.consumer,
      outcome: 'failure',
      retryable: false,
      errorCode: reasonCode,
      attempt: input.message.attempts,
      metrics: { 'consumer.dead_letter.total': 1 },
      ...(identity.eventId === null ? {} : { traceId: identity.eventId }),
    },
    { samplingClass: 'always', highRisk: true },
  );
  return { ok: false, outcome: { outcome: 'ack' } };
};

/**
 * Durably dead-letters an envelope that was valid but cannot be consumed
 * (its source row is gone, or its template is not approved). True when the
 * record was accepted and the message may be acknowledged.
 */
export const recordEnvelopeDeadLetter = async (
  input: Readonly<{
    consumer: string;
    envelope: Readonly<{
      eventId: string;
      eventType: string;
      schemaVersion: number;
      aggregateType: string;
      aggregateId: string;
      aggregateVersion: string;
    }>;
    reasonCode: DeadLetterReason;
    deadLetter: DeadLetterPort;
    signal: AbortSignal;
  }>,
): Promise<boolean> => {
  const { envelope } = input;
  try {
    await input.deadLetter.record(
      {
        consumer: input.consumer,
        identity: {
          eventId: envelope.eventId,
          eventType: envelope.eventType,
          schemaVersion: envelope.schemaVersion,
          aggregateType: envelope.aggregateType,
          aggregateId: envelope.aggregateId,
          aggregateVersion: envelope.aggregateVersion,
        },
        reasonCode: input.reasonCode,
      },
      input.signal,
    );
    return true;
  } catch {
    return false;
  }
};
