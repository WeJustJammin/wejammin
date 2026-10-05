import { describe, expect, it, vi } from 'vitest';

import {
  createRpcSecurityNotificationSource,
  createUnconfiguredNotificationProvider,
  withNotificationBreaker,
} from './security-notifier-ports';
import type {
  NotificationProviderResult,
  SecurityNotificationRequest,
} from './security-notifier';
import { fakeRpc, IDS } from './test-support';

const signal = new AbortController().signal;
const request: SecurityNotificationRequest = {
  notificationId: IDS.aggregate,
  eventType: 'identity.security-notification.requested.v1',
  recipientClass: 'account_holder',
  operationId: IDS.request,
  safeTemplateCode: 'mfa_factor_added',
  requestId: IDS.correlation,
};

describe('security notification source', () => {
  it('[P2-S09-AC-916] rereads the immutable security event by id', async () => {
    const { calls, rpc } = fakeRpc({
      identity_security_notification_read: () => ({
        found: true,
        reasonCode: 'MFA_FACTOR_ADDED',
        requestId: IDS.request,
      }),
    });
    await expect(
      createRpcSecurityNotificationSource(rpc).read(IDS.aggregate, signal),
    ).resolves.toEqual({
      reasonCode: 'MFA_FACTOR_ADDED',
      requestId: IDS.request,
    });
    expect(calls).toEqual([
      {
        operation: 'identity_security_notification_read',
        input: { p_security_event_id: IDS.aggregate },
      },
    ]);
  });

  it('maps found:false to null and rejects malformed responses', async () => {
    const missing = fakeRpc({
      identity_security_notification_read: () => ({ found: false }),
    });
    await expect(
      createRpcSecurityNotificationSource(missing.rpc).read(
        IDS.aggregate,
        signal,
      ),
    ).resolves.toBeNull();
    for (const bad of [
      null,
      { found: true, reasonCode: 'lowercase', requestId: IDS.request },
      { found: true, reasonCode: 'MFA_FACTOR_ADDED', requestId: 'x' },
      {
        found: true,
        reasonCode: 'MFA_FACTOR_ADDED',
        requestId: IDS.request,
        email: 'a@b.c',
      },
      { found: false, reasonCode: 'MFA_FACTOR_ADDED' },
    ]) {
      const { rpc } = fakeRpc({
        identity_security_notification_read: () => bad,
      });
      await expect(
        createRpcSecurityNotificationSource(rpc).read(IDS.aggregate, signal),
      ).rejects.toThrow('Malformed security notification response');
    }
  });
});

describe('notification provider seam', () => {
  it('[P2-S09-AC-916] an unconfigured provider reports a typed failure and delivers nothing', async () => {
    await expect(
      createUnconfiguredNotificationProvider().send(request, signal),
    ).resolves.toEqual({ ok: false, code: 'PROVIDER_NOT_CONFIGURED' });
  });

  it('[P2-S09-AC-916] opens after five failures in 60 seconds for 60 seconds, then probes again', async () => {
    let now = 1_000_000;
    const failing: NotificationProviderResult = {
      ok: false,
      code: 'PROVIDER_FAILED',
    };
    const send = vi.fn(async () => failing);
    const guarded = withNotificationBreaker({ send }, () => now);
    for (let index = 0; index < 5; index += 1) {
      await expect(guarded.send(request, signal)).resolves.toEqual(failing);
    }
    await expect(guarded.send(request, signal)).resolves.toEqual({
      ok: false,
      code: 'CIRCUIT_OPEN',
    });
    expect(send).toHaveBeenCalledTimes(5);
    now += 60_000;
    await guarded.send(request, signal);
    expect(send).toHaveBeenCalledTimes(6);
  });

  it('does not open for failures spread wider than the 60 second window, and a thrown send counts as a failure', async () => {
    let now = 5_000_000;
    const send = vi.fn(async (): Promise<NotificationProviderResult> => {
      throw new Error('socket');
    });
    const guarded = withNotificationBreaker({ send }, () => now);
    for (let index = 0; index < 8; index += 1) {
      await expect(guarded.send(request, signal)).rejects.toThrow('socket');
      now += 20_000;
    }
    expect(send).toHaveBeenCalledTimes(8);
  });

  it('passes a successful delivery through untouched', async () => {
    const ok: NotificationProviderResult = {
      ok: true,
      deliveryAttemptId: 'a',
      deliveryState: 'accepted',
      providerReference: 'r',
      acceptedAt: '2026-10-02T14:00:00.000Z',
    };
    const guarded = withNotificationBreaker({ send: async () => ok }, () => 1);
    await expect(guarded.send(request, signal)).resolves.toBe(ok);
  });
});
