import { vi } from 'vitest';

import type {
  ConsumerTelemetry,
  DeadLetterPort,
  EventConsumerRpc,
} from './types';

export const IDS = {
  event: '11111111-1111-4111-8111-111111111111',
  aggregate: '22222222-2222-4222-8222-222222222222',
  correlation: '33333333-3333-4333-8333-333333333333',
  authUser: '44444444-4444-4444-8444-444444444444',
  providerFactor: '55555555-5555-4555-8555-555555555555',
  person: '66666666-6666-4666-8666-666666666666',
  request: '77777777-7777-4777-8777-777777777777',
} as const;

export const NOW = Date.parse('2026-10-02T14:00:00Z');

const REGISTERED_PRODUCER: Readonly<Record<string, string>> = {
  'cms.capability.grant.changed.v1': 'cms.schema_registry',
  'identity.mfa-factor.changed.v1': 'identity.authority',
  'identity.security-notification.requested.v1': 'identity.authority',
};

export const queueBody = (
  eventType: string,
  aggregateType: string,
  patch: Readonly<Record<string, unknown>> = {},
) => ({
  eventId: IDS.event,
  eventType,
  schemaVersion: 1,
  occurredAt: '2026-10-02T14:00:00.000Z',
  producer: REGISTERED_PRODUCER[eventType] ?? 'identity.authority',
  aggregateType,
  aggregateId: IDS.aggregate,
  aggregateVersion: '4',
  correlationId: IDS.correlation,
  causationId: null,
  ...patch,
});

export type RecordedLog = Readonly<{
  level: 'error' | 'info' | 'warn';
  details: Record<string, unknown>;
  options: Record<string, unknown> | undefined;
}>;

export const recordingTelemetry = () => {
  const logs: RecordedLog[] = [];
  const write =
    (level: RecordedLog['level']) => (details: object, options?: object) => {
      logs.push({
        level,
        details: details as Record<string, unknown>,
        options: options as Record<string, unknown> | undefined,
      });
      return 'written' as const;
    };
  const telemetry: ConsumerTelemetry = {
    error: write('error'),
    info: write('info'),
    warn: write('warn'),
  };
  return { logs, telemetry };
};

export const recordingDeadLetter = (fail = false) => {
  const records: Array<Parameters<DeadLetterPort['record']>[0]> = [];
  const port: DeadLetterPort = {
    record: vi.fn(async (input) => {
      if (fail) throw new Error('dead letter unavailable');
      records.push(input);
    }),
  };
  return { port, records };
};

export const fakeRpc = (
  handlers: Readonly<
    Record<string, (input: Record<string, unknown>) => unknown>
  >,
) => {
  const calls: Array<
    Readonly<{ operation: string; input: Record<string, unknown> }>
  > = [];
  const rpc = (async (operation: string, input: Record<string, unknown>) => {
    calls.push({ operation, input });
    const handler = handlers[operation];
    if (handler === undefined) throw new Error(`unexpected rpc ${operation}`);
    return handler(input);
  }) as unknown as EventConsumerRpc;
  return { calls, rpc };
};

export const serialized = (value: unknown): string => JSON.stringify(value);
