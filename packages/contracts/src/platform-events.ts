import { z } from 'zod';

import {
  ProfileClaimChangedEventSchema,
  ProfileContestChangedEventSchema,
  ProfileProjectionInvalidatedEventSchema,
  ProfileShadowCreatedEventSchema,
} from './profiles-verification/events.ts';

const CanonicalUuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
const RegistryKeySchema = z.string().regex(/^[a-z][a-z0-9_.:-]{0,127}$/);

const POSITIVE_BIGINT_DECIMAL = /^[1-9]\d{0,18}$/;

// Zod 4 runs refinements even after a failed regex check, so the range check
// only converts a value that already matches the canonical decimal grammar;
// anything else is a validation failure, never a thrown SyntaxError.
export const PositiveBigintDecimalSchema = z
  .string()
  .regex(POSITIVE_BIGINT_DECIMAL)
  .refine(
    (value) =>
      !POSITIVE_BIGINT_DECIMAL.test(value) ||
      BigInt(value) <= 9_223_372_036_854_775_807n,
    { message: 'Version exceeds the positive bigint range' },
  );

export const PlatformEventTypeSchema = z.enum([
  'identity.acting-context.revoked.v1',
  'identity.alias.changed.v1',
  'identity.facet.changed.v1',
  'identity.governance.activated.v1',
  'identity.organization.changed.v1',
  'identity.relationship.changed.v1',
  'job.requested',
  'object.uploaded',
  'profile.claim.changed.v1',
  'profile.contest.changed.v1',
  'profile.projection.invalidated.v1',
  'profile.shadow.created.v1',
  'provider.operation.requested',
  'webhook.accepted',
]);

const EventBaseSchema = z
  .object({
    eventId: CanonicalUuidSchema,
    schemaVersion: z.literal(1),
    aggregateType: RegistryKeySchema,
    aggregateId: CanonicalUuidSchema,
    aggregateVersion: PositiveBigintDecimalSchema,
    correlationId: CanonicalUuidSchema,
    causationId: CanonicalUuidSchema.nullable(),
    actorId: CanonicalUuidSchema.nullable(),
    actingPartyId: CanonicalUuidSchema.nullable(),
    occurredAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const PlatformEventSchema = z.discriminatedUnion('eventType', [
  EventBaseSchema.extend({
    eventType: z.literal('identity.facet.changed.v1'),
    payload: z
      .object({
        personId: CanonicalUuidSchema,
        facetCode: RegistryKeySchema,
      })
      .strict()
      .readonly(),
  }).strict(),
  EventBaseSchema.extend({
    eventType: z.literal('identity.alias.changed.v1'),
    payload: z.object({ aliasId: CanonicalUuidSchema }).strict().readonly(),
  }).strict(),
  EventBaseSchema.extend({
    eventType: z.literal('identity.acting-context.revoked.v1'),
    payload: z
      .object({
        personId: CanonicalUuidSchema,
        partyId: CanonicalUuidSchema,
        relationshipId: CanonicalUuidSchema.nullable(),
      })
      .strict()
      .readonly(),
  }).strict(),
  EventBaseSchema.extend({
    eventType: z.literal('identity.organization.changed.v1'),
    payload: z
      .object({ organizationId: CanonicalUuidSchema })
      .strict()
      .readonly(),
  }).strict(),
  EventBaseSchema.extend({
    eventType: z.literal('identity.relationship.changed.v1'),
    payload: z
      .object({
        relationshipType: RegistryKeySchema,
        relationshipId: CanonicalUuidSchema,
      })
      .strict()
      .readonly(),
  }).strict(),
  EventBaseSchema.extend({
    eventType: z.literal('identity.governance.activated.v1'),
    payload: z
      .object({
        organizationId: CanonicalUuidSchema,
        termsVersionId: CanonicalUuidSchema,
      })
      .strict()
      .readonly(),
  }).strict(),
  ProfileShadowCreatedEventSchema,
  ProfileClaimChangedEventSchema,
  ProfileContestChangedEventSchema,
  ProfileProjectionInvalidatedEventSchema,
  EventBaseSchema.extend({
    eventType: z.literal('job.requested'),
    payload: z
      .object({ jobId: CanonicalUuidSchema, jobType: RegistryKeySchema })
      .strict()
      .readonly(),
  }).strict(),
  EventBaseSchema.extend({
    eventType: z.literal('object.uploaded'),
    payload: z.object({ objectId: CanonicalUuidSchema }).strict().readonly(),
  }).strict(),
  EventBaseSchema.extend({
    eventType: z.literal('provider.operation.requested'),
    payload: z.object({ operationId: CanonicalUuidSchema }).strict().readonly(),
  }).strict(),
  EventBaseSchema.extend({
    eventType: z.literal('webhook.accepted'),
    payload: z.object({ receiptId: CanonicalUuidSchema }).strict().readonly(),
  }).strict(),
]);

export const QueueEnvelopeSchema = z
  .object({
    eventId: CanonicalUuidSchema,
    eventType: PlatformEventTypeSchema,
    schemaVersion: z.literal(1),
    aggregateType: RegistryKeySchema,
    aggregateId: CanonicalUuidSchema,
    aggregateVersion: PositiveBigintDecimalSchema,
    correlationId: CanonicalUuidSchema,
    causationId: CanonicalUuidSchema.nullable(),
  })
  .strict()
  .readonly();

export type PlatformEvent = z.infer<typeof PlatformEventSchema>;
export type QueueEnvelope = z.infer<typeof QueueEnvelopeSchema>;
