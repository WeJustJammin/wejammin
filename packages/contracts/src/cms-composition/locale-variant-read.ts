import { z } from 'zod';

import { JsonValueSchema } from '../api-error.ts';
import {
  CmsLocaleSchema,
  CmsUuidSchema,
} from '../content-schema-registry/primitives.ts';
import { LocaleFieldResolutionSchema } from './locale-resolution.ts';
import { LocaleVariantResourceSchema } from './locale-variant.ts';

/**
 * `cmsLocaleVariantRead` addressing (DEC-205, BE03c "Route field validation"):
 * the entry and the target locale by path only. Strict: no query key,
 * header-derived or body member, so every caller context stays server-side.
 */
export const LocaleVariantReadApiRequestSchema = z.strictObject({
  entryId: CmsUuidSchema,
  locale: CmsLocaleSchema,
});

const lower = (value: string): string => value.toLowerCase();
const hasDuplicate = (ids: readonly string[]): boolean =>
  new Set(ids.map(lower)).size !== ids.length;

/**
 * `cmsLocaleVariantRead` answer (DEC-205): the entry's current variant for
 * `locale` (null when none exists, shown as `untranslated`), that variant's own
 * stored localizable values, the CMS-03C-20 resolution of every localizable
 * field of the active schema version and the active fallback order. The values
 * are the target locale's own: a `no_fallback` field never carries another
 * locale's text, and a resolution carries identifiers, enums and booleans only.
 */
export const LocaleVariantReadSchema = z
  .strictObject({
    locale: CmsLocaleSchema,
    activeFallbackChain: z.array(CmsLocaleSchema).max(16),
    variant: LocaleVariantResourceSchema.nullable(),
    fields: z
      .array(
        z.strictObject({
          fieldId: CmsUuidSchema,
          value: JsonValueSchema,
        }),
      )
      .max(128),
    resolutions: z.array(LocaleFieldResolutionSchema).max(128),
  })
  .superRefine((value, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({ code: 'custom', path: [path], message });
    if (hasDuplicate(value.fields.map(({ fieldId }) => fieldId)))
      issue('fields', 'a stored field appears once');
    if (hasDuplicate(value.resolutions.map(({ fieldId }) => fieldId)))
      issue('resolutions', 'a field resolves once');
    if (
      value.resolutions.some(
        ({ locale }) => lower(locale) !== lower(value.locale),
      )
    )
      issue('resolutions', 'every resolution is for the locale read');
    if (value.variant === null && value.fields.length > 0)
      issue('fields', 'no variant holds no stored value');
    if (
      value.variant !== null &&
      lower(value.variant.locale) !== lower(value.locale)
    )
      issue('variant', 'the variant is the one of the locale read');
  });

export type LocaleVariantReadApiRequest = z.infer<
  typeof LocaleVariantReadApiRequestSchema
>;
export type LocaleVariantRead = z.infer<typeof LocaleVariantReadSchema>;

/**
 * DEC-205: whether a parsed `cmsLocaleVariantRead` answer is the variant read of THIS entry and locale. A variant must
 * name the entry and must not claim the derived `untranslated` state, which is the `null` variant. Ids and tags compare
 * case-insensitively. The Worker, the first-party proxy and the page loader all verify an answer through this one rule.
 */
export const localeVariantReadAnswers = (
  read: LocaleVariantRead,
  entryId: string,
  locale: string,
): boolean =>
  lower(read.locale) === lower(locale) &&
  (read.variant === null ||
    (lower(read.variant.entryId) === lower(entryId) &&
      read.variant.state !== 'untranslated'));
