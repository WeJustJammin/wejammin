import { z } from 'zod';

import {
  CmsHashSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import { CmsLineageIdSchema, CmsPatternKeySchema } from './key-grammar.ts';

/*
 * CMS-03C-13 author-facing pattern selector: only `active` pattern versions of
 * the caller's owner scope whose `compatibleTypeIds` contains the requested
 * content type, in the signed keyset order `(patternKey ASC, patternVersion DESC)`.
 * The state filter and the ordering are the database's; the cursor is signed
 * and bound to the query and acting scope by the Worker.
 */

const selectorQueryShape = {
  contentTypeId: CmsUuidSchema,
  cursor: z.string().max(512).nullable().optional(),
  limit: z.number().int().min(1).max(50).default(25),
} as const;

export const PatternSelectorQuerySchema = z.strictObject(selectorQueryShape);

/** OpenAPI transport view: the allowlisted query keys, no path. */
export const PatternSelectorApiRequestSchema = z.strictObject({
  query: z.strictObject(selectorQueryShape),
});

export const PatternSelectorItemSchema = z.strictObject({
  patternId: CmsLineageIdSchema,
  patternVersionId: CmsUuidSchema,
  patternKey: CmsPatternKeySchema,
  patternVersion: z.number().int().positive(),
  nodeCount: z.number().int().min(1).max(512),
  blockRegistryDigest: CmsHashSchema,
});

export const PatternSelectorPageSchema = z.strictObject({
  items: z.array(PatternSelectorItemSchema).max(50),
  nextCursor: z.string().max(512).nullable(),
  pageVersion: CmsVersionSchema,
});

export type PatternSelectorQuery = z.infer<typeof PatternSelectorQuerySchema>;
export type PatternSelectorItem = z.infer<typeof PatternSelectorItemSchema>;
export type PatternSelectorPage = z.infer<typeof PatternSelectorPageSchema>;
