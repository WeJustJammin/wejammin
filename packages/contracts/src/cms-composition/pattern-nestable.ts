import { z } from 'zod';

import { CmsUuidSchema } from '../content-schema-registry/primitives.ts';

/*
 * cmsPatternNestableRead (DEC-196, DEC-232; BE03c Route Registry, `PatternNestableQuery`): the designer-only read
 * behind the nested-pattern picker of the pattern version designer. It answers the same `PatternSelectorPage` as
 * CMS-03C-13 (`pattern-selector.ts`), but names the 1-64 content types of the pattern being designed and lists the
 * `active` versions of the owner scope whose `compatibleTypeIds` contains EVERY one of them (the DEC-181 nested-node
 * rule), in the order `(patternKey ASC, patternVersion DESC)` under a signed keyset cursor. `contentTypeId` is
 * repeated in the query string, so it is an array here; the Worker collects the repeated members.
 */

/** The most content types one request may name (BE03c validation row: `contentTypeId` repeated 1-64 times). */
export const CMS_PATTERN_NESTABLE_TYPES_MAX = 64;

const nestableQueryShape = {
  contentTypeId: z
    .array(CmsUuidSchema)
    .min(1)
    .max(CMS_PATTERN_NESTABLE_TYPES_MAX)
    .refine(
      (ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length,
      'content_type_duplicated',
    ),
  cursor: z.string().max(512).nullable().optional(),
  limit: z.number().int().min(1).max(50).default(25),
} as const;

export const PatternNestableQuerySchema = z.strictObject(nestableQueryShape);

/** OpenAPI transport view: the allowlisted query keys, no path. */
export const PatternNestableApiRequestSchema = z.strictObject({
  query: z.strictObject(nestableQueryShape),
});

export type PatternNestableQuery = z.infer<typeof PatternNestableQuerySchema>;
