import { describe, expect, it } from 'vitest';

import { createRpcInAppNotificationProvider } from './in-app-notification-provider';
import type { SecurityNotificationRequest } from './security-notifier';
import { createSecurityNotifier } from './security-notifier';
import { fakeRpc, IDS, queueBody, recordingTelemetry } from './test-support';

const signal = new AbortController().signal;
const request: SecurityNotificationRequest = {
  notificationId: IDS.aggregate,
  eventType: 'identity.security-notification.requested.v1',
  recipientClass: 'account_holder',
  operationId: IDS.request,
  safeTemplateCode: 'mfa_factor_added',
  requestId: IDS.correlation,
};
const recorded = {
  deliveryAttemptId: IDS.event,
  deliveryState: 'recorded',
  providerReference: `in-app:${IDS.aggregate}`,
  acceptedAt: '2026-10-02T14:00:00.000Z',
};

describe('in-app notification provider', () => {
  it('[P2-S09-AC-916] records the intent with exactly the provider request fields and no recipient', async () => {
    const { calls, rpc } = fakeRpc({
      in_app_notification_record: () => recorded,
    });
    await expect(
      createRpcInAppNotificationProvider(rpc).send(request, signal),
    ).resolves.toEqual({ ok: true, ...recorded });
    expect(calls).toEqual([
      {
        operation: 'in_app_notification_record',
        input: { p_request: request },
      },
    ]);
    expect(Object.keys(calls[0]?.input.p_request as object).sort()).toEqual([
      'eventType',
      'notificationId',
      'operationId',
      'recipientClass',
      'requestId',
      'safeTemplateCode',
    ]);
  });

  it('[P2-S09-AC-916] a replay under the same notification id returns the same delivery attempt', async () => {
    const { rpc } = fakeRpc({ in_app_notification_record: () => recorded });
    const provider = createRpcInAppNotificationProvider(rpc);
    const first = await provider.send(request, signal);
    const second = await provider.send(
      { ...request, requestId: IDS.person },
      signal,
    );
    expect(second).toEqual(first);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a missing key', { ...recorded, acceptedAt: undefined }],
    ['an extra key', { ...recorded, recipient: 'x' }],
    ['a non-uuid attempt id', { ...recorded, deliveryAttemptId: 'x' }],
    ['an unknown state', { ...recorded, deliveryState: 'sent' }],
    [
      'a reference outside in-app',
      { ...recorded, providerReference: 'smtp:1' },
    ],
    [
      'a reference for another notification',
      { ...recorded, providerReference: `in-app:${IDS.event}` },
    ],
    ['a non-ISO time', { ...recorded, acceptedAt: 'yesterday' }],
  ])('rejects a malformed response: %s', async (_name, response) => {
    const { rpc } = fakeRpc({ in_app_notification_record: () => response });
    await expect(
      createRpcInAppNotificationProvider(rpc).send(request, signal),
    ).rejects.toThrow('Malformed in-app notification response');
  });

  it('rejects an RPC the store does not serve, so the notifier retries', async () => {
    const { rpc } = fakeRpc({});
    await expect(
      createRpcInAppNotificationProvider(rpc).send(request, signal),
    ).rejects.toThrow('unexpected rpc in_app_notification_record');
  });

  it('propagates a transport failure so the notifier retries', async () => {
    const { rpc } = fakeRpc({
      in_app_notification_record: () => {
        throw new Error('rpc down');
      },
    });
    await expect(
      createRpcInAppNotificationProvider(rpc).send(request, signal),
    ).rejects.toThrow('rpc down');
  });
});

describe('security notifier over the in-app provider', () => {
  const build = (record: () => unknown) => {
    const { calls, rpc } = fakeRpc({
      identity_security_notification_read: () => ({
        found: true,
        reasonCode: 'MFA_FACTOR_ADDED',
        requestId: IDS.request,
      }),
      in_app_notification_record: record,
    });
    const { telemetry } = recordingTelemetry();
    const notifier = createSecurityNotifier({
      source: {
        read: async (id) =>
          (
            await rpc<{ found: boolean }>(
              'identity_security_notification_read',
              {
                p_security_event_id: id,
              },
            )
          )?.found
            ? { reasonCode: 'MFA_FACTOR_ADDED', requestId: IDS.request }
            : null,
      },
      provider: createRpcInAppNotificationProvider(rpc),
      deadLetter: { record: async () => undefined },
      telemetry,
    });
    return { calls, notifier };
  };
  const message = (attempts: number) => ({
    body: queueBody(
      'identity.security-notification.requested.v1',
      'security_event',
    ),
    attempts,
  });

  it('[P2-S09-AC-916] acknowledges a delivered in-app notification', async () => {
    const { calls, notifier } = build(() => recorded);
    await expect(notifier.process(message(1))).resolves.toEqual({
      outcome: 'ack',
    });
    expect(
      calls.filter((c) => c.operation === 'in_app_notification_record'),
    ).toHaveLength(1);
  });

  it.each([
    [1, 15],
    [2, 60],
    [3, 300],
  ])(
    '[P2-S09-AC-916] keeps the 15/60/300 second retry schedule when the store is unavailable (attempt %i)',
    async (attempt, delaySeconds) => {
      const { notifier } = build(() => {
        throw new Error('store down');
      });
      await expect(notifier.process(message(attempt))).resolves.toEqual({
        outcome: 'retry',
        delaySeconds,
      });
    },
  );
});
