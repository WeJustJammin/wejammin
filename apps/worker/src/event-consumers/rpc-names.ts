/**
 * Protected `platform_api` RPCs the registered event consumers call. Every
 * name is a Worker-only (service-role) function; none is reachable from a
 * client route.
 */
export const EVENT_CONSUMER_RPC = {
  /** BE01a: settles one reconciling MFA factor row by provider status. */
  reconcileFactor: 'auth_mfa_factor_reconcile',
  /** BE01a: reads one factor row's reconciliation view (Worker memory only). */
  readFactorForReconciliation: 'auth_mfa_factor_reconcile_read',
  /** BE01a: count and oldest age of `reconciling` factor rows. */
  readReconcilingAge: 'auth_mfa_reconciling_age',
  /** BE01a: reads the immutable security event behind a notification request. */
  readSecurityNotification: 'identity_security_notification_read',
  /** BE03a: authoritative current read of one CMS capability grant. */
  readCapabilityGrant: 'cms_capability_grant_read_current',
  /** AC-916: records an in-app notification intent (account holder resolved server-side). */
  recordInAppNotification: 'in_app_notification_record',
  /** BE00: durable dead-letter record for an event a consumer cannot accept. */
  deadLetterEvent: 'consumer_dead_letter_event',
} as const;

export type EventConsumerRpcName =
  (typeof EVENT_CONSUMER_RPC)[keyof typeof EVENT_CONSUMER_RPC];
