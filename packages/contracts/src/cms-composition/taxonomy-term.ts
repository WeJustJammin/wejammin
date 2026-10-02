import { z } from 'zod';

import {
  CmsLocaleSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import { resourceMetaShape } from '../content-schema-registry/resources-meta.ts';
import {
  IdempotencyKeySchema,
  QuotedVersionSchema,
} from '../request-navigation-security.ts';

/** Term keys remain stable through label, alias, and merge actions. */
export const TaxonomyTermKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,63}$/u, 'term_key_invalid');

const TermLabelSchema = z.strictObject({
  locale: CmsLocaleSchema,
  label: z
    .string()
    .min(1)
    .max(160)
    .refine((value) => value.normalize('NFC') === value, 'label_not_nfc'),
});

export const TaxonomyTermActionRequestSchema = z
  .strictObject({
    taxonomyId: CmsUuidSchema,
    action: z.enum(['create', 'rename', 'alias', 'deprecate', 'merge']),
    termKey: TaxonomyTermKeySchema,
    parentId: CmsUuidSchema.nullable(),
    survivorId: CmsUuidSchema.nullable(),
    labels: z.array(TermLabelSchema).min(1).max(64),
    aliases: z.array(z.string().min(1).max(160)).max(64),
    expectedVersion: CmsVersionSchema,
  })
  .superRefine((value, context) => {
    if (value.action === 'merge' && value.survivorId === null)
      context.addIssue({
        code: 'custom',
        path: ['survivorId'],
        message: 'merge_requires_survivor',
      });
    if (value.action !== 'merge' && value.survivorId !== null)
      context.addIssue({
        code: 'custom',
        path: ['survivorId'],
        message: 'survivor_merge_only',
      });
  });

export const TaxonomyTermActionHeadersSchema = z.strictObject({
  contentType: z.literal('application/json'),
  idempotencyKey: IdempotencyKeySchema,
  ifMatch: QuotedVersionSchema,
});

/** OpenAPI transport shape for the canonical CMS-03C-03 operation. */
export const TaxonomyTermActionApiRequestSchema = z.strictObject({
  taxonomyId: CmsUuidSchema,
  headers: TaxonomyTermActionHeadersSchema,
  body: TaxonomyTermActionRequestSchema,
});

/** Browser-safe term and redirect identity; no owner or assignment authority. */
export const TaxonomyTermResourceSchema = z.strictObject({
  ...resourceMetaShape,
  lifecycle: z.enum(['active', 'deprecated', 'merged']),
  taxonomyId: CmsUuidSchema,
  termId: CmsUuidSchema,
  termKey: TaxonomyTermKeySchema,
  parentId: CmsUuidSchema.nullable(),
  successorId: CmsUuidSchema.nullable(),
});

export type TaxonomyTermActionRequest = z.infer<
  typeof TaxonomyTermActionRequestSchema
>;
export type TaxonomyTermActionHeaders = z.infer<
  typeof TaxonomyTermActionHeadersSchema
>;
export type TaxonomyTermResource = z.infer<typeof TaxonomyTermResourceSchema>;
