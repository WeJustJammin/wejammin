import { z } from 'zod';

import {
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import { EntryRevisionStateSchema } from './models.ts';
import { RevisionSummarySchema } from './revision-history.ts';

/**
 * BE03b `EntryListQuery`: the CMS-03B-02 list window.  It carries only the
 * signed keyset cursor, the 1-50 page size defaulting to 25, and the two
 * allowlisted filters (state, contentTypeId).  Ownership, acting party, and
 * every other authority are deliberately absent: the server derives them
 * from the authenticated principal.
 */
export const EntryListQuerySchema = z
  .strictObject({
    cursor: z.string().max(512).nullable().optional(),
    limit: z.number().int().min(1).max(50).default(25),
    state: EntryRevisionStateSchema.optional(),
    contentTypeId: CmsUuidSchema.optional(),
  })
  .readonly();

/**
 * OpenAPI transport view for CMS-03B-13: the allowlisted read-only query keys
 * with no path parameters.  A safe read accepts no body, Idempotency-Key, or
 * If-Match, so this schema declares neither headers nor body.
 */
export const EntryListApiRequestSchema = z.strictObject({
  query: z.strictObject({
    cursor: z.string().max(512).nullable().optional(),
    limit: z.number().int().min(1).max(50).default(25),
    state: EntryRevisionStateSchema.optional(),
    contentTypeId: CmsUuidSchema.optional(),
  }),
});

/**
 * BE03b `EntryListPage`: never more than 50 authorized summaries, one opaque
 * next cursor, and the page version the window was taken at.
 */
export const EntryListPageSchema = z
  .strictObject({
    items: z.array(RevisionSummarySchema).max(50).readonly(),
    nextCursor: z.string().max(512).nullable(),
    pageVersion: CmsVersionSchema,
  })
  .readonly();

export type EntryListQuery = z.infer<typeof EntryListQuerySchema>;
export type EntryListPage = z.infer<typeof EntryListPageSchema>;
