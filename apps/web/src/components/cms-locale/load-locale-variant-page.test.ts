import { describe, expect, it } from 'vitest';

import {
  REVISION_ID,
  apiError,
} from '../cms-editorial/cms-editorial-editor-fixtures.test-support';
import { CONTENT_TYPE_VERSION_ID } from '../cms-editorial-fields/cms-field-fixtures.test-support';
import {
  RATING,
  contextResponse,
  draft,
  fields,
  load,
  localized,
  makeReads,
  notice,
  readResponse,
} from './load-locale-variant-page.test-support';
import {
  ENTRY_ID,
  HASH,
  LOCALE,
  PAGE_PATH,
} from './locale-variant.test-support';

describe('loadLocaleVariantPage (FE03 :1073, :1641; AC-270; DEC-205)', () => {
  it('builds one verified view from the draft, the author-safe fields and the locale variant read', async () => {
    const reads = makeReads();
    const outcome = await load(reads);
    expect(outcome.kind).toBe('view');
    if (outcome.kind !== 'view') return;
    expect(outcome).toMatchObject({
      status: 200,
      title: 'Translate',
      heading: 'Translate',
      description:
        'Translate the localizable fields and see how each one resolves.',
    });
    const { view } = outcome;
    expect(view.entry).toEqual({
      entryId: ENTRY_ID,
      locale: LOCALE,
      sourceLocale: 'en-US',
      version: '4',
      sourceRevisionId: REVISION_ID,
      sourceHash: HASH,
    });
    // The author-safe order is the read's active order (no schema registry capability is needed).
    expect(view.fallbackChain).toEqual(['fr', 'en-US']);
    expect(view.csrfToken).toBe('csrf-token');
    expect(view.path).toBe(PAGE_PATH);
    expect(
      view.fields.map((f) => [f.descriptor.label, f.mode, f.sourceText]),
    ).toEqual([
      ['Title', 'localized', 'Spring tour'],
      ['Legal notice', 'no_fallback', null],
      ['Blurb', 'localized', null],
      ['Rating', 'localized', '7'],
    ]);
    expect(view.unavailableFields).toEqual(['Body']);
    expect(reads.draftDetail).toHaveBeenCalledTimes(1);
    expect(reads.authoringContext).toHaveBeenCalledWith(
      expect.any(Request),
      CONTENT_TYPE_VERSION_ID,
    );
    expect(reads.localeVariant).toHaveBeenCalledTimes(1);
    expect(reads.localeVariant).toHaveBeenCalledWith(
      expect.any(Request),
      ENTRY_ID,
      LOCALE,
    );
  });

  it('never carries the source text of a no_fallback field into the page data', async () => {
    const outcome = await load(makeReads());
    expect(JSON.stringify(outcome)).not.toContain('All rights reserved');
    expect(JSON.stringify(outcome)).toContain('Spring tour');
  });

  it('keeps zero or false source values as text and drops structured ones', async () => {
    const outcome = await load(
      makeReads({ draftDetail: async () => draft({ [RATING]: 0 }) as never }),
    );
    expect(
      outcome.kind === 'view' &&
        outcome.view.fields.find((f) => f.descriptor.fieldId === RATING)
          ?.sourceText,
    ).toBe('0');
  });

  it('answers a malformed id or tag, and any URL state, with 400 and no read', async () => {
    for (const options of [
      { entryId: 'nope' },
      { locale: 'fr_CA' },
      { search: '?locale=de' },
    ]) {
      const reads = makeReads();
      expect(notice(await load(reads, options)).status).toBe(400);
      expect(reads.draftDetail).not.toHaveBeenCalled();
      expect(reads.localeVariant).not.toHaveBeenCalled();
    }
  });

  it('answers a locale outside the active supportedLocales (the read’s 404) with the disclosure-safe 404 and no form', async () => {
    expect(
      notice(
        await load(
          makeReads({
            localeVariant: async () => apiError(404, 'LOCALE_SOURCE_NOT_FOUND'),
          }),
        ),
      ),
    ).toMatchObject({
      status: 404,
      message: 'This language is not available for this entry.',
    });
  });

  it('answers the source locale itself with the same 404, whatever the read answered', async () => {
    const reads = makeReads({
      localeVariant: async () =>
        readResponse({
          locale: 'en-US',
          activeFallbackChain: [],
          variant: null,
          fields: [],
          resolutions: [],
        }),
    });
    expect(notice(await load(reads, { locale: 'en-US' }))).toMatchObject({
      status: 404,
      message: 'This language is not available for this entry.',
    });
  });

  it('answers a draft head that is not a source-locale revision with the same 404', async () => {
    const reads = makeReads({
      authoringContext: async () =>
        contextResponse(fields(), { sourceLocale: 'fr' }),
    });
    expect(notice(await load(reads)).status).toBe(404);
  });

  it('returns an expired session to this page from any read by the allowlisted sign-in redirect', async () => {
    for (const read of ['draftDetail', 'authoringContext', 'localeVariant']) {
      const outcome = await load(
        makeReads({ [read]: async () => apiError(401, 'UNAUTHENTICATED') }),
      );
      expect(outcome).toEqual({
        kind: 'redirect',
        location: `/auth/sign-in?returnTo=${encodeURIComponent(PAGE_PATH)}`,
      });
    }
  });

  it('answers a concealed entry with 404 and an entry the account cannot read with 403, before any other read', async () => {
    for (const [status, code] of [
      [404, 'NOT_FOUND'],
      [403, 'FORBIDDEN'],
    ] as const) {
      const reads = makeReads({
        draftDetail: async () => apiError(status, code),
      });
      expect(notice(await load(reads)).status).toBe(status);
      expect(reads.authoringContext).not.toHaveBeenCalled();
      expect(reads.localeVariant).not.toHaveBeenCalled();
    }
  });

  it('answers an account that cannot translate the entry type with 403', async () => {
    const reads = makeReads({
      authoringContext: async () => apiError(403, 'FORBIDDEN'),
    });
    expect(notice(await load(reads))).toMatchObject({
      status: 403,
      message: 'This account cannot translate this entry.',
    });
    expect(reads.localeVariant).not.toHaveBeenCalled();
  });

  it('[P2-S12-AC-270] answers a visible entry without edit authority (the read’s 403) with the page-level 403, and no form', async () => {
    const outcome = await load(
      makeReads({
        localeVariant: async () =>
          apiError(403, 'LOCALE_FORBIDDEN', {
            reasonCode: 'capability_missing',
          }),
      }),
    );
    expect(notice(outcome)).toMatchObject({
      status: 403,
      title: 'Access denied',
      message: 'This account cannot translate this entry.',
    });
  });

  it('offers an empty field list, not a form, when the type has no translatable field', async () => {
    const reads = makeReads({
      authoringContext: async () =>
        contextResponse([
          localized(6, 'internal_code', 'short_text', 'none', 'Code'),
        ]),
    });
    const outcome = await load(reads);
    expect(outcome.kind === 'view' && outcome.view.fields).toEqual([]);
  });

  it('never reads the protected schema registry: an author without that capability can translate', async () => {
    const reads = makeReads();
    await load(reads);
    expect(Object.keys(reads).sort()).toEqual([
      'authoringContext',
      'draftDetail',
      'localeVariant',
    ]);
  });
});
