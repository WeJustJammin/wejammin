import { z } from 'zod';

import { JsonValueSchema } from '../api-error.ts';
import {
  CmsHashSchema,
  CmsLocaleSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import { CmsCanonicalLocaleSchema } from '../content-schema-registry/locale-config.ts';
import { resourceMetaShape } from '../content-schema-registry/resources-meta.ts';
import {
  IdempotencyKeySchema,
  QuotedVersionSchema,
} from '../request-navigation-security.ts';

const orderedFallbackChain = z
  .array(CmsLocaleSchema)
  .max(16)
  .refine(
    (locales) =>
      new Set(locales.map((locale) => locale.toLowerCase())).size ===
      locales.length,
    'fallback_locale_duplicate',
  );
const noFallbackFieldIds = z
  .array(CmsUuidSchema)
  .max(128)
  .refine(
    (ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length,
    'no_fallback_field_duplicate',
  );

export const LocaleVariantPathSchema = z.strictObject({
  entryId: CmsUuidSchema,
  locale: CmsLocaleSchema,
});

/** CMS-03C-04 translates bounded data, never arbitrary schema or authority. */
export const LocaleVariantRequestSchema = z.strictObject({
  entryId: CmsUuidSchema,
  locale: CmsLocaleSchema,
  sourceRevisionId: CmsUuidSchema,
  fields: z
    .array(
      z.strictObject({
        fieldId: CmsUuidSchema,
        value: JsonValueSchema,
      }),
    )
    .min(1)
    .max(128)
    .refine(
      (fields) =>
        new Set(fields.map(({ fieldId }) => fieldId.toLowerCase())).size ===
        fields.length,
      'field_duplicate',
    ),
  fallbackChain: orderedFallbackChain,
  noFallbackFieldIds,
  sourceHash: CmsHashSchema,
  expectedVersion: CmsVersionSchema,
});

export const LocaleVariantHeadersSchema = z.strictObject({
  contentType: z.literal('application/json'),
  idempotencyKey: IdempotencyKeySchema,
  ifMatch: QuotedVersionSchema,
});

export const LocaleVariantApiRequestSchema = z.strictObject({
  entryId: CmsUuidSchema,
  locale: CmsLocaleSchema,
  headers: LocaleVariantHeadersSchema,
  body: LocaleVariantRequestSchema,
});

/** Browser-safe variant status without owner or cross-locale source text. */
export const LocaleVariantResourceSchema = z.strictObject({
  ...resourceMetaShape,
  state: z.enum(['untranslated', 'draft', 'review', 'approved', 'stale']),
  entryId: CmsUuidSchema,
  revisionId: CmsUuidSchema,
  locale: CmsLocaleSchema,
  sourceRevisionId: CmsUuidSchema,
  fallbackChain: orderedFallbackChain,
  noFallbackFieldIds,
});

export type LocaleVariantPath = z.infer<typeof LocaleVariantPathSchema>;
export type LocaleVariantRequest = z.infer<typeof LocaleVariantRequestSchema>;
export type LocaleVariantHeaders = z.infer<typeof LocaleVariantHeadersSchema>;
export type LocaleVariantResource = z.infer<typeof LocaleVariantResourceSchema>;

/** Machine reason on 409 LOCALE_VERSION_CONFLICT when the chain differs. */
export const LOCALE_FALLBACK_CHAIN_MISMATCH = 'FALLBACK_CHAIN_MISMATCH';

/**
 * CMS-03C-04 treats `fallbackChain` as an equality expectation against the
 * active content-type version's chain for the target locale (BE03a OD-4). A
 * difference in membership, order or length is a 409 that returns the active
 * chain (at most 16 canonical tags) and writes nothing.
 */
export const LocaleFallbackChainMismatchDetailsSchema = z.strictObject({
  reasonCode: z.literal(LOCALE_FALLBACK_CHAIN_MISMATCH),
  activeFallbackChain: z.array(CmsCanonicalLocaleSchema).max(16).readonly(),
});

export type LocaleFallbackChainMismatchDetails = z.infer<
  typeof LocaleFallbackChainMismatchDetailsSchema
>;
