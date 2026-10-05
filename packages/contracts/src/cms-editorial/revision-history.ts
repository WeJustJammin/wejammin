import { z } from 'zod';

import {
  CmsHashSchema,
  CmsInstantSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import { EntryRevisionStateSchema } from './models.ts';
import { Bcp47Schema, JsonPointerSchema } from './primitives.ts';

/** BE03b RevisionSummary: one authorized, schema-aware history row. */
export const RevisionSummarySchema = z
  .strictObject({
    id: CmsUuidSchema,
    revisionNumber: CmsVersionSchema,
    locale: Bcp47Schema,
    state: EntryRevisionStateSchema,
    contentHash: CmsHashSchema,
    createdAt: CmsInstantSchema,
    authorClass: z.string().min(1).max(64),
  })
  .readonly();

/**
 * BE03b `ComparisonDomain`: the closed surface a changed path belongs to.  A
 * reader uses it to group a diff without re-deriving the path grammar.
 */
export const RevisionHistoryComparisonDomainSchema = z.enum([
  'field',
  'block',
  'relation',
]);

/** One safe, path-scoped entry of a schema-aware revision comparison. */
export const RevisionHistoryChangeSchema = z
  .strictObject({
    path: JsonPointerSchema,
    kind: z.enum(['added', 'removed', 'changed', 'unchanged']),
    domain: RevisionHistoryComparisonDomainSchema,
    leftHash: CmsHashSchema.nullable(),
    rightHash: CmsHashSchema.nullable(),
  })
  .readonly();

/**
 * BE03b `RevisionRestoreAvailability`: the closed verdict on whether the two
 * compared sides can be reconciled.  `available` carries a resolved chain;
 * `chain_unavailable` and `transform_missing` name the two server-side misses
 * a reader may see without learning the chain internals.
 */
export const RevisionRestoreAvailabilitySchema = z.enum([
  'available',
  'chain_unavailable',
  'transform_missing',
]);

/**
 * BE03b `RevisionHistoryRestore`: the bounded migration chain a reader may act
 * on.  The edge count is capped at 64, matching the registry's chain bound, and
 * the chain hash binds the verdict to the exact resolved chain.
 */
export const RevisionHistoryRestoreSchema = z
  .strictObject({
    migrationChainId: CmsUuidSchema,
    edgeCount: z.number().int().min(0).max(64),
    chainHash: CmsHashSchema,
    availability: RevisionRestoreAvailabilitySchema,
  })
  .readonly();

/** BE03b comparison block: readable side ids plus bounded safe field diffs. */
export const RevisionHistoryCompareSchema = z
  .strictObject({
    leftRevisionId: CmsUuidSchema,
    rightRevisionId: CmsUuidSchema,
    changes: z.array(RevisionHistoryChangeSchema).max(512).readonly(),
    restore: RevisionHistoryRestoreSchema.nullable(),
  })
  .readonly();

/** BE03b RevisionHistoryPage: never more than 50 summaries plus one cursor. */
export const RevisionHistoryPageSchema = z
  .strictObject({
    items: z.array(RevisionSummarySchema).max(50).readonly(),
    nextCursor: z.string().max(512).nullable(),
    pageVersion: CmsVersionSchema,
    compare: RevisionHistoryCompareSchema.nullable(),
  })
  .readonly();

/** BE03b CMS-03B-03 addressing: exactly one UUID path parameter. */
export const RevisionHistoryPathParamsSchema = z
  .strictObject({ entryId: CmsUuidSchema })
  .readonly();

/**
 * BE03b RevisionHistoryQuery: the bound entry id plus a signed keyset cursor, a
 * 1-50 window defaulting to 25, and only the two allowlisted filters (state,
 * locale).  The entry id repeats the path parameter so the query is
 * self-describing, matching the CMS-03B-11 precedent.  The cursor is bound to
 * the actor and acting party server-side, and compareRevisionId is optional
 * with both sides required to stay readable.
 */
export const RevisionHistoryQuerySchema = z
  .strictObject({
    entryId: CmsUuidSchema,
    cursor: z.string().max(512).nullable().optional(),
    limit: z.number().int().min(1).max(50).default(25),
    state: EntryRevisionStateSchema.optional(),
    compareRevisionId: CmsUuidSchema.optional(),
    locale: Bcp47Schema.optional(),
  })
  .readonly();

/**
 * OpenAPI transport view for CMS-03B-03: the UUID path plus the read-only
 * query keys.  A safe read accepts no body, Idempotency-Key, or If-Match, so
 * this schema deliberately declares neither headers nor body.
 */
export const RevisionHistoryApiRequestSchema = z.strictObject({
  entryId: CmsUuidSchema,
  query: z.strictObject({
    cursor: z.string().max(512).nullable().optional(),
    limit: z.number().int().min(1).max(50).default(25),
    state: EntryRevisionStateSchema.optional(),
    compareRevisionId: CmsUuidSchema.optional(),
    locale: Bcp47Schema.optional(),
  }),
});

export type RevisionSummary = z.infer<typeof RevisionSummarySchema>;
export type RevisionHistoryComparisonDomain = z.infer<
  typeof RevisionHistoryComparisonDomainSchema
>;
export type RevisionHistoryChange = z.infer<typeof RevisionHistoryChangeSchema>;
export type RevisionRestoreAvailability = z.infer<
  typeof RevisionRestoreAvailabilitySchema
>;
export type RevisionHistoryRestore = z.infer<
  typeof RevisionHistoryRestoreSchema
>;
export type RevisionHistoryCompare = z.infer<
  typeof RevisionHistoryCompareSchema
>;
export type RevisionHistoryPage = z.infer<typeof RevisionHistoryPageSchema>;
export type RevisionHistoryPathParams = z.infer<
  typeof RevisionHistoryPathParamsSchema
>;
export type RevisionHistoryQuery = z.infer<typeof RevisionHistoryQuerySchema>;
