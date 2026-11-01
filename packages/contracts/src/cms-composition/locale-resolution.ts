import { z } from 'zod';

import {
  CmsLocaleSchema,
  CmsUuidSchema,
} from '../content-schema-registry/primitives.ts';

/*
 * CMS-03C-20 `platform_private.cms_resolve_locale_field(entry, locale, field)`
 * (DEC-121, DEC-138): the single resolver used by the 03b `locale` preflight
 * provider, by Shard 04 delivery projection and by editorial reads. It is
 * read-only and deterministic and has no browser route; these schemas are for
 * the Worker and SQL tests.
 *
 * - `none`: the value is the source-locale value.
 * - `localized` (fallback permitted): the field in the target locale's own
 *   revision when present (a stale value is still served and flagged), else the
 *   first locale of the active version's `fallbackChains[locale]` that has a
 *   value (`localized_fallback`, with `resolvedFromLocale`), else `missing`. A
 *   stale `localized` field never blocks.
 * - `no_fallback`: the value comes only from the target locale's own revision,
 *   never through `fallbackChains`; a missing value is `no_fallback_missing` and
 *   a stale one `no_fallback_stale`, both `blocking`.
 */

/** The registered 03b preflight provider of the `locale` category (Slice 12). */
export const CMS_LOCALE_NO_FALLBACK_GATE = {
  providerKey: 'cms.locale.no_fallback_gate',
  providerVersion: '1',
  category: 'locale',
} as const;

/** The closed reasons the gate fails the `locale` category with. */
export const CMS_LOCALE_NO_FALLBACK_REASONS = [
  'no_fallback_missing',
  'no_fallback_stale',
  'locale_variant_not_approved',
] as const;

export const LocaleFieldResolutionRequestSchema = z.strictObject({
  entryId: CmsUuidSchema,
  locale: CmsLocaleSchema,
  fieldId: CmsUuidSchema,
});

export const LocaleFieldResolutionSchema = z
  .strictObject({
    fieldId: CmsUuidSchema,
    locale: CmsLocaleSchema,
    mode: z.enum(['none', 'localized', 'no_fallback']),
    outcome: z.enum(['resolved', 'missing']),
    provenance: z.enum(['authored', 'localized_fallback', 'missing']),
    resolvedFromLocale: CmsLocaleSchema.nullable(),
    stale: z.boolean(),
    blocking: z.boolean(),
    reasonCode: z.enum(['no_fallback_missing', 'no_fallback_stale']).nullable(),
  })
  .superRefine((value, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({ code: 'custom', path: [path], message });
    if (value.provenance === 'localized_fallback' && value.mode !== 'localized')
      issue(
        'provenance',
        'only a localized field resolves through the fallback chain',
      );
    if (
      value.provenance === 'localized_fallback' &&
      value.resolvedFromLocale === null
    )
      issue(
        'resolvedFromLocale',
        'a fallback resolution records its source locale',
      );
    if (value.provenance === 'missing' && value.resolvedFromLocale !== null)
      issue('resolvedFromLocale', 'a missing value has no source locale');
    if ((value.outcome === 'missing') !== (value.provenance === 'missing'))
      issue(
        'provenance',
        'provenance is missing exactly when the outcome is missing',
      );
    const expected =
      value.mode !== 'no_fallback'
        ? null
        : value.outcome === 'missing'
          ? 'no_fallback_missing'
          : value.stale
            ? 'no_fallback_stale'
            : null;
    if (value.reasonCode !== expected)
      issue(
        'reasonCode',
        'only a missing or stale no_fallback field carries a reason',
      );
    if (value.blocking !== (expected !== null))
      issue('blocking', 'only a missing or stale no_fallback field blocks');
  });

export type LocaleFieldResolution = z.infer<typeof LocaleFieldResolutionSchema>;
