import { z } from 'zod';

import {
  CmsFieldKeySchema,
  CmsLocaleSchema,
  CmsTypeKeySchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import { CmsLineageIdSchema, CmsTaxonomyKeySchema } from './key-grammar.ts';
import { TaxonomyShapeSchema } from './taxonomy-version.ts';

/*
 * CMS-03C-17 author-facing taxonomy selector: the `active` terms of the `active`
 * vocabularies of the caller's owner scope whose allowlist names the requested
 * content type key and field key, in the signed keyset order `(taxonomyKey ASC,
 * termKey ASC)`. The label is the one for the requested locale, null when the
 * term has none (there is no fallback), and `merged` and `deprecated` terms are
 * never listed.
 */

const selectorQueryShape = {
  typeKey: CmsTypeKeySchema,
  fieldKey: CmsFieldKeySchema,
  locale: CmsLocaleSchema,
  cursor: z.string().max(512).nullable().optional(),
  limit: z.number().int().min(1).max(100).default(50),
} as const;

export const TaxonomySelectorQuerySchema = z.strictObject(selectorQueryShape);

/** OpenAPI transport view: the allowlisted query keys, no path. */
export const TaxonomySelectorApiRequestSchema = z.strictObject({
  query: z.strictObject(selectorQueryShape),
});

export const TaxonomySelectorTermSchema = z
  .strictObject({
    taxonomyId: CmsLineageIdSchema,
    taxonomyVersionId: CmsUuidSchema,
    taxonomyKey: CmsTaxonomyKeySchema,
    shape: TaxonomyShapeSchema,
    termId: CmsUuidSchema,
    termKey: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/u, 'term_key_invalid'),
    parentId: CmsUuidSchema.nullable(),
    /** The label for the requested locale; null when the term has none. */
    label: z.string().min(1).max(160).nullable(),
  })
  .superRefine((value, context) => {
    if (value.shape === 'flat' && value.parentId !== null)
      context.addIssue({
        code: 'custom',
        path: ['parentId'],
        message: 'a parent needs the hierarchical shape',
      });
  });

export const TaxonomySelectorPageSchema = z.strictObject({
  items: z.array(TaxonomySelectorTermSchema).max(100),
  nextCursor: z.string().max(512).nullable(),
  pageVersion: CmsVersionSchema,
});

export type TaxonomySelectorQuery = z.infer<typeof TaxonomySelectorQuerySchema>;
export type TaxonomySelectorTerm = z.infer<typeof TaxonomySelectorTermSchema>;
export type TaxonomySelectorPage = z.infer<typeof TaxonomySelectorPageSchema>;
