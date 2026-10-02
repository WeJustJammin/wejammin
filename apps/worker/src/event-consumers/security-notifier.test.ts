import { describe, expect, it, vi } from 'vitest';

import {
  createSecurityNotifier,
  type NotificationProviderResult,
  type SecurityNotificationProviderPort,
  type SecurityNotificationRecord,
} from './security-notifier';
import {
  IDS,
  NOW,
  queueBody,
  recordingDeadLetter,
  recordingTelemetry,
  serialized,
} from './test-support';

const body = () =>
  queueBody('identity.security-notification.requested.v1', 'security_event', {
    aggregateVersion: '1',
  });

const record = (reasonCode: string): SecurityNotificationRecord => ({
  reasonCode,
  requestId: IDS.request,
});

const accepted: NotificationProviderResult = {
  ok: true,
  deliveryAttemptId: 'attempt-1',
  deliveryState: 'accepted',
  providerReference: 'ref-1',
  acceptedAt: '2026-10-02T14:00:01.000Z',
};

const build = (
  options: Readonly<{
    source?: SecurityNotificationRecord | null;
    send?: SecurityNotificationProviderPort['send'];
    readFails?: boolean;
    deadLetterFails?: boolean;
  }> = {},
) => {
  const send = vi.fn<SecurityNotificationProviderPort['send']>(
    options.send ?? (async () => accepted),
  );
  const read = vi.fn(async () => {
    if (options.readFails) throw new Error('rpc down');
    return options.source === undefined
      ? record('MFA_FACTOR_ADDED')
      : options.source;
  });
  const deadLetter = recordingDeadLetter(options.deadLetterFails);
  const { logs, telemetry } = recordingTelemetry();
  const notifier = createSecurityNotifier({
    source: { read },
    provider: { send },
    deadLetter: deadLetter.port,
    telemetry,
    clock: { now: () => NOW, randomUuid: () => IDS.correlation },
  });
  return { notifier, send, read, deadLetter, logs };
};

const consume = (
  notifier: ReturnType<typeof build>['notifier'],
  attempts = 1,
  message: unknown = body(),
) => notifier.process({ body: message, attempts });

