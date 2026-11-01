import { z } from 'zod';

import { CmsUuidSchema } from '../content-schema-registry/primitives.ts';
import { PositiveBigintDecimalSchema } from '../platform-events.ts';
import {
  CMS_EDITORIAL_JOB_TYPES,
  CMS_REVIEW_RECHECK_BATCH_MAX,
  ReviewDependencyKindSchema,
  ReviewDependencyRecheckJobSchema,
} from './jobs.ts';

/*
 * BE03b "Review invalidation / Dependency recheck": the consumers of six
 * events enqueue the BE00 job `cms.review.dependency_recheck` with
 * `{ eventId, kind, refId }`. This file owns the queue-side contracts of that
 * path: the identifier-only envelope each source event arrives in, the job
 * message (the strict job payload plus its continuation cursor) and the two
 * protected RPC shapes the Worker calls. Nothing here carries content, review
 * comments, tokens or authority: identifiers only.
 */

/** The six event types whose consumers enqueue the recheck, in BE03b order. */
export const REVIEW_RECHECK_SOURCE_EVENT_TYPES = [
  'cms.schema.activated.v1',
  'cms.template.activated.v1',
  'cms.pattern.activated.v1',
  'cms.taxonomy.changed.v1',
  'cms.localization.changed.v1',
  'cms.block.lifecycle.changed.v1',
] as const;

export type ReviewRecheckSourceEventType =
  (typeof REVIEW_RECHECK_SOURCE_EVENT_TYPES)[number];

/**
 * Per event type: the dependency index `kind` the event's identity is looked up
 * under, and the registered producer of the event-type prefix
 * (`platform_private.outbox_event_producers`). `aggregateType` is the pinned
 * outbox aggregate of an event whose producer exists today; it is `null` for
 * the Slice 12 events (template, pattern, taxonomy), whose producers have not
 * landed, and those accept any registry key until Slice 12 pins theirs.
 */
export const REVIEW_RECHECK_SOURCES = {
  'cms.schema.activated.v1': {
    kind: 'schema',
    producer: 'cms.schema_registry',
    aggregateType: 'cms_content_type_version',
  },
  'cms.template.activated.v1': {
    kind: 'template',
    producer: 'cms.composition',
    aggregateType: null,
  },
  'cms.pattern.activated.v1': {
    kind: 'pattern',
    producer: 'cms.composition',
    aggregateType: null,
  },
  'cms.taxonomy.changed.v1': {
    kind: 'taxonomy_version',
    producer: 'cms.composition',
    aggregateType: null,
  },
  'cms.localization.changed.v1': {
    kind: 'locale_source',
    producer: 'cms.composition',
    aggregateType: 'cms_content_entry',
  },
  'cms.block.lifecycle.changed.v1': {
    kind: 'block',
    producer: 'cms.schema_registry',
    aggregateType: 'cms_block_definition_version',
  },
} as const satisfies Readonly<
  Record<
    ReviewRecheckSourceEventType,
    Readonly<{
      kind: z.infer<typeof ReviewDependencyKindSchema>;
      producer: string;
      aggregateType: string | null;
    }>
  >
>;

const REVIEW_RECHECK_SOURCE_FAMILY =
  /^cms\.(?:schema\.activated|template\.activated|pattern\.activated|taxonomy\.changed|localization\.changed|block\.lifecycle\.changed)\.v[0-9]+$/u;

/** True for every version of the six families, known or not. */
export const isReviewRecheckSourceEventType = (
  value: unknown,
): value is string =>
  typeof value === 'string' && REVIEW_RECHECK_SOURCE_FAMILY.test(value);

const QueueUuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
  );
const AggregateKeySchema = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/u);

const sourceEnvelope = <
  const Type extends ReviewRecheckSourceEventType,
  Aggregate extends z.ZodType<string>,
>(
  eventType: Type,
  aggregateType: Aggregate,
) =>
  z
    .strictObject({
      eventId: QueueUuidSchema,
      eventType: z.literal(eventType),
      schemaVersion: z.literal(1),
      occurredAt: z.iso.datetime({ offset: true }),
      producer: z.literal(REVIEW_RECHECK_SOURCES[eventType].producer),
      aggregateType,
      aggregateId: QueueUuidSchema,
      aggregateVersion: PositiveBigintDecimalSchema,
      correlationId: QueueUuidSchema,
      causationId: QueueUuidSchema.nullable(),
    })
    .readonly();

