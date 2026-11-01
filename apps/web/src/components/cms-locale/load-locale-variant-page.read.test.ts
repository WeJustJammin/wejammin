import { describe, expect, it } from 'vitest';

import {
  TITLE,
  apiError,
} from '../cms-editorial/cms-editorial-editor-fixtures.test-support';
import {
  BLURB,
  BODY,
  LEGAL,
  RATING,
  json,
  load,
  makeReads,
  notice,
  readResponse,
  resolution,
  variantResource,
} from './load-locale-variant-page.test-support';
import { PAGE_PATH } from './locale-variant.test-support';
import type { LocalePageReads } from './locale-variant-page-reads';

describe('loadLocaleVariantPage: what cmsLocaleVariantRead carries into the view (DEC-205)', () => {
  it('[P2-S12-AC-058] carries the CMS-03C-20 resolution of every field the read returned, as identifiers only', async () => {
    const outcome = await load(makeReads());
    expect(outcome.kind).toBe('view');
    if (outcome.kind !== 'view') return;
    expect(
      outcome.view.resolutions.map((r) => [
        r.fieldId,
        r.provenance,
        r.reasonCode,
      ]),
    ).toEqual([
      [TITLE, 'authored', null],
      [LEGAL, 'missing', 'no_fallback_missing'],
      [BLURB, 'localized_fallback', null],
      [RATING, 'missing', null],
    ]);
    expect(Object.keys(outcome.view.resolutions[0] ?? {}).sort()).toEqual([
      'blocking',
      'fieldId',
      'locale',
      'mode',
      'outcome',
      'provenance',
      'reasonCode',
      'resolvedFromLocale',
      'stale',
    ]);
    expect(outcome.view.resolutions[2]?.resolvedFromLocale).toBe('en-US');
  });

  it('[P2-S12-AC-234] carries the derived variant state and the stored values of the writable fields', async () => {
    const outcome = await load(makeReads());
    expect(outcome.kind === 'view' && outcome.view.variant).toEqual({
      state: 'draft',
      values: { [TITLE]: 'Tournée de printemps' },
      staleFieldIds: [],
    });
  });

  it('[P2-S12-AC-234] shows untranslated for an explicit null variant, with nothing stored', async () => {
    const outcome = await load(
      makeReads({
        localeVariant: async () => readResponse({ variant: null, fields: [] }),
      }),
    );
    expect(outcome.kind === 'view' && outcome.view.variant).toEqual({
      state: 'untranslated',
      values: {},
      staleFieldIds: [],
    });
  });

  it('[P2-S12-AC-058] marks a stale variant with its stale field ids and keeps its stored translation', async () => {
    const outcome = await load(
      makeReads({
        localeVariant: async () =>
          readResponse({
            variant: variantResource({
              state: 'stale',
              staleFieldIds: [TITLE],
            }),
            resolutions: [resolution(TITLE, { stale: true })],
          }),
      }),
    );
    expect(outcome.kind === 'view' && outcome.view.variant).toEqual({
      state: 'stale',
      values: { [TITLE]: 'Tournée de printemps' },
      staleFieldIds: [TITLE],
    });
  });

  it('keeps an explicit null value as null and drops the stored value of a field the page cannot write', async () => {
    const outcome = await load(
      makeReads({
        localeVariant: async () =>
          readResponse({
            fields: [
              { fieldId: TITLE, value: null },
              { fieldId: BODY, value: { type: 'doc' } },
            ],
          }),
      }),
    );
    expect(outcome.kind === 'view' && outcome.view.variant.values).toEqual({
      [TITLE]: null,
    });
  });

  it('shows the read’s own order: an empty order for the default locale and the declared one otherwise', async () => {
    const empty = await load(
      makeReads({
        localeVariant: async () =>
          readResponse({ activeFallbackChain: [], variant: null, fields: [] }),
      }),
    );
    expect(empty.kind === 'view' && empty.view.fallbackChain).toEqual([]);
  });

  it('degrades a failing locale read to a closed notice with a retry link', async () => {
    for (const status of [503, 504, 429, 500] as const) {
      const outcome = await load(
        makeReads({
          localeVariant: async () => apiError(status, 'DEPENDENCY_UNAVAILABLE'),
        }),
      );
      expect(notice(outcome)).toMatchObject({ status, retryHref: PAGE_PATH });
    }
  });

  it.each([
    ['the draft', { draftDetail: async () => json(200, { entry: 1 }) }],
    ['the field definitions', { authoringContext: async () => json(200, {}) }],
    ['the locale variant read', { localeVariant: async () => json(200, {}) }],
    [
      'a read of another locale',
      {
        localeVariant: async () =>
          readResponse({
            locale: 'fr',
            activeFallbackChain: [],
            variant: null,
            fields: [],
            resolutions: [],
          }),
      },
    ],
    [
      'a read whose variant belongs to another entry',
      {
        localeVariant: async () =>
          readResponse({
            variant: variantResource({
              entryId: '018f0c45-73fe-7dc2-9c09-68f7ecf1ffff',
            }),
          }),
      },
    ],
    [
      'a read whose variant claims the untranslated state',
      {
        localeVariant: async () =>
          readResponse({ variant: variantResource({ state: 'untranslated' }) }),
      },
    ],
  ])('renders nothing from unverified %s', async (_n, parts) => {
    expect(
      notice(await load(makeReads(parts as Partial<LocalePageReads>))).status,
    ).toBe(502);
  });
});
