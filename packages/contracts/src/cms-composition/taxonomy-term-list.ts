import { z } from 'zod';

import {
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import { CmsLineageIdSchema } from './key-grammar.ts';
import {
  TaxonomyTermKeySchema,
  TaxonomyTermLabelSchema,
} from './taxonomy-term.ts';

/*
 * cmsTaxonomyTermsRead: the curator's term list of one vocabulary, in the signed
 * keyset order `(termKey ASC, termId ASC)`, default limit 25 and maximum 50. A
 * response over 256 KiB is a 502 `DEPENDENCY_UNAVAILABLE` response-contract
 * failure, so the page schema refuses it.
 */

export const CMS_TERM_LIST_MAX_BYTES = 262_144;

export const TaxonomyTermLifecycleSchema = z.enum([
  'active',
  'deprecated',
  'merged',
]);

const termListQueryShape = {
  lifecycle: TaxonomyTermLifecycleSchema.optional(),
  cursor: z.string().max(512).nullable().optional(),
  limit: z.number().int().min(1).max(50).default(25),
} as const;

export const TaxonomyTermListQuerySchema = z.strictObject(termListQueryShape);

/** OpenAPI transport view: the vocabulary lineage id path and the allowlisted query keys. */
export const TaxonomyTermListApiRequestSchema = z.strictObject({
  taxonomyId: CmsLineageIdSchema,
  query: z.strictObject(termListQueryShape),
});

export const TaxonomyTermListItemSchema = z
  .strictObject({
    termId: CmsUuidSchema,
    termKey: TaxonomyTermKeySchema,
    lifecycle: TaxonomyTermLifecycleSchema,
    version: CmsVersionSchema,
    parentId: CmsUuidSchema.nullable(),
    /** The surviving term a `merged` term resolves to permanently. */
    successorId: CmsUuidSchema.nullable(),
    labels: z.array(TaxonomyTermLabelSchema).max(64),
    aliases: z.array(z.string().min(1).max(160)).max(64),
  })
  .superRefine((value, context) => {
    if ((value.lifecycle === 'merged') !== (value.successorId !== null))
      context.addIssue({
        code: 'custom',
        path: ['successorId'],
        message: 'successorId exists exactly when the term is merged',
      });
  });

export const TaxonomyTermListPageSchema = z
  .strictObject({
    items: z.array(TaxonomyTermListItemSchema).max(50),
    nextCursor: z.string().max(512).nullable(),
    pageVersion: CmsVersionSchema,
  })
  .superRefine((value, context) => {
    if (
      new TextEncoder().encode(JSON.stringify(value)).byteLength >
      CMS_TERM_LIST_MAX_BYTES
    )
      context.addIssue({ code: 'custom', message: 'response_too_large' });
  });

export type TaxonomyTermListQuery = z.infer<typeof TaxonomyTermListQuerySchema>;
export type TaxonomyTermListItem = z.infer<typeof TaxonomyTermListItemSchema>;
export type TaxonomyTermListPage = z.infer<typeof TaxonomyTermListPageSchema>;
