import { EVENT_CONSUMER_RPC } from './rpc-names';
import type {
  NotificationProviderResult,
  SecurityNotificationProviderPort,
} from './security-notifier';
import type { EventConsumerRpc } from './types';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const RESPONSE_KEYS = [
  'acceptedAt',
  'deliveryAttemptId',
  'deliveryState',
  'providerReference',
].join(',');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Architecture design "Transactional email": external delivery is disabled
 * and the notification boundary is in-app only. This provider is that
 * boundary: it records the typed notification intent (identifiers and the
 * approved template code, never a body or an address) in the private in-app
 * store through the protected `in_app_notification_record` RPC. The database
 * resolves the account-holder recipient server-side from the immutable request
 * and is idempotent by notification id, so a queue replay with a fresh
 * delivery request id returns the original delivery attempt and writes
 * nothing. A store failure throws, which the notifier turns into the
 * unchanged 15/60/300 second retry schedule.
 */
export const createRpcInAppNotificationProvider = (
  rpc: EventConsumerRpc,
): SecurityNotificationProviderPort => ({
  send: async (request, signal): Promise<NotificationProviderResult> => {
    const response = await rpc<unknown>(
      EVENT_CONSUMER_RPC.recordInAppNotification,
      { p_request: request },
      signal,
    );
    if (
      !isRecord(response) ||
      Object.keys(response).sort().join(',') !== RESPONSE_KEYS ||
      typeof response.deliveryAttemptId !== 'string' ||
      !UUID.test(response.deliveryAttemptId) ||
      response.deliveryState !== 'recorded' ||
      response.providerReference !== `in-app:${request.notificationId}` ||
      typeof response.acceptedAt !== 'string' ||
      !ISO_INSTANT.test(response.acceptedAt)
    )
      throw new Error('Malformed in-app notification response');
    return {
      ok: true,
      deliveryAttemptId: response.deliveryAttemptId,
      deliveryState: response.deliveryState,
      providerReference: response.providerReference,
      acceptedAt: response.acceptedAt,
    };
  },
});