describe('identity.security-notifier', () => {
  it.each([
    ['MFA_FACTOR_ADDED', 'mfa_factor_added'],
    ['MFA_FACTOR_REMOVED', 'mfa_factor_removed'],
    ['MFA_FACTORS_RESET', 'mfa_factors_reset'],
  ] as const)(
    '[P2-S09-AC-916] sends the %s notice as %s with identifiers only under the security event id',
    async (reasonCode, template) => {
      const { notifier, send, read } = build({ source: record(reasonCode) });
      await expect(consume(notifier)).resolves.toEqual({ outcome: 'ack' });
      expect(read).toHaveBeenCalledWith(IDS.aggregate, expect.any(AbortSignal));
      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith(
        {
          notificationId: IDS.aggregate,
          eventType: 'identity.security-notification.requested.v1',
          recipientClass: 'account_holder',
          operationId: IDS.request,
          safeTemplateCode: template,
          requestId: IDS.correlation,
        },
        expect.any(AbortSignal),
      );
    },
  );

  it('[P2-S09-AC-916] keeps one notification id across every queue attempt', async () => {
    const { notifier, send } = build({
      send: async () => ({ ok: false, code: 'PROVIDER_FAILED' }),
    });
    for (const attempt of [1, 2, 3, 4]) await consume(notifier, attempt);
    const ids = send.mock.calls.map(([request]) => request.notificationId);
    expect(ids).toEqual(Array(4).fill(IDS.aggregate));
  });

  it('[P2-S09-AC-916] retries a failed delivery at 15, 60 and 300 seconds and then leaves it to the DLQ', async () => {
    const { notifier } = build({
      send: async () => ({ ok: false, code: 'PROVIDER_FAILED' }),
    });
    await expect(consume(notifier, 1)).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 15,
    });
    await expect(consume(notifier, 2)).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 60,
    });
    await expect(consume(notifier, 3)).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 300,
    });
    await expect(consume(notifier, 4)).resolves.toEqual({ outcome: 'retry' });
  });

  it('[P2-S09-AC-916] never restores access on failure: across every failed attempt the notifier touches only the event read, the provider send and the telemetry sink', async () => {
    const touched = new Set<string>();
    const watch = <T extends object>(name: string, port: T): T =>
      new Proxy(port, {
        get: (target, key, receiver) => {
          touched.add(`${name}.${String(key)}`);
          return Reflect.get(target, key, receiver) as unknown;
        },
      });
    const { telemetry } = recordingTelemetry();
    const deadLetter = recordingDeadLetter();
    const notifier = createSecurityNotifier({
      source: watch('source', {
        read: async () => record('MFA_FACTOR_REMOVED'),
      }),
      provider: watch('provider', {
        send: async () => ({ ok: false as const, code: 'PROVIDER_FAILED' }),
      }),
      deadLetter: watch('deadLetter', deadLetter.port),
      telemetry: watch('telemetry', telemetry),
      clock: { now: () => NOW, randomUuid: () => IDS.correlation },
    });
    for (const attempt of [1, 2, 3, 4]) await consume(notifier, attempt);
    expect(
      [...touched].filter((entry) => !entry.startsWith('telemetry.')),
    ).toStrictEqual(['source.read', 'provider.send']);
    expect(deadLetter.records).toStrictEqual([]);
  });

  it('[P2-S09-AC-916] treats a throwing provider as a failed delivery', async () => {
    const { notifier } = build({
      send: async () => {
        throw new Error('socket');
      },
    });
    await expect(consume(notifier, 2)).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 60,
    });
  });

  it('[P2-S09-AC-916] reports exhaustion on the last attempt as a high-risk failure', async () => {
    const { notifier, logs } = build({
      send: async () => ({ ok: false, code: 'PROVIDER_NOT_CONFIGURED' }),
    });
    await consume(notifier, 4);
    expect(logs.at(-1)).toMatchObject({
      level: 'warn',
      details: {
        outcome: 'retry',
        errorCode: 'PROVIDER_NOT_CONFIGURED',
        attempt: 4,
        metrics: { 'identity.security_notification.exhausted.total': 1 },
      },
      options: { highRisk: true },
    });
  });

  it('[P2-S09-AC-916] retries when the security event cannot be read, without sending', async () => {
    const { notifier, send } = build({ readFails: true });
    await expect(consume(notifier, 1)).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 15,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-916] dead-letters a missing security event and an unapproved template, never sending', async () => {
    const missing = build({ source: null });
    await expect(consume(missing.notifier)).resolves.toEqual({
      outcome: 'ack',
    });
    expect(missing.deadLetter.records[0]?.reasonCode).toBe(
      'SOURCE_RECORD_NOT_FOUND',
    );
    const unapproved = build({ source: record('SESSION_REVOKED') });
    await expect(consume(unapproved.notifier)).resolves.toEqual({
      outcome: 'ack',
    });
    expect(unapproved.deadLetter.records[0]?.reasonCode).toBe(
      'UNSUPPORTED_NOTIFICATION_TEMPLATE',
    );
    expect(missing.send).not.toHaveBeenCalled();
    expect(unapproved.send).not.toHaveBeenCalled();
  });

  it('retries when the dead letter for an unapproved template cannot be recorded', async () => {
    const { notifier } = build({
      source: record('SESSION_REVOKED'),
      deadLetterFails: true,
    });
    await expect(consume(notifier, 1)).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 15,
    });
  });

  it('[P2-S09-AC-689] dead-letters an unknown event version before reading anything', async () => {
    const { notifier, read, send, deadLetter } = build();
    const result = await consume(
      notifier,
      1,
      queueBody(
        'identity.security-notification.requested.v2',
        'security_event',
        { schemaVersion: 2 },
      ),
    );
    expect(result).toEqual({ outcome: 'ack' });
    expect(deadLetter.records[0]?.reasonCode).toBe('UNKNOWN_EVENT_VERSION');
    expect(read).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-916] logs no address, provider reference or delivery id', async () => {
    const { notifier, logs } = build();
    await consume(notifier);
    const text = serialized(logs);
    expect(text).not.toContain('ref-1');
    expect(text).not.toContain('attempt-1');
    expect(text).not.toContain('@');
    expect(logs[0]?.details).toMatchObject({
      eventName: 'identity.security_notifier',
      consumer: 'identity.security-notifier',
      outcome: 'success',
    });
  });
});
