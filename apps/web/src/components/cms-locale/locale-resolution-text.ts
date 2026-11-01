import type { LocaleFieldMode, LocaleResolution } from './locale-variant-types';

/*
 * Fixed text for the per-field resolution (FE03 :891, :1122; BE03c 1526). Every sentence is a status in
 * words, never colour alone, and none carries locale text: a resolution is identifiers, enums and booleans
 * only (CMS-03C-20), and a `no_fallback` field is never worded as using another language.
 */

/** The standing rule of a field's localization mode. */
export const fieldRuleText = (mode: LocaleFieldMode): string =>
  mode === 'no_fallback'
    ? 'No fallback: this field is never shown in another language, and publishing this language needs it.'
    : 'Fallback allowed: untranslated, it follows the fallback order.';

const NO_FALLBACK_MISSING =
  'Missing. This field never uses another language, so publishing this language is blocked until you translate it.';
const NO_FALLBACK_STALE =
  'Out of date. This field never uses another language, so publishing this language is blocked until you revalidate it.';

/**
 * The status sentence of one field, or null when no resolution is known. `reportedStale` is the last
 * save's `staleFieldIds`, which marks a field even before a resolution read exists.
 */
export const resolutionText = (
  resolution: LocaleResolution | null,
  reportedStale: boolean,
): string | null => {
  if (resolution === null)
    return reportedStale
      ? 'The source changed since this was translated. Revalidate it.'
      : null;
  if (resolution.reasonCode === 'no_fallback_missing')
    return NO_FALLBACK_MISSING;
  if (resolution.reasonCode === 'no_fallback_stale') return NO_FALLBACK_STALE;
  if (resolution.provenance === 'localized_fallback')
    return `Not translated yet. Readers see the ${resolution.resolvedFromLocale ?? 'fallback'} version through the fallback order.`;
  if (resolution.provenance === 'missing')
    return 'Not translated yet, and no language in the fallback order has a value.';
  return resolution.stale || reportedStale
    ? 'Translated in this language, but the source changed since. It keeps showing the last translation until you revalidate it.'
    : 'Translated in this language.';
};
