import {
  AuthoringContextResourceSchema,
  LocaleVariantReadSchema,
} from '@wejammin/contracts';
import { expect, vi } from 'vitest';

import {
  ENTRY_ID,
  TITLE,
  draftDetail,
} from '../cms-editorial/cms-editorial-editor-fixtures.test-support';
import {
  authoringField,
  selectedType,
} from '../cms-editorial-fields/cms-field-fixtures.test-support';
import { loadLocaleVariantPage } from './load-locale-variant-page';
import type { LocalePageReads } from './locale-variant-page-reads';
import {
  HASH,
  LOCALE,
  PAGE_PATH,
  SOURCE_REVISION_ID,
} from './locale-variant.test-support';

export const LEGAL = '018f0c45-73fe-7dc2-9c09-68f7ecf10002';
export const RATING = '018f0c45-73fe-7dc2-9c09-68f7ecf10004';
export const BLURB = '018f0c45-73fe-7dc2-9c09-68f7ecf10003';
export const BODY = '018f0c45-73fe-7dc2-9c09-68f7ecf10005';
export const VARIANT_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf1a001';
export const VARIANT_REVISION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf1a002';

export const localized = (
  n: number,
  key: string,
  kind: Parameters<typeof authoringField>[0]['kind'],
  mode: 'localized' | 'no_fallback' | 'none',
  label: string,
) => ({ ...authoringField({ n, key, kind, label }), localizationMode: mode });

export const fields = () => [
  localized(1, 'title', 'short_text', 'localized', 'Title'),
  localized(2, 'legal_notice', 'long_text', 'no_fallback', 'Legal notice'),
  localized(3, 'blurb', 'short_text', 'localized', 'Blurb'),
  localized(4, 'rating', 'integer', 'localized', 'Rating'),
  localized(5, 'body', 'rich_text', 'localized', 'Body'),
  localized(6, 'internal_code', 'short_text', 'none', 'Internal code'),
];

export const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
export const contextResponse = (
  list: readonly unknown[] = fields(),
  type: Record<string, unknown> = {},
) =>
  json(
    200,
    AuthoringContextResourceSchema.parse({
      creatableTypes: [selectedType()],
      selectedType: {
        ...selectedType(),
        supportedLocales: ['en-US', 'fr', 'fr-CA'],
        ...type,
      },
      fields: list,
    }),
  );
export const resolution = (
  fieldId: string,
  patch: Record<string, unknown> = {},
) => ({
  fieldId,
  locale: LOCALE,
  mode: 'localized',
  outcome: 'resolved',
  provenance: 'authored',
  resolvedFromLocale: null,
  stale: false,
  blocking: false,
  reasonCode: null,
  ...patch,
});
export const variantResource = (patch: Record<string, unknown> = {}) => ({
  id: VARIANT_ID,
  version: '2',
  contentHash: HASH,
  createdAt: '2026-10-22T12:00:00Z',
  updatedAt: '2026-10-22T12:00:00Z',
  state: 'draft',
  entryId: ENTRY_ID,
  revisionId: VARIANT_REVISION_ID,
  locale: LOCALE,
  sourceRevisionId: SOURCE_REVISION_ID,
  fallbackChain: ['fr', 'en-US'],
  noFallbackFieldIds: [LEGAL],
  staleFieldIds: [],
  ...patch,
});
/** The strict cmsLocaleVariantRead answer of fr-CA: a translated title, a missing no_fallback legal notice. */
export const readBody = (patch: Record<string, unknown> = {}) =>
  LocaleVariantReadSchema.parse({
    locale: LOCALE,
    activeFallbackChain: ['fr', 'en-US'],
    variant: variantResource(),
    fields: [{ fieldId: TITLE, value: 'Tournée de printemps' }],
    resolutions: [
      resolution(TITLE),
      resolution(LEGAL, {
        mode: 'no_fallback',
        outcome: 'missing',
        provenance: 'missing',
        blocking: true,
        reasonCode: 'no_fallback_missing',
      }),
      resolution(BLURB, {
        provenance: 'localized_fallback',
        resolvedFromLocale: 'en-US',
      }),
      resolution(RATING, { outcome: 'missing', provenance: 'missing' }),
    ],
    ...patch,
  });
export const readResponse = (patch: Record<string, unknown> = {}) =>
  json(200, readBody(patch));
export const draft = (values: Record<string, never | string | number> = {}) =>
  draftDetail({
    entryVersion: '4',
    revisionNumber: '2',
    values: {
      [TITLE]: 'Spring tour',
      [LEGAL]: 'All rights reserved',
      [RATING]: 7,
      ...values,
    } as never,
  });

export const makeReads = (parts: Partial<LocalePageReads> = {}) => {
  const reads = {
    draftDetail: vi.fn(async () => draft()),
    authoringContext: vi.fn(async () => contextResponse()),
    localeVariant: vi.fn(async () => readResponse()),
    ...parts,
  };
  return reads as unknown as LocalePageReads & typeof reads;
};

export const load = (
  reads: LocalePageReads,
  options: { entryId?: string; locale?: string; search?: string } = {},
) =>
  loadLocaleVariantPage({
    request: new Request(
      `https://web.test${PAGE_PATH}${options.search ?? ''}`,
      {
        headers: { cookie: 'wj_access=a; wj_csrf=csrf-token' },
      },
    ),
    entryId: options.entryId ?? ENTRY_ID,
    locale: options.locale ?? LOCALE,
    reads,
  });

export const notice = (outcome: Awaited<ReturnType<typeof load>>) => {
  expect(outcome.kind).toBe('notice');
  if (outcome.kind !== 'notice') throw new Error('expected a notice');
  return outcome.notice;
};
