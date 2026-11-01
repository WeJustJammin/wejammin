import type {
  LocaleFieldResolution,
  LocaleVariantRead,
} from '@wejammin/contracts';

import { REQUEST_ID } from '../cms-editorial-production.test-support';
import {
  deps as writeDeps,
  entryId,
  fieldId,
  origin,
  resource,
} from './locale-routes.test-support';
import type { CmsLocaleDependencies } from './locale-routes';

export { entryId, fieldId, origin, REQUEST_ID };

/** Shared fixtures of the cmsLocaleVariantRead route suites (`locale-read*.test.ts`), DEC-205. */
export const READ_PATH = `/api/v1/cms/entries/${entryId}/locales/fr-FR`;
export const noFallbackFieldId = 'd1000000-0000-4000-8000-000000000009';

export const resolution = (
  id: string,
  overrides: Partial<LocaleFieldResolution> = {},
): LocaleFieldResolution => ({
  fieldId: id,
  locale: 'fr-FR',
  mode: 'localized',
  outcome: 'resolved',
  provenance: 'authored',
  resolvedFromLocale: null,
  stale: false,
  blocking: false,
  reasonCode: null,
  ...overrides,
});

/** A translated entry: the draft variant of `fr-FR`, one stored value, one blocking no_fallback field. */
export const translatedRead = (
  overrides: Partial<LocaleVariantRead> = {},
): LocaleVariantRead => ({
  locale: 'fr-FR',
  activeFallbackChain: ['en-US'],
  variant: resource,
  fields: [{ fieldId, value: 'Titre traduit' }],
  resolutions: [
    resolution(fieldId),
    resolution(noFallbackFieldId, {
      mode: 'no_fallback',
      outcome: 'missing',
      provenance: 'missing',
      blocking: true,
      reasonCode: 'no_fallback_missing',
    }),
  ],
  ...overrides,
});

export const untranslatedRead = (): LocaleVariantRead => ({
  locale: 'fr-FR',
  activeFallbackChain: ['en-US'],
  variant: null,
  fields: [],
  resolutions: [
    resolution(fieldId, {
      outcome: 'resolved',
      provenance: 'localized_fallback',
      resolvedFromLocale: 'en-US',
    }),
  ],
});

/** A browser-origin GET of cmsLocaleVariantRead: no body, no media type, no write precondition. */
export const readRequest = (
  headers: Record<string, string> = {},
  path: string = READ_PATH,
  init: RequestInit = {},
) =>
  new Request(`https://api.example.test${path}`, {
    method: 'GET',
    headers: { origin, 'x-request-id': REQUEST_ID, ...headers },
    ...init,
  });

export const readDeps = (
  overrides: Partial<CmsLocaleDependencies> = {},
): CmsLocaleDependencies =>
  writeDeps({
    readLocaleVariant: async () => ({ ok: true, value: translatedRead() }),
    ...overrides,
  });
