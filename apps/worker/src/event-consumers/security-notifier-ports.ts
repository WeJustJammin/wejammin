import { EVENT_CONSUMER_RPC } from './rpc-names';
import type {
  NotificationProviderResult,
  SecurityNotificationProviderPort,
  SecurityNotificationRecord,
  SecurityNotificationSource,
} from './security-notifier';
import type { EventConsumerRpc } from './types';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const REASON = /^[A-Z][A-Z0-9_]{0,63}$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseRecord = (value: unknown): SecurityNotificationRecord | null => {
  if (!isRecord(value) || typeof value.found !== 'boolean')
    throw new Error('Malformed security notification response');
  if (!value.found) {
    if (Object.keys(value).length !== 1)
      throw new Error('Malformed security notification response');
    return null;
  }
  if (
    Object.keys(value).sort().join(',') !== 'found,reasonCode,requestId' ||
    typeof value.reasonCode !== 'string' ||
    !REASON.test(value.reasonCode) ||
    typeof value.requestId !== 'string' ||
    !UUID.test(value.requestId)
  )
    throw new Error('Malformed security notification response');
  return { reasonCode: value.reasonCode, requestId: value.requestId };
};

/**
 * Rereads the immutable `identity.security_events` row behind a notification
 * request. The row holds a closed reason code and the originating request id;
 * it holds no address, name or body, and neither does the queue message.
 */
export const createRpcSecurityNotificationSource = (
  rpc: EventConsumerRpc,
): SecurityNotificationSource => ({
  read: async (securityEventId, signal) =>
    parseRecord(
      await rpc<unknown>(
        EVENT_CONSUMER_RPC.readSecurityNotification,
        { p_security_event_id: securityEventId },
        signal,
      ),
    ),
});

/**
 * The explicit "no provider" adapter: it delivers nothing and reports a typed
 * failure, so a notification stays on the queue retry schedule and ends in
 * the DLQ, to be replayed under the same notification id. It never claims
 * delivery. It is not the production default: the architecture disables
 * external delivery and the in-app notification store
 * (`createRpcInAppNotificationProvider`) is the bound boundary. It remains for
 * a deployment that must refuse delivery outright.
 */
export const createUnconfiguredNotificationProvider =
  (): SecurityNotificationProviderPort => ({
    send: async (): Promise<NotificationProviderResult> => ({
      ok: false,
      code: 'PROVIDER_NOT_CONFIGURED',
    }),
  });

const BREAKER_THRESHOLD = 5;
const BREAKER_WINDOW_MS = 60_000;

/**
 * BE01a seam circuit: five failures in 60 seconds open it for 60 seconds. An
 * open circuit refuses without calling the provider, so the message follows
 * the queue schedule and access is never restored by a failed notice.
 */
export const withNotificationBreaker = (
  provider: SecurityNotificationProviderPort,
  now: () => number = Date.now,
): SecurityNotificationProviderPort => {
  let failures: number[] = [];
  let openUntil = 0;
  const recordFailure = (): void => {
    const at = now();
    failures = [...failures, at].filter(
      (entry) => at - entry < BREAKER_WINDOW_MS,
    );
    if (failures.length >= BREAKER_THRESHOLD) {
      openUntil = at + BREAKER_WINDOW_MS;
      failures = [];
    }
  };
  return {
    send: async (request, signal) => {
      if (now() < openUntil) return { ok: false, code: 'CIRCUIT_OPEN' };
      let result: NotificationProviderResult;
      try {
        result = await provider.send(request, signal);
      } catch (error) {
        recordFailure();
        throw error;
      }
      if (!result.ok) recordFailure();
      return result;
    },
  };
};
