import { IdentitySecurityNotificationQueueEnvelopeSchema } from '@wejammin/contracts';

import { admitConsumerEvent, recordEnvelopeDeadLetter } from './admit';
import { runWithDeadline } from './deadline';
import { retryAfterAttempt } from './retry-schedule';
import {
  defaultConsumerClock,
  type ConsumerClock,
  type ConsumerTelemetry,
  type DeadLetterPort,
  type DeadLetterReason,
  type EventConsumerMessage,
  type EventConsumerOutcome,
} from './types';

export const SECURITY_NOTIFIER = 'identity.security-notifier' as const;
const EVENT_NAME = 'identity.security_notifier' as const;
const REQUESTED_EVENT_TYPE =
  'identity.security-notification.requested.v1' as const;

/** The approved generic notices; the code is the whole message content. */
export const SAFE_TEMPLATE_BY_REASON: Readonly<Record<string, string>> = {
  MFA_FACTOR_ADDED: 'mfa_factor_added',
  MFA_FACTOR_REMOVED: 'mfa_factor_removed',
  MFA_FACTORS_RESET: 'mfa_factors_reset',
};

/** What the notifier rereads of the immutable security event. */
export type SecurityNotificationRecord = Readonly<{
  /** The security event's closed reason code; it selects the template. */
  reasonCode: string;
  /** The originating operation's request id; becomes the operation id. */
  requestId: string;
}>;

export type SecurityNotificationSource = Readonly<{
  read: (
    securityEventId: string,
    signal: AbortSignal,
  ) => Promise<SecurityNotificationRecord | null>;
}>;

/** BE01a seam: the exact notification provider request. */
export type SecurityNotificationRequest = Readonly<{
  notificationId: string;
  eventType: typeof REQUESTED_EVENT_TYPE;
  recipientClass: 'account_holder';
  operationId: string;
  safeTemplateCode: string;
  requestId: string;
}>;

export type NotificationProviderResult =
  | Readonly<{
      ok: true;
      deliveryAttemptId: string;
      deliveryState: string;
      providerReference: string;
      acceptedAt: string;
    }>
  | Readonly<{ ok: false; code: string }>;

export type SecurityNotificationProviderPort = Readonly<{
  send: (
    request: SecurityNotificationRequest,
    signal: AbortSignal,
  ) => Promise<NotificationProviderResult>;
}>;

export type SecurityNotifierDependencies = Readonly<{
  source: SecurityNotificationSource;
  provider: SecurityNotificationProviderPort;
  deadLetter: DeadLetterPort;
  telemetry: ConsumerTelemetry;
  clock?: ConsumerClock;
}>;

const SAFE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/u;

export const createSecurityNotifier = (
  dependencies: SecurityNotifierDependencies,
) => {
  const clock = dependencies.clock ?? defaultConsumerClock;
  const { telemetry } = dependencies;

  const process = async (
    message: EventConsumerMessage,
  ): Promise<EventConsumerOutcome> => {
    const startedAt = clock.now();
    return runWithDeadline(async (signal) => {
      const admitted = await admitConsumerEvent({
        consumer: SECURITY_NOTIFIER,
        schema: IdentitySecurityNotificationQueueEnvelopeSchema,
        message,
        deadLetter: dependencies.deadLetter,
        telemetry,
        signal,
      });
      if (!admitted.ok) return admitted.outcome;
      const { envelope } = admitted;
      const attempt = Math.max(1, message.attempts);
      const exhausted = attempt > 3;
      const emit = (
        outcome: 'success' | 'retry' | 'failure',
        errorCode: string | null,
        metrics: Record<string, number> = {},
      ): void => {
        const details = {
          eventName: EVENT_NAME,
          operation: 'notify',
          consumer: SECURITY_NOTIFIER,
          outcome,
          attempt,
          correlationId: envelope.correlationId,
          traceId: envelope.eventId,
          entityType: 'security_event',
          dependency: 'security-notification-provider',
          durationMs: Math.max(0, clock.now() - startedAt),
          retryable: outcome === 'retry',
          ...(errorCode !== null && SAFE_CODE.test(errorCode)
            ? { errorCode }
            : {}),
          metrics: { 'identity.security_notification.total': 1, ...metrics },
        } as const;
        const options = {
          samplingClass: 'always',
          highRisk: outcome !== 'success',
        } as const;
        if (outcome === 'success') telemetry.info(details, options);
        else telemetry.warn(details, options);
      };
      const retry = (code: string): EventConsumerOutcome => {
        emit('retry', code, {
          'identity.security_notification.retries.total': 1,
          ...(exhausted
            ? { 'identity.security_notification.exhausted.total': 1 }
            : {}),
        });
        return retryAfterAttempt(attempt);
      };
      const deadLetter = async (
        reasonCode: DeadLetterReason,
      ): Promise<EventConsumerOutcome> => {
        const recorded = await recordEnvelopeDeadLetter({
          consumer: SECURITY_NOTIFIER,
          envelope,
          reasonCode,
          deadLetter: dependencies.deadLetter,
          signal,
        });
        if (!recorded) return retry('DEAD_LETTER_UNAVAILABLE');
        emit('failure', reasonCode, { 'consumer.dead_letter.total': 1 });
        return { outcome: 'ack' };
      };

      let record: SecurityNotificationRecord | null;
      try {
        record = await dependencies.source.read(envelope.aggregateId, signal);
      } catch {
        return retry('SECURITY_EVENT_READ_FAILED');
      }
      if (record === null) return deadLetter('SOURCE_RECORD_NOT_FOUND');
      const safeTemplateCode = SAFE_TEMPLATE_BY_REASON[record.reasonCode];
      if (safeTemplateCode === undefined)
        return deadLetter('UNSUPPORTED_NOTIFICATION_TEMPLATE');

      let result: NotificationProviderResult;
      try {
        result = await dependencies.provider.send(
          {
            notificationId: envelope.aggregateId,
            eventType: REQUESTED_EVENT_TYPE,
            recipientClass: 'account_holder',
            operationId: record.requestId,
            safeTemplateCode,
            requestId: clock.randomUuid(),
          },
          signal,
        );
      } catch {
        result = { ok: false, code: 'PROVIDER_FAILED' };
      }
      if (!result.ok) return retry(result.code);
      emit('success', null, {
        [`identity.security_notification.${safeTemplateCode}.total`]: 1,
      });
      return { outcome: 'ack' };
    });
  };

  return { process };
};

export type SecurityNotifier = ReturnType<typeof createSecurityNotifier>;
