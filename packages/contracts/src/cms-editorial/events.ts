import { z } from 'zod';

import {
  CmsHashSchema,
  CmsInstantSchema,
  CmsUuidSchema,
} from '../content-schema-registry/primitives.ts';
import { PositiveBigintDecimalSchema } from '../platform-events.ts';

/*
 * BE03b "Event schemas": the four event types this shard owns. Every event uses
 * the BE00 identifier-only envelope, and the payload carries identifiers (plus,
 * for a restore, a hash and counts) only: never content values, review comments,
 * tokens, PII or target-domain authority. Consumers are at-least-once,
 * deduplicated by `eventId`, monotonic by `aggregateVersion`, and refetch the
 * canonical state under their own capability instead of caching the payload.
 */

export const CMS_EDITORIAL_EVENT_TYPES = [
  'cms.entry.revision-created.v1',
  'cms.entry.revision-restored.v1',
  'cms.entry.review-changed.v1',
  'cms.publication.changed.v1',
] as const;

/** `cms.entry.revision-created.v1`: CMS-03B-01, -02, -04 and -10 emit after commit. */
export const CmsRevisionCreatedPayloadSchema = z
  .strictObject({ entryId: CmsUuidSchema, revisionId: CmsUuidSchema })
  .readonly();

/** `cms.entry.revision-restored.v1`: CMS-03B-04 emits one beside the created event. */
export const CmsRevisionRestoredPayloadSchema = z
  .strictObject({
    entryId: CmsUuidSchema,
    revisionId: CmsUuidSchema,
    sourceRevisionId: CmsUuidSchema,
    migrationChainId: CmsUuidSchema,
    chainHash: CmsHashSchema,
    edgeCount: z.number().int().min(0).max(64),
    valueCount: z.number().int().min(0),
    relationCount: z.number().int().min(0),
  })
  .readonly();

/**
 * `cms.entry.review-changed.v1`: CMS-03B-05 and -06 emit after the review or
 * decision commits, CMS-03B-18 after an assignment is created or revoked, and a
 * review invalidation after its commit. Task and notification consumers refetch
 * the frozen state through CMS-03B-16.
 */
export const CmsReviewChangedPayloadSchema = z
  .strictObject({ reviewId: CmsUuidSchema, revisionId: CmsUuidSchema })
  .readonly();

/**
 * `cms.publication.changed.v1`: CMS-03B-09 and the schedule executor
 * (CMS-03B-20) emit exactly one per appended lineage row (a publish head or a
 * tombstone), with that row's id as `publicationVersionId`. Shard 04
 * route/render/search/sitemap/cache consumers converge the exact row.
 */
export const CmsPublicationChangedPayloadSchema = z
  .strictObject({
    entryId: CmsUuidSchema,
    publicationVersionId: CmsUuidSchema,
  })
  .readonly();

const eventEnvelope = <
  const Type extends (typeof CMS_EDITORIAL_EVENT_TYPES)[number],
  const Aggregate extends string,
  Payload extends z.ZodType,
>(
  eventType: Type,
  aggregateType: Aggregate,
  payload: Payload,
) =>
  z
    .strictObject({
      eventId: CmsUuidSchema,
      eventType: z.literal(eventType),
      schemaVersion: z.literal(1),
      occurredAt: CmsInstantSchema,
      /** The registered owner of the `cms.entry.` / `cms.publication.` prefixes. */
      producer: z.literal('cms.editorial'),
      correlationId: CmsUuidSchema,
      causationId: CmsUuidSchema.nullable(),
      aggregateType: z.literal(aggregateType),
      aggregateId: CmsUuidSchema,
      /** Lossless decimal string: a positive bigint never loses precision. */
      aggregateVersion: PositiveBigintDecimalSchema,
      payload,
    })
    .readonly();

/**
 * The BE00 envelope per owned event. A review event aggregates the review
 * (`aggregateVersion` is the review `version`; an assignment change leaves it
 * unchanged); a publication event aggregates the lineage (`aggregateId` is the
 * stable `publication_id`, `aggregateVersion` the lineage sequence).
 */
export const CmsEditorialEventSchema = z.discriminatedUnion('eventType', [
  eventEnvelope(
    'cms.entry.revision-created.v1',
    'cms_entry',
    CmsRevisionCreatedPayloadSchema,
  ),
  eventEnvelope(
    'cms.entry.revision-restored.v1',
    'cms_entry',
    CmsRevisionRestoredPayloadSchema,
  ),
  eventEnvelope(
    'cms.entry.review-changed.v1',
    'cms_editorial_review',
    CmsReviewChangedPayloadSchema,
  ),
  eventEnvelope(
    'cms.publication.changed.v1',
    'cms_publication',
    CmsPublicationChangedPayloadSchema,
  ),
]);

export type CmsEditorialEvent = z.infer<typeof CmsEditorialEventSchema>;
export type CmsReviewChangedPayload = z.infer<
  typeof CmsReviewChangedPayloadSchema
>;
export type CmsPublicationChangedPayload = z.infer<
  typeof CmsPublicationChangedPayloadSchema
>;
