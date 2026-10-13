import { z } from 'zod';

import {
  CmsHashSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import { resourceMetaShape } from '../content-schema-registry/resources-meta.ts';
import {
  IdempotencyKeySchema,
  QuotedVersionSchema,
} from '../request-navigation-security.ts';
import { refineConditionalIfMatch } from './conditional-if-match.ts';
import { CmsDefinitionVersionStateSchema } from './definition-state.ts';
import { CmsLineageIdSchema, CmsPatternKeySchema } from './key-grammar.ts';
import { PatternBlockTreeSchema } from './pattern-node.ts';

/*
 * CMS-03C-12 pattern version create and cmsPatternLatestRead (D9, OD-2). A
 * PatternVersion is a persisted, owner-scoped, versioned block tree. The server
 * resolves every reachable block, requires every nested pattern to be `active`
 * and compatible, rejects any cycle through a nested lineage, recomputes the
 * block registry digest (the client digest is an equality expectation only)
 * and stores `node_count`. Ownership is never a member.
 */

/** 1-64 unique content-type ids whose entries may use the pattern (mirrors templates). */
const CompatibleTypeIdsSchema = z
  .array(CmsUuidSchema)
  .min(1)
  .max(64)
  .refine(
    (ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length,
    'compatible_type_duplicate',
  );

export const PatternVersionRequestSchema = z.strictObject({
  patternKey: CmsPatternKeySchema,
  compatibleTypeIds: CompatibleTypeIdsSchema,
  blockTree: PatternBlockTreeSchema,
  blockRegistryDigest: CmsHashSchema.optional(),
  /** `null` for a first version; the parent's `version` for a successor. */
  expectedVersion: CmsVersionSchema.nullable(),
});

/** Creation omits If-Match; versioning requires its quoted strong form. */
export const PatternVersionHeadersSchema = z.strictObject({
  contentType: z.literal('application/json'),
  idempotencyKey: IdempotencyKeySchema,
  ifMatch: QuotedVersionSchema.optional(),
});

/** OpenAPI transport view: If-Match is absent on a first version and equals `expectedVersion` otherwise. */
export const PatternVersionApiRequestSchema = z
  .strictObject({
    headers: PatternVersionHeadersSchema,
    body: PatternVersionRequestSchema,
  })
  .superRefine(refineConditionalIfMatch);

/** CMS-03C-12 201 body: a `draft` version, with no ownership or release evidence. */
export const PatternVersionResourceSchema = z.strictObject({
  ...resourceMetaShape,
  state: CmsDefinitionVersionStateSchema,
  patternId: CmsLineageIdSchema,
  patternKey: CmsPatternKeySchema,
  patternVersion: z.number().int().positive(),
  compatibleTypeIds: z.array(CmsUuidSchema).min(1).max(64),
  nodeCount: z.number().int().min(1).max(512),
  blockRegistryDigest: CmsHashSchema,
});

/** `cmsPatternLatestRead`: the owner's latest version of the key in any state. */
export const PatternVersionDetailSchema = z.strictObject({
  ...PatternVersionResourceSchema.shape,
  blockTree: PatternBlockTreeSchema,
});

/** `cmsPatternLatestRead` addressing: the path key, resolved only within the caller's owner scope. */
export const PatternLatestApiRequestSchema = z.strictObject({
  patternKey: CmsPatternKeySchema,
});

export type PatternVersionRequest = z.infer<typeof PatternVersionRequestSchema>;
export type PatternVersionHeaders = z.infer<typeof PatternVersionHeadersSchema>;
export type PatternVersionResource = z.infer<
  typeof PatternVersionResourceSchema
>;
export type PatternVersionDetail = z.infer<typeof PatternVersionDetailSchema>;
