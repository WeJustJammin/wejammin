import type { JsonValue } from '@wejammin/contracts';

import type { CmsEditorialFieldProvenance } from './cms-editorial-draft-values';

/** Plain words for the closed provenance vocabulary (never a colour alone). */
export const CMS_EDITORIAL_PROVENANCE_LABEL: Readonly<
  Record<CmsEditorialFieldProvenance, string>
> = {
  authored: 'Authored',
  default: 'Default value',
  inherited: 'Inherited',
  localized_fallback: 'Localized fallback',
  explicit_null: 'Explicitly empty',
  missing: 'Not set',
};

/**
 * Provenance of the fields a verified save just wrote. CMS-03B-01 records a
 * written value as `authored` and a written JSON null as `explicit_null`
 * (`cms_create_revision`: `case when value_input = 'null'::jsonb then
 * 'explicit_null' else 'authored' end`), so the browser states exactly what the
 * server now holds for those fields without a second read.
 */
export const savedProvenance = (
  current: Readonly<Record<string, CmsEditorialFieldProvenance>>,
  saved: Readonly<Record<string, JsonValue | null>>,
): Readonly<Record<string, CmsEditorialFieldProvenance>> => ({
  ...current,
  ...Object.fromEntries(
    Object.entries(saved).map(([fieldId, value]) => [
      fieldId,
      value === null ? 'explicit_null' : 'authored',
    ]),
  ),
});
