import { createLogger } from '@wejammin/observability/logging';
import { describe, expect, it, vi } from 'vitest';

import type {
  AsyncExecutionContext,
  AsyncWorkerBindings,
  PlatformJobsMessage,
} from './async-entrypoint';
import { createProductionAsyncEntrypoint } from './production-async-entrypoint';

const AGGREGATE = '22222222-2222-4222-8222-222222222222';
const AUTH_USER = '44444444-4444-4444-8444-444444444444';
const PROVIDER_FACTOR = '55555555-5555-4555-8555-555555555555';
const PERSON = '66666666-6666-4666-8666-666666666666';
const REQUEST = '77777777-7777-4777-8777-777777777777';

const bindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'local',
  PLATFORM_JOBS: { send: vi.fn() },
  SUPABASE_SECRET_KEY: 'sb_secret_0123456789abcdef',
  SUPABASE_URL: 'https://staging.example.supabase.co',
} as unknown as AsyncWorkerBindings;
const executionContext = { waitUntil: vi.fn() } satisfies AsyncExecutionContext;

const body = (
  eventType: string,
  aggregateType: string,
  patch: Readonly<Record<string, unknown>> = {},
) => ({
  eventId: '11111111-1111-4111-8111-111111111111',
  eventType,
  schemaVersion: 1,
  aggregateType,
  aggregateId: AGGREGATE,
  aggregateVersion: '4',
  correlationId: '33333333-3333-4333-8333-333333333333',
  causationId: null,
  ...patch,
});

const message = (payload: unknown, attempts = 1): PlatformJobsMessage => ({
  ack: vi.fn(),
  attempts,
  body: payload,
  id: 'm',
  retry: vi.fn(),
});

const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

type Call = Readonly<{ url: string; method: string; body: unknown }>;

const harness = (route: (operation: string, url: string) => unknown) => {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({
      url,
      method: String(init.method),
      body: init.body === undefined ? null : JSON.parse(String(init.body)),
    });
    return json(route(url.split('/rest/v1/rpc/')[1] ?? '', url));
  });
  return {
    calls,
    entrypoint: createProductionAsyncEntrypoint(
      fetchImpl as unknown as typeof fetch,
      undefined,
      undefined,
      {
        logger: createLogger(
          {
            environment: 'staging',
            release: 'local',
            service: 'event-consumers-test',
          },
          { sink: () => undefined },
        ),
      },
    ),
  };
};

const run = (
  entrypoint: ReturnType<typeof createProductionAsyncEntrypoint>,
  queued: PlatformJobsMessage,
) =>
  entrypoint.queue(
    { messages: [queued], queue: 'platform-jobs-staging' },
    bindings,
    executionContext,
  );

const rpcName = (call: Call): string => call.url.split('/rpc/')[1] ?? '';

