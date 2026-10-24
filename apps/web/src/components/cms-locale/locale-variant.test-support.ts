import type { CmsScalarDescriptor } from '../cms-editorial-fields/cms-field-descriptor';
import type {
  LocaleEntryFacts,
  LocaleFieldInit,
  LocaleResolution,
  LocaleVariantInit,
} from './locale-variant-types';

export const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
export const SOURCE_REVISION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132d1';
export const HASH = 'a'.repeat(64);
export const LOCALE = 'fr-CA';
export const PAGE_PATH = `/app/cms-content-modeling/entries/${ENTRY_ID}/locales/${LOCALE}`;
export const CHAIN = ['fr', 'en-US'] as const;
export const fieldUuid = (n: number): string =>
  `028f0c45-73fe-7dc2-9c09-${String(n).padStart(12, '0')}`;

export const TITLE = fieldUuid(1);
export const LEGAL = fieldUuid(2);
export const BLURB = fieldUuid(3);

const descriptor = (
  fieldId: string,
  key: string,
  label: string,
  kind: CmsScalarDescriptor['kind'],
  constraints: CmsScalarDescriptor['constraints'] = {},
): CmsScalarDescriptor => ({
  fieldId,
  key,
  label,
  helpText: undefined,
  required: false,
  order: 0,
  kind,
  constraints,
});

export const fieldInits = (): readonly LocaleFieldInit[] => [
  {
    descriptor: descriptor(TITLE, 'title', 'Title', 'short_text', {
      maxLength: 40,
    }),
    mode: 'localized',
    sourceText: 'Spring tour',
  },
  {
    descriptor: descriptor(LEGAL, 'legal_notice', 'Legal notice', 'long_text'),
    mode: 'no_fallback',
    sourceText: 'All rights reserved',
  },
  {
    descriptor: descriptor(BLURB, 'blurb', 'Blurb', 'short_text'),
    mode: 'localized',
    sourceText: null,
  },
];

export const entryFacts = (
  extra: Partial<LocaleEntryFacts> = {},
): LocaleEntryFacts => ({
  entryId: ENTRY_ID,
  locale: LOCALE,
  sourceLocale: 'en-US',
  version: '4',
  sourceRevisionId: SOURCE_REVISION_ID,
  sourceHash: HASH,
  ...extra,
});

export const resolution = (
  fieldId: string,
  extra: Partial<LocaleResolution> = {},
): LocaleResolution => ({
  fieldId,
  locale: LOCALE,
  mode: 'localized',
  outcome: 'resolved',
  provenance: 'authored',
  resolvedFromLocale: null,
  stale: false,
  blocking: false,
  reasonCode: null,
  ...extra,
});

/** The current variant of the language as `cmsLocaleVariantRead` states it (DEC-205); untranslated by default. */
export const variantInit = (
  extra: Partial<LocaleVariantInit> = {},
): LocaleVariantInit => ({
  state: 'untranslated',
  values: {},
  staleFieldIds: [],
  ...extra,
});
