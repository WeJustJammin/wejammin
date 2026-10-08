import { z } from 'zod';

import {
  CmsInstantSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import { EntryLifecycleSchema, EntryRevisionStateSchema } from './models.ts';
import { RevisionSummaryBaseSchema } from './revision-history.ts';

/**
 * BE03b `EntryListItem` (DEC-145): one authorized list row, a `RevisionSummary`
 * plus three entry-level members.  `entryId` is the canonical owning entry, so a
 * consumer links to the entry rather than mistaking the revision id for one;
 * `entryLifecycle` and `entryUpdatedAt` are the server-derived entry lifecycle
 * and the entry's last-update instant the list renders and orders by (the list
 * is keyset-ordered by `entryUpdatedAt` descending, then `entryId`).  Every
 * other authority name, including any owner, assignee or acting-party
 * identifier, stays server-derived and absent.
 */
export const EntryListItemSchema = z
  .strictObject({
    ...RevisionSummaryBaseSchema.shape,
    entryId: CmsUuidSchema,
    entryLifecycle: EntryLifecycleSchema,
    entryUpdatedAt: CmsInstantSchema,
  })
  .readonly();

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
    items: z.array(EntryListItemSchema).max(50).readonly(),
    nextCursor: z.string().max(512).nullable(),
    pageVersion: CmsVersionSchema,
  })
  .readonly();

export type EntryListQuery = z.infer<typeof EntryListQuerySchema>;
export type EntryListItem = z.infer<typeof EntryListItemSchema>;
export type EntryListPage = z.infer<typeof EntryListPageSchema>;
