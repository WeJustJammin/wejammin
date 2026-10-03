import { describe, expect, it, vi } from 'vitest';

import type {
  AsyncExecutionContext,
  AsyncWorkerBindings,
  PlatformJobsQueue,
} from './async-entrypoint';
import {
  createAsyncJobDependencies,
  type AsyncRpcClient,
  type AsyncRpcOperation,
} from './async-runtime';

const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const AGGREGATE_ID = '11111111-1111-4111-8111-111111111111';
const CORRELATION_ID = '33333333-3333-4333-8333-333333333333';
const LEASE_TOKEN = '44444444-4444-4444-8444-444444444444';

const OCCURRED_AT = '2026-10-02T14:00:00.000Z';
const PRODUCER: Readonly<Record<string, string>> = {
  'identity.mfa-factor.changed.v1': 'identity.authority',
  'identity.security-notification.requested.v1': 'identity.authority',
  'cms.capability.grant.changed.v1': 'cms.schema_registry',
};

const claim = (patch: Readonly<Record<string, unknown>>) => ({
  outboxId: EVENT_ID,
  leaseToken: LEASE_TOKEN,
  eventId: EVENT_ID,
  schemaVersion: 1,
  occurredAt: OCCURRED_AT,
  producer: PRODUCER[String(patch.eventType)] ?? 'platform.infrastructure',
  aggregateId: AGGREGATE_ID,
  aggregateVersion: '3',
  correlationId: CORRELATION_ID,
  causationId: null,
  ...patch,
});

const sweep = async (rows: readonly unknown[]) => {
  const send = vi.fn(async () => ({}));
  const queue = { send } as unknown as PlatformJobsQueue;
  const rpc = vi.fn(
    async (_env: AsyncWorkerBindings, operation: AsyncRpcOperation) =>
      operation === 'claim_outbox_batch' ? rows : true,
  ) as unknown as AsyncRpcClient;
  const result = await createAsyncJobDependencies({
    rpc,
    outboxLeaseToken: () => LEASE_TOKEN,
  }).sweepOutbox?.({
    controller: { cron: '* * * * *', scheduledTime: 100 },
    env: {
      APP_ENVIRONMENT: 'staging',
      APP_RELEASE: 'local',
      PLATFORM_JOBS: queue,
      SUPABASE_SECRET_KEY: 'secret',
      SUPABASE_URL: 'https://staging.example.supabase.co',
    },
    executionContext: { waitUntil: vi.fn() } as AsyncExecutionContext,
  });
  return { result, send, rpc };
};

describe('outbox relay of consumer events', () => {
  it.each([
    ['identity.mfa-factor.changed.v1', 'mfa_factor'],
    ['identity.security-notification.requested.v1', 'security_event'],
    ['cms.capability.grant.changed.v1', 'cms_capability_grant'],
  ])(
    '[P2-S09-AC-913] relays %s as an identifier-only consumer envelope, then completes the claim',
    async (eventType, aggregateType) => {
      const { result, send, rpc } = await sweep([
        claim({ eventType, aggregateType }),
      ]);
      expect(result).toBe('completed');
      expect(send).toHaveBeenCalledWith({
        eventId: EVENT_ID,
        eventType,
        schemaVersion: 1,
        occurredAt: OCCURRED_AT,
        producer: PRODUCER[eventType],
        aggregateType,
        aggregateId: AGGREGATE_ID,
        aggregateVersion: '3',
        correlationId: CORRELATION_ID,
        causationId: null,
      });
      expect(rpc).toHaveBeenCalledWith(
        expect.anything(),
        'complete_outbox_event',
        { p_event_id: EVENT_ID, p_lease_token: LEASE_TOKEN },
      );
    },
  );

  it.each([
    ['identity.mfa-factor.changed.v1', 'mfa_factor', { producer: undefined }],
    ['identity.mfa-factor.changed.v1', 'mfa_factor', { producer: null }],
    [
      'identity.mfa-factor.changed.v1',
      'mfa_factor',
      { producer: 'cms.schema_registry' },
    ],
    ['identity.mfa-factor.changed.v1', 'mfa_factor', { occurredAt: undefined }],
    [
      'identity.mfa-factor.changed.v1',
      'mfa_factor',
      { occurredAt: 'not-a-time' },
    ],
  ])(
    '[P2-S09-AC-190] refuses to relay %s with producer/occurredAt patch %j and requests a retry without sending',
    async (eventType, aggregateType, patch) => {
      const { result, send } = await sweep([
        claim({ eventType, aggregateType, ...patch }),
      ]);
      expect(result).toBe('retry');
      expect(send).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['identity.mfa-factor.changed.v2', 'mfa_factor'],
    ['identity.mfa-factor.changed.v1', 'security_event'],
    ['cms.capability.grant.changed.v1', 'job'],
    ['identity.session.revoked.v1', 'session_index'],
    [7, 'job'],
  ])(
    'refuses to relay %s with aggregate %s and requests a retry without sending',
    async (eventType, aggregateType) => {
      const { result, send } = await sweep([
        claim({ eventType, aggregateType }),
      ]);
      expect(result).toBe('retry');
      expect(send).not.toHaveBeenCalled();
    },
  );
});
