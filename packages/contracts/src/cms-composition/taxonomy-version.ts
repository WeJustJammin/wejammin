import { z } from 'zod';

import {
  CmsFieldKeySchema,
  CmsTypeKeySchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import { resourceMetaShape } from '../content-schema-registry/resources-meta.ts';
import {
  IdempotencyKeySchema,
  QuotedVersionSchema,
} from '../request-navigation-security.ts';
import { CanonicalDomainSchema } from './canonical-taxonomy-match.ts';
import { refineConditionalIfMatch } from './conditional-if-match.ts';
import { CmsDefinitionVersionStateSchema } from './definition-state.ts';
import { CmsLineageIdSchema, CmsTaxonomyKeySchema } from './key-grammar.ts';

/*
 * CMS-03C-16 taxonomy version create and cmsTaxonomyVersionsRead (D10, OD-1,
 * DEC-135). A vocabulary is identified by its stable lineage id `taxonomyId`; a
 * TaxonomyVersion is the reviewed rule set of the vocabulary (shape, allowlists
 * and declared canonical overlap domains) and the terms belong to the
 * vocabulary, not to a version. A declared domain with no registered provider is
 * accepted at create and refused at submission, activation and term action.
 */

export const TaxonomyShapeSchema = z.enum(['flat', 'hierarchical']);

const TypeKeysSchema = z
  .array(CmsTypeKeySchema)
  .min(1)
  .max(64)
  .refine((keys) => new Set(keys).size === keys.length, 'type_key_duplicate');
const FieldKeysSchema = z
  .array(CmsFieldKeySchema)
  .min(1)
  .max(64)
  .refine((keys) => new Set(keys).size === keys.length, 'field_key_duplicate');
const DeclaredDomainsSchema = z
  .array(CanonicalDomainSchema)
  .max(6)
  .refine(
    (domains) => new Set(domains).size === domains.length,
    'canonical_domain_duplicate',
  );

export const TaxonomyVersionRequestSchema = z.strictObject({
  taxonomyKey: CmsTaxonomyKeySchema,
  shape: TaxonomyShapeSchema,
  allowedTypeKeys: TypeKeysSchema,
  allowedFieldKeys: FieldKeysSchema,
  /** DEC-135: only the declared domains are checked against the canonical store. */
  canonicalOverlapDomains: DeclaredDomainsSchema,
  /** `null` for a first version; the parent's `version` for a successor. */
  expectedVersion: CmsVersionSchema.nullable(),
});

/** Creation omits If-Match; versioning requires its quoted strong form. */
export const TaxonomyVersionHeadersSchema = z.strictObject({
  contentType: z.literal('application/json'),
  idempotencyKey: IdempotencyKeySchema,
  ifMatch: QuotedVersionSchema.optional(),
});

/** OpenAPI transport view: If-Match is absent on a first version and equals `expectedVersion` otherwise. */
export const TaxonomyVersionApiRequestSchema = z
  .strictObject({
    headers: TaxonomyVersionHeadersSchema,
    body: TaxonomyVersionRequestSchema,
  })
  .superRefine(refineConditionalIfMatch);

/** CMS-03C-16 201 body: a `draft` version, with no ownership or release evidence. */
export const TaxonomyVersionResourceSchema = z.strictObject({
  ...resourceMetaShape,
  state: CmsDefinitionVersionStateSchema,
  taxonomyId: CmsLineageIdSchema,
  taxonomyKey: CmsTaxonomyKeySchema,
  taxonomyVersion: z.number().int().positive(),
  shape: TaxonomyShapeSchema,
  allowedTypeKeys: TypeKeysSchema,
  allowedFieldKeys: FieldKeysSchema,
  canonicalOverlapDomains: DeclaredDomainsSchema,
});

/** `cmsTaxonomyVersionsRead` addressing: the vocabulary lineage id path, no query key. */
export const TaxonomyVersionsApiRequestSchema = z.strictObject({
  taxonomyId: CmsLineageIdSchema,
});

/** At most 50 versions of one vocabulary, newest first, with the page version. */
export const TaxonomyVersionsPageSchema = z
  .strictObject({
    items: z.array(TaxonomyVersionResourceSchema).max(50),
    pageVersion: CmsVersionSchema,
  })
  .superRefine((value, context) => {
    for (let index = 1; index < value.items.length; index += 1) {
      const previous = value.items[index - 1];
      const next = value.items[index];
      if (
        previous !== undefined &&
        next !== undefined &&
        (next.taxonomyId !== previous.taxonomyId ||
          next.taxonomyVersion >= previous.taxonomyVersion)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['items', index],
          message: 'items are the versions of one vocabulary, newest first',
        });
        break;
      }
    }
  });

export type TaxonomyVersionRequest = z.infer<
  typeof TaxonomyVersionRequestSchema
>;
export type TaxonomyVersionHeaders = z.infer<
  typeof TaxonomyVersionHeadersSchema
>;
export type TaxonomyVersionResource = z.infer<
  typeof TaxonomyVersionResourceSchema
>;
export type TaxonomyVersionsPage = z.infer<typeof TaxonomyVersionsPageSchema>;
