import { z } from 'zod';

import { CmsUuidSchema } from '../content-schema-registry/primitives.ts';
import { CompositionInstanceResourceSchema } from './pattern-instance.ts';

/*
 * cmsCompositionInstancesRead (DEC-206): the protected read of the composition
 * instances of an entry's current draft revision, for the composition page's
 * instance list and as its edit-authority gate. It answers the newest row of
 * each path in state `draft`, `active` or `pending_diff` (never superseded or
 * retired history) in render-plan order (slot ordinal, `position`, `path`
 * bytewise, `id`; DEC-185), at most `limit` (1-50, default 25) per page, with a
 * signed opaque cursor (BE00 collection rules, as CMS-03C-13: authenticated,
 * expiring within 24 hours, bound to the route, entry, draft revision, sort and
 * the caller's user/acting context; a tampered, expired or cross-context cursor
 * is a 400). The page size is not part of the binding.
 */

/** BE00 page-size bounds: `limit` 1-50, default 25 (BE03c `CompositionInstancesQuery`). */
export const CMS_COMPOSITION_INSTANCES_PAGE_MAX = 50;
export const CMS_COMPOSITION_INSTANCES_PAGE_DEFAULT = 25;

const instancesQueryShape = {
  cursor: z.string().max(512).nullable().optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(CMS_COMPOSITION_INSTANCES_PAGE_MAX)
    .default(CMS_COMPOSITION_INSTANCES_PAGE_DEFAULT),
} as const;

export const CompositionInstancesQuerySchema =
  z.strictObject(instancesQueryShape);

/** OpenAPI transport view: the entry id path and the allowlisted query keys. */
export const CompositionInstancesReadApiRequestSchema = z.strictObject({
  entryId: CmsUuidSchema,
  query: z.strictObject(instancesQueryShape),
});

const LIVE_STATES: ReadonlySet<string> = new Set([
  'draft',
  'active',
  'pending_diff',
]);

export const CompositionInstancePageSchema = z
  .strictObject({
    /** The entry's current draft revision, or null when the entry has none. */
    revisionId: CmsUuidSchema.nullable(),
    items: z
      .array(CompositionInstanceResourceSchema)
      .max(CMS_COMPOSITION_INSTANCES_PAGE_MAX),
    nextCursor: z.string().max(512).nullable(),
  })
  .superRefine((page, context) => {
    if (page.revisionId === null) {
      if (page.items.length > 0)
        context.addIssue({
          code: 'custom',
          path: ['items'],
          message: 'an entry without a draft revision has no instances',
        });
      if (page.nextCursor !== null)
        context.addIssue({
          code: 'custom',
          path: ['nextCursor'],
          message: 'an entry without a draft revision has no further page',
        });
      return;
    }
    const paths = new Set<string>();
    const ids = new Set<string>();
    page.items.forEach((row, index) => {
      if (!LIVE_STATES.has(row.state))
        context.addIssue({
          code: 'custom',
          path: ['items', index, 'state'],
          message: 'only draft, active and pending_diff heads are listed',
        });
      if (row.revisionId !== page.revisionId)
        context.addIssue({
          code: 'custom',
          path: ['items', index, 'revisionId'],
          message: 'every row belongs to the page revision',
        });
      if (paths.has(row.path))
        context.addIssue({
          code: 'custom',
          path: ['items', index, 'path'],
          message: 'one row per path',
        });
      paths.add(row.path);
      if (ids.has(row.id))
        context.addIssue({
          code: 'custom',
          path: ['items', index, 'id'],
          message: 'one row per id',
        });
      ids.add(row.id);
    });
  });

export type CompositionInstancesQuery = z.infer<
  typeof CompositionInstancesQuerySchema
>;
export type CompositionInstancesReadApiRequest = z.infer<
  typeof CompositionInstancesReadApiRequestSchema
>;
export type CompositionInstancePage = z.infer<
  typeof CompositionInstancePageSchema
>;

/**
 * Whether a parsed page honours the request that asked for it (DEC-206): never more items than the requested `limit`
 * (default 25), a continuation cursor offered only after a full page of that size (the database issues one only when
 * more rows exist beyond it), and a request that carried a cursor answered by a page of a revision, since no cursor can
 * have been issued for an entry without a draft revision. The Worker and the first-party proxy both refuse an answer
 * that fails it as an invalid dependency answer.
 */
export const compositionInstancesPageHonours = (
  page: CompositionInstancePage,
  request: Readonly<{
    cursor?: string | null | undefined;
    limit?: number | undefined;
  }>,
): boolean => {
  const limit = request.limit ?? CMS_COMPOSITION_INSTANCES_PAGE_DEFAULT;
  if (page.items.length > limit) return false;
  if (page.revisionId === null) return request.cursor == null;
  return (
    page.nextCursor === null ||
    (page.nextCursor !== '' && page.items.length === limit)
  );
};
