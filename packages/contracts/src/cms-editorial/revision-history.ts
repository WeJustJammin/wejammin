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

/** One safe, path-scoped entry of a schema-aware revision comparison. */
export const RevisionHistoryChangeSchema = z
  .strictObject({
    path: JsonPointerSchema,
    kind: z.enum(['added', 'removed', 'changed', 'unchanged']),
    leftHash: CmsHashSchema.nullable(),
    rightHash: CmsHashSchema.nullable(),
  })
  .readonly();

/** BE03b comparison block: readable side ids plus bounded safe field diffs. */
export const RevisionHistoryCompareSchema = z
  .strictObject({
    leftRevisionId: CmsUuidSchema,
    rightRevisionId: CmsUuidSchema,
    changes: z.array(RevisionHistoryChangeSchema).max(512).readonly(),
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
export type RevisionHistoryChange = z.infer<typeof RevisionHistoryChangeSchema>;
export type RevisionHistoryCompare = z.infer<
  typeof RevisionHistoryCompareSchema
>;
export type RevisionHistoryPage = z.infer<typeof RevisionHistoryPageSchema>;
export type RevisionHistoryPathParams = z.infer<
  typeof RevisionHistoryPathParamsSchema
>;
export type RevisionHistoryQuery = z.infer<typeof RevisionHistoryQuerySchema>;