describe('production async entrypoint event consumers', () => {
  it('[P2-S09-AC-913] settles a reconciling factor from the provider status end to end', async () => {
    const { entrypoint, calls } = harness((operation, url) => {
      if (operation === 'auth_mfa_factor_reconcile_read')
        return {
          found: true,
          state: 'reconciling',
          authUserId: AUTH_USER,
          providerFactorId: PROVIDER_FACTOR,
          version: '5',
        };
      if (url.includes('/auth/v1/admin/users/'))
        return [{ id: PROVIDER_FACTOR, status: 'verified' }];
      if (operation === 'auth_mfa_factor_reconcile')
        return { state: 'verified' };
      throw new Error(`unexpected ${url}`);
    });
    const queued = message(
      body('identity.mfa-factor.changed.v1', 'mfa_factor'),
    );
    await run(entrypoint, queued);
    expect(queued.ack).toHaveBeenCalledOnce();
    expect(
      calls.map(({ method, url }) => `${method} ${url.split('.co')[1]}`),
    ).toEqual([
      'POST /rest/v1/rpc/auth_mfa_factor_reconcile_read',
      `GET /auth/v1/admin/users/${AUTH_USER}/factors`,
      'POST /rest/v1/rpc/auth_mfa_factor_reconcile',
    ]);
    expect(calls[2]?.body).toMatchObject({
      p_auth_user_id: AUTH_USER,
      p_factor_id: AGGREGATE,
      p_outcome: 'verified',
    });
  });

  it('[P2-S09-AC-916] records the notice in the in-app store and acknowledges it', async () => {
    const { entrypoint, calls } = harness((operation) => {
      if (operation === 'identity_security_notification_read')
        return {
          found: true,
          reasonCode: 'MFA_FACTOR_ADDED',
          requestId: REQUEST,
        };
      if (operation === 'in_app_notification_record')
        return {
          deliveryAttemptId: REQUEST,
          deliveryState: 'recorded',
          providerReference: `in-app:${AGGREGATE}`,
          acceptedAt: '2026-10-02T14:00:00.000Z',
        };
      throw new Error(`unexpected ${operation}`);
    });
    const queued = message(
      body('identity.security-notification.requested.v1', 'security_event', {
        aggregateVersion: '1',
      }),
    );
    await run(entrypoint, queued);
    expect(queued.ack).toHaveBeenCalledOnce();
    expect(queued.retry).not.toHaveBeenCalled();
    expect(calls.map(rpcName)).toEqual([
      'identity_security_notification_read',
      'in_app_notification_record',
    ]);
    expect(calls[1]?.body).toEqual({
      p_request: {
        notificationId: AGGREGATE,
        eventType: 'identity.security-notification.requested.v1',
        recipientClass: 'account_holder',
        operationId: REQUEST,
        safeTemplateCode: 'mfa_factor_added',
        requestId: expect.any(String),
      },
    });
  });

  it('[P2-S09-AC-916] retries a notice at 15 seconds when the in-app store is unavailable', async () => {
    const { entrypoint, calls } = harness((operation) => {
      if (operation === 'identity_security_notification_read')
        return {
          found: true,
          reasonCode: 'MFA_FACTOR_ADDED',
          requestId: REQUEST,
        };
      throw new Error(`unexpected ${operation}`);
    });
    const queued = message(
      body('identity.security-notification.requested.v1', 'security_event', {
        aggregateVersion: '1',
      }),
    );
    await run(entrypoint, queued);
    expect(queued.retry).toHaveBeenCalledWith({ delaySeconds: 15 });
    expect(queued.ack).not.toHaveBeenCalled();
    expect(calls).toHaveLength(2);
  });

  it('[P2-S09-AC-689] refetches the grant and acknowledges; an unknown version is dead-lettered first', async () => {
    const { entrypoint, calls } = harness((operation) => {
      if (operation === 'cms_capability_grant_read_current')
        return {
          found: true,
          grantId: AGGREGATE,
          subjectPersonId: PERSON,
          version: '4',
          state: 'active',
          capabilityCode: 'cms.editor',
        };
      if (operation === 'consumer_dead_letter_event') return { accepted: true };
      throw new Error(`unexpected ${operation}`);
    });
    const current = message(
      body('cms.capability.grant.changed.v1', 'cms_capability_grant'),
    );
    await run(entrypoint, current);
    expect(current.ack).toHaveBeenCalledOnce();

    const unknown = message(
      body('cms.capability.grant.changed.v2', 'cms_capability_grant', {
        schemaVersion: 2,
      }),
    );
    await run(entrypoint, unknown);
    expect(unknown.ack).toHaveBeenCalledOnce();
    expect(calls.map(rpcName)).toEqual([
      'cms_capability_grant_read_current',
      'consumer_dead_letter_event',
    ]);
    expect(calls[1]?.body).toMatchObject({
      p_request: {
        consumer: 'cms.capability-grant-consumer',
        reasonCode: 'UNKNOWN_EVENT_VERSION',
        eventType: 'cms.capability.grant.changed.v2',
      },
    });
  });

  it('[P2-S09-AC-908] samples the reconciling-age gauge on the scheduled tick', async () => {
    const { entrypoint, calls } = harness((operation) => {
      if (operation === 'auth_mfa_reconciling_age')
        return { count: 1, oldestAgeSeconds: 90 };
      if (operation === 'claim_outbox_batch') return [];
      throw new Error(`unexpected ${operation}`);
    });
    await entrypoint.scheduled(
      { cron: '* * * * *', scheduledTime: 1_756_560_000_000 },
      bindings,
      executionContext,
    );
    expect(calls.map(rpcName).sort()).toEqual([
      'auth_mfa_reconciling_age',
      'claim_outbox_batch',
    ]);
  });
});
