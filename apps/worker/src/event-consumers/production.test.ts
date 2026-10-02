import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ServerEnvironment } from '@wejammin/config/environment';

import { createProductionEventConsumers } from './production';
import { IDS, NOW, queueBody } from './test-support';

const environment = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'local',
  SUPABASE_SECRET_KEY: 'sb_secret_0123456789abcdef',
  SUPABASE_URL: 'https://staging.example.supabase.co',
} as unknown as ServerEnvironment;

const json = (value: unknown): Response =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('production event consumer composition', () => {
  it('[P2-S09-AC-916] composes with the in-app notification store as the default provider and a default logger', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const operations: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      const operation = url.split('/rpc/')[1] ?? '';
      operations.push(operation);
      if (operation === 'in_app_notification_record')
        return json({
          deliveryAttemptId: IDS.event,
          deliveryState: 'recorded',
          providerReference: `in-app:${IDS.aggregate}`,
          acceptedAt: '2026-10-02T14:00:00.000Z',
        });
      return json({
        found: true,
        reasonCode: 'MFA_FACTOR_REMOVED',
        requestId: IDS.request,
      });
    });
    const { registry } = createProductionEventConsumers(
      environment,
      fetchImpl as unknown as typeof fetch,
    );
    await expect(
      registry.process({
        body: queueBody(
          'identity.security-notification.requested.v1',
          'security_event',
        ),
        attempts: 2,
      }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(operations).toEqual([
      'identity_security_notification_read',
      'in_app_notification_record',
    ]);
  });

  it('[P2-S09-AC-916] retries on the unchanged schedule when the in-app store is unavailable', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.split('/rpc/')[1] === 'in_app_notification_record')
        return new Response('{}', { status: 500 });
      return json({
        found: true,
        reasonCode: 'MFA_FACTOR_REMOVED',
        requestId: IDS.request,
      });
    });
    const { registry } = createProductionEventConsumers(
      environment,
      fetchImpl as unknown as typeof fetch,
    );
    await expect(
      registry.process({
        body: queueBody(
          'identity.security-notification.requested.v1',
          'security_event',
        ),
        attempts: 2,
      }),
    ).resolves.toEqual({ outcome: 'retry', delaySeconds: 60 });
  });

  it('[P2-S09-AC-916] delivers through a bound provider and applies grants through a registered authorization refresh', async () => {
    const send = vi.fn(async () => ({
      ok: true as const,
      deliveryAttemptId: 'a',
      deliveryState: 'accepted',
      providerReference: 'r',
      acceptedAt: '2026-10-02T14:00:00.000Z',
    }));
    const refresh = vi.fn(async () => undefined);
    const fetchImpl = vi.fn(async (url: string) => {
      const operation = url.split('/rpc/')[1];
      if (operation === 'identity_security_notification_read')
        return json({
          found: true,
          reasonCode: 'MFA_FACTOR_ADDED',
          requestId: IDS.request,
        });
      return json({
        found: true,
        grantId: IDS.aggregate,
        subjectPersonId: IDS.person,
        version: '4',
        state: 'active',
        capabilityCode: 'cms.editor',
      });
    });
    const silent = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    const { registry } = createProductionEventConsumers(
      environment,
      fetchImpl as unknown as typeof fetch,
      {
        logger: { ...silent, debug: vi.fn(), fatal: vi.fn() },
        notificationProvider: { send },
        authorizationRefresh: { refresh },
        now: () => NOW,
      },
    );
    await expect(
      registry.process({
        body: queueBody(
          'identity.security-notification.requested.v1',
          'security_event',
        ),
        attempts: 1,
      }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(send).toHaveBeenCalledOnce();
    await expect(
      registry.process({
        body: queueBody(
          'cms.capability.grant.changed.v1',
          'cms_capability_grant',
        ),
        attempts: 1,
      }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('with no authorization cache registered, the grant is still refetched and acknowledged', async () => {
    const fetchImpl = vi.fn(async () =>
      json({
        found: true,
        grantId: IDS.aggregate,
        subjectPersonId: IDS.person,
        version: '4',
        state: 'revoked',
        capabilityCode: 'cms.editor',
      }),
    );
    const silent = {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      fatal: vi.fn(),
    };
    const { registry } = createProductionEventConsumers(
      environment,
      fetchImpl as unknown as typeof fetch,
      { logger: silent },
    );
    await expect(
      registry.process({
        body: queueBody(
          'cms.capability.grant.changed.v1',
          'cms_capability_grant',
        ),
        attempts: 1,
      }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
