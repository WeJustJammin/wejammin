import { z } from 'zod';

import { PositiveBigintDecimalSchema } from './platform-events.ts';

/**
 * Queue envelopes for the registered event consumers (BE01a "Events and
 * Cross-Shard Handoff", BE03a "Event schemas"). Like `QueueEnvelopeSchema`,
 * a consumer envelope carries identifiers only: the aggregate id IS the
 * payload identifier the consumer rereads, so no payload, secret, provider
 * reference, address or authority travels on the Queue.
 */
const CanonicalUuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );

export const CONSUMER_EVENT_TYPE = {
  capabilityGrantChanged: 'cms.capability.grant.changed.v1',
  mfaFactorChanged: 'identity.mfa-factor.changed.v1',
  securityNotificationRequested: 'identity.security-notification.requested.v1',
} as const;

const CONSUMER_EVENT_FAMILY =
  /^(?:cms\.capability\.grant\.changed|identity\.mfa-factor\.changed|identity\.security-notification\.requested)\.v[0-9]+$/;

/** True for every version of a consumer event family, known or not. */
export const isConsumerEventType = (value: unknown): value is string =>
  typeof value === 'string' && CONSUMER_EVENT_FAMILY.test(value);

const consumerEnvelope = <
  const Type extends string,
  const Aggregate extends string,
>(
  eventType: Type,
  aggregateType: Aggregate,
) =>
  z
    .object({
      eventId: CanonicalUuidSchema,
      eventType: z.literal(eventType),
      schemaVersion: z.literal(1),
      aggregateType: z.literal(aggregateType),
      aggregateId: CanonicalUuidSchema,
      aggregateVersion: PositiveBigintDecimalSchema,
      correlationId: CanonicalUuidSchema,
      causationId: CanonicalUuidSchema.nullable(),
    })
    .strict()
    .readonly();

export const IdentityMfaFactorChangedQueueEnvelopeSchema = consumerEnvelope(
  CONSUMER_EVENT_TYPE.mfaFactorChanged,
  'mfa_factor',
);
export const IdentitySecurityNotificationQueueEnvelopeSchema = consumerEnvelope(
  CONSUMER_EVENT_TYPE.securityNotificationRequested,
  'security_event',
);
export const CmsCapabilityGrantChangedQueueEnvelopeSchema = consumerEnvelope(
  CONSUMER_EVENT_TYPE.capabilityGrantChanged,
  'cms_capability_grant',
);

/** Every envelope the outbox relay may place on the queue for a consumer. */
export const ConsumerQueueEnvelopeSchema = z.union([
  IdentityMfaFactorChangedQueueEnvelopeSchema,
  IdentitySecurityNotificationQueueEnvelopeSchema,
  CmsCapabilityGrantChangedQueueEnvelopeSchema,
]);

export type ConsumerQueueEnvelope = z.infer<typeof ConsumerQueueEnvelopeSchema>;

export type IdentityMfaFactorChangedQueueEnvelope = z.infer<
  typeof IdentityMfaFactorChangedQueueEnvelopeSchema
>;
export type IdentitySecurityNotificationQueueEnvelope = z.infer<
  typeof IdentitySecurityNotificationQueueEnvelopeSchema
>;
export type CmsCapabilityGrantChangedQueueEnvelope = z.infer<
  typeof CmsCapabilityGrantChangedQueueEnvelopeSchema
>;