/**
 * The BE00 identifier-only queue envelope of each source event. The outbox
 * payload never travels on the queue: the consumer rereads the committed event
 * through `cms_dependency_recheck_resolve_event`.
 */
export const ReviewRecheckSourceEnvelopeSchema = z.discriminatedUnion(
  'eventType',
  [
    sourceEnvelope(
      'cms.schema.activated.v1',
      z.literal(
        REVIEW_RECHECK_SOURCES['cms.schema.activated.v1'].aggregateType,
      ),
    ),
    sourceEnvelope('cms.template.activated.v1', AggregateKeySchema),
    sourceEnvelope('cms.pattern.activated.v1', AggregateKeySchema),
    sourceEnvelope('cms.taxonomy.changed.v1', AggregateKeySchema),
    sourceEnvelope(
      'cms.localization.changed.v1',
      z.literal(
        REVIEW_RECHECK_SOURCES['cms.localization.changed.v1'].aggregateType,
      ),
    ),
    sourceEnvelope(
      'cms.block.lifecycle.changed.v1',
      z.literal(
        REVIEW_RECHECK_SOURCES['cms.block.lifecycle.changed.v1'].aggregateType,
      ),
    ),
  ],
);

/**
 * The queue message of one recheck run: the strict job payload
 * `{ eventId, kind, refId }` of BE03b plus the continuation cursor (the id of
 * the last review the previous run handled, `null` for the first run).
 */
export const ReviewDependencyRecheckMessageSchema = z
  .strictObject({
    jobType: z.literal(CMS_EDITORIAL_JOB_TYPES.dependencyRecheck),
    schemaVersion: z.literal(1),
    payload: ReviewDependencyRecheckJobSchema,
    cursor: CmsUuidSchema.nullable(),
    correlationId: QueueUuidSchema,
  })
  .readonly();

/**
 * `platform_api.cms_dependency_recheck_resolve_event`: the committed event's
 * identity as a dependency index lookup, or `found: false` when the event row
 * is absent or does not carry the identity its published contract names.
 */
export const ReviewDependencyEventResolutionSchema = z.union([
  z.strictObject({ found: z.literal(false) }).readonly(),
  z
    .strictObject({
      found: z.literal(true),
      kind: ReviewDependencyKindSchema,
      refId: CmsUuidSchema,
    })
    .readonly(),
]);

/** `platform_api.cms_dependency_recheck_run` request: the job plus its cursor. */
export const ReviewDependencyRecheckRunRequestSchema = z
  .strictObject({
    eventId: CmsUuidSchema,
    kind: ReviewDependencyKindSchema,
    refId: CmsUuidSchema,
    cursor: CmsUuidSchema.nullable(),
  })
  .readonly();

/**
 * One run's answer: at most 500 reviews examined, those invalidated
 * `dependency_changed`, and a continuation cursor only after a full run.
 */
export const ReviewDependencyRecheckRunResultSchema = z
  .strictObject({
    examined: z.number().int().min(0).max(CMS_REVIEW_RECHECK_BATCH_MAX),
    invalidated: z.number().int().min(0).max(CMS_REVIEW_RECHECK_BATCH_MAX),
    nextCursor: CmsUuidSchema.nullable(),
  })
  .readonly()
  .refine(
    (run) =>
      run.invalidated <= run.examined &&
      (run.nextCursor === null ||
        run.examined === CMS_REVIEW_RECHECK_BATCH_MAX),
    { message: 'recheck_run_inconsistent' },
  );

export type ReviewRecheckSourceEnvelope = z.infer<
  typeof ReviewRecheckSourceEnvelopeSchema
>;
export type ReviewDependencyRecheckMessage = z.infer<
  typeof ReviewDependencyRecheckMessageSchema
>;
export type ReviewDependencyEventResolution = z.infer<
  typeof ReviewDependencyEventResolutionSchema
>;
export type ReviewDependencyRecheckRunRequest = z.infer<
  typeof ReviewDependencyRecheckRunRequestSchema
>;
export type ReviewDependencyRecheckRunResult = z.infer<
  typeof ReviewDependencyRecheckRunResultSchema
>;
