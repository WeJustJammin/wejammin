import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  AuthoringContextResourceSchema,
  LocaleVariantReadSchema,
} from '@wejammin/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  ENTRY_ID,
  apiError,
  draftDetail,
} from '../../../../../../components/cms-editorial/cms-editorial-editor-fixtures.test-support';
import {
  CONTENT_TYPE_VERSION_ID,
  authoringField,
  selectedType,
} from '../../../../../../components/cms-editorial-fields/cms-field-fixtures.test-support';
import CmsLocaleVariantForm from '../../../../../../components/cms-locale/CmsLocaleVariantForm';
import { loadLocaleVariantPage } from '../../../../../../components/cms-locale/load-locale-variant-page';
import { createLocalePageReads } from '../../../../../../components/cms-locale/locale-variant-page-reads';

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));
const LOCALE = 'fr-CA';
const PATH = `/app/cms-content-modeling/entries/${ENTRY_ID}/locales/${LOCALE}`;
const CONTEXT_PATH = '/api/v1/cms/entries/authoring-context';
const READ_PATH = `/api/v1/cms/entries/${ENTRY_ID}/locales/${LOCALE}`;

/** The strong representation ETag the Worker binds to an authoring-context body (BE03b CMS-03B-14). */
const representationEtag = async (resource: unknown): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(resource)),
  );
  return `"sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}"`;
};
const contextResponse = async (): Promise<Response> => {
  const resource = AuthoringContextResourceSchema.parse({
    creatableTypes: [selectedType()],
    selectedType: {
      ...selectedType(),
      supportedLocales: ['en-US', 'fr', 'fr-CA'],
    },
    fields: [
      {
        ...authoringField({
          n: 1,
          key: 'title',
          kind: 'short_text',
          label: 'Title',
        }),
        localizationMode: 'localized',
      },
      {
        ...authoringField({
          n: 2,
          key: 'legal_notice',
          kind: 'long_text',
          label: 'Legal notice',
        }),
        localizationMode: 'no_fallback',
      },
    ],
  });
  return Response.json(resource, {
    headers: { etag: await representationEtag(resource) },
  });
};
const TITLE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf10001';
const LEGAL_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf10002';
const resolution = (fieldId: string, patch: Record<string, unknown> = {}) => ({
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
/** The strict read: a translated title, a missing no_fallback legal notice, the author-safe order. */
const readResponse = (): Response =>
  Response.json(
    LocaleVariantReadSchema.parse({
      locale: LOCALE,
      activeFallbackChain: ['fr', 'en-US'],
      variant: {
        id: '018f0c45-73fe-7dc2-9c09-68f7ecf1a001',
        version: '2',
        contentHash: 'a'.repeat(64),
        createdAt: '2026-10-22T12:00:00Z',
        updatedAt: '2026-10-22T12:00:00Z',
        state: 'draft',
        entryId: ENTRY_ID,
        revisionId: '018f0c45-73fe-7dc2-9c09-68f7ecf1a002',
        locale: LOCALE,
        sourceRevisionId: '018f0c45-73fe-7dc2-9c09-68f7ecf1a003',
        fallbackChain: ['fr', 'en-US'],
        noFallbackFieldIds: [LEGAL_ID],
        staleFieldIds: [],
      },
      fields: [{ fieldId: TITLE_ID, value: 'Tournée de printemps' }],
      resolutions: [
        resolution(TITLE_ID),
        resolution(LEGAL_ID, {
          mode: 'no_fallback',
          outcome: 'missing',
          provenance: 'missing',
          blocking: true,
          reasonCode: 'no_fallback_missing',
        }),
      ],
    }),
  );

const bindingFor = (answers: {
  readonly draft?: () => Response;
  readonly context?: () => Promise<Response> | Response;
  readonly read?: () => Response;
}) => ({
  fetch: vi.fn(async (input: RequestInfo | URL) => {
    const { pathname } = new URL(
      input instanceof Request ? input.url : String(input),
    );
    if (pathname === CONTEXT_PATH)
      return (answers.context ?? contextResponse)();
    if (pathname === READ_PATH) return (answers.read ?? readResponse)();
    return (
      answers.draft ??
      (() =>
        draftDetail({ entryVersion: '4', revisionNumber: '2', values: {} }))
    )();
  }),
});

const load = (
  binding: ReturnType<typeof bindingFor>,
  options: {
    search?: string;
    entryId?: string;
    locale?: string;
    cookie?: string;
  } = {},
) =>
  loadLocaleVariantPage({
    request: new Request(`https://web.test${PATH}${options.search ?? ''}`, {
      headers: { cookie: options.cookie ?? 'wj_access=a; wj_csrf=csrf-token' },
    }),
    entryId: options.entryId ?? ENTRY_ID,
    locale: options.locale ?? LOCALE,
    reads: createLocalePageReads(binding),
  });

/*
 * The page is a tested loader plus a tested island. This suite drives the REAL composition, including the real
 * same-origin read proxies, with only the platform-API binding replaced, for the journeys of FE03 :1073 and
 * AC-270: an assigned author, a concealed entry, an expired session and a visible entry without access. Then
 * it reads the Astro file for the response invariants no other test can.
 */
describe('CMS-03C-04 protected locale variant page, composed', () => {
  it('serves the translation form with the read-only order, the localizable fields and the version', async () => {
    const outcome = await load(bindingFor({}));
    expect(outcome.kind).toBe('view');
    if (outcome.kind !== 'view') return;
    const html = renderToStaticMarkup(
      <CmsLocaleVariantForm
        entry={outcome.view.entry}
        fallbackChain={outcome.view.fallbackChain}
        fields={outcome.view.fields}
        unavailableFields={outcome.view.unavailableFields}
        resolutions={outcome.view.resolutions}
        variant={outcome.view.variant}
        csrfToken={outcome.view.csrfToken}
        returnTo={outcome.view.path}
      />,
    );
    expect(html).toContain('fr-CA: fr → en-US');
    expect(html).toContain('Draft');
    expect(html).toContain('Tournée de printemps');
    expect(html).toContain('Translated in this language.');
    expect(html).toContain('Missing. This field never uses another language');
    expect(html).toContain('Title');
    expect(html).toContain('Legal notice');
    expect(html).toContain('Save translation');
    expect(html).not.toContain('csrf-token');
    expect(outcome.title).toBe('Translate');
  });

  it('reads the draft, the definitions and the locale variant exactly once each, with the session and no URL state', async () => {
    const binding = bindingFor({});
    await load(binding);
    expect(binding.fetch).toHaveBeenCalledTimes(3);
    const urls = binding.fetch.mock.calls.map(
      ([input]) => new URL((input as Request).url),
    );
    expect(urls.map((url) => `${url.pathname}${url.search}`).sort()).toEqual(
      [
        `/api/v1/cms/entries/${ENTRY_ID}`,
        `${CONTEXT_PATH}?contentTypeVersionId=${CONTENT_TYPE_VERSION_ID}`,
        READ_PATH,
      ].sort(),
    );
    for (const [input] of binding.fetch.mock.calls)
      expect((input as Request).headers.get('cookie')).toContain('wj_access=a');
  });

  it('answers a concealed or absent entry with one closed 404 and no form', async () => {
    const outcome = await load(
      bindingFor({ draft: () => apiError(404, 'NOT_FOUND') }),
    );
    expect(outcome.kind === 'notice' && outcome.notice).toMatchObject({
      status: 404,
      message: 'This entry is not available.',
    });
  });

  it('answers a visible entry the account cannot read with 403, and one it cannot translate with 403', async () => {
    const unreadable = await load(
      bindingFor({ draft: () => apiError(403, 'FORBIDDEN') }),
    );
    expect(unreadable.kind === 'notice' && unreadable.notice.status).toBe(403);
    const untranslatable = await load(
      bindingFor({ context: () => apiError(403, 'FORBIDDEN') }),
    );
    expect(
      untranslatable.kind === 'notice' && untranslatable.notice.message,
    ).toBe('This account cannot translate this entry.');
  });

  it('[P2-S12-AC-270] answers a visible entry the account cannot edit (the read’s 403) with the page-level 403 and no form', async () => {
    const outcome = await load(
      bindingFor({
        read: () =>
          apiError(403, 'LOCALE_FORBIDDEN', {
            reasonCode: 'capability_missing',
          }),
      }),
    );
    expect(outcome.kind === 'notice' && outcome.notice).toMatchObject({
      status: 403,
      message: 'This account cannot translate this entry.',
    });
  });

  it('answers a locale outside the active supportedLocales (the read’s 404) with the disclosure-safe 404', async () => {
    const outcome = await load(
      bindingFor({ read: () => apiError(404, 'LOCALE_SOURCE_NOT_FOUND') }),
    );
    expect(outcome.kind === 'notice' && outcome.notice).toMatchObject({
      status: 404,
      message: 'This language is not available for this entry.',
    });
  });

  it('returns an expired session to this page by the allowlisted sign-in redirect', async () => {
    const outcome = await load(
      bindingFor({ draft: () => apiError(401, 'UNAUTHENTICATED') }),
    );
    expect(outcome).toEqual({
      kind: 'redirect',
      location: `/auth/sign-in?returnTo=${encodeURIComponent(PATH)}`,
    });
  });

  it('answers malformed ids, a malformed tag and any URL state with 400 and no read', async () => {
    for (const options of [
      { entryId: 'nope' },
      { locale: 'fr_CA' },
      { search: '?fallback=de' },
    ]) {
      const binding = bindingFor({});
      const outcome = await load(binding, options);
      expect(outcome.kind === 'notice' && outcome.notice.status).toBe(400);
      expect(binding.fetch).not.toHaveBeenCalled();
    }
  });
});

describe('entries/[entryId]/locales/[locale].astro response invariants', () => {
  const source = readFileSync(fromHere('./[locale].astro'), 'utf8');

  it('is never prerendered or cached, uses the one shared shell and bundles no script of its own', () => {
    expect(source).toContain('export const prerender = false');
    expect(source).toContain(
      "Astro.response.headers.set('Cache-Control', 'no-store')",
    );
    expect(source).toContain('<CmsEditorialDocument');
    expect(source).not.toContain('<script');
    expect(source).not.toContain('set:html');
    // The only hand-built Response is the 405 of a non-GET method.
    expect(source.match(/new Response\(/gu)).toHaveLength(1);
    expect(source).toContain("'Method not allowed'");
    expect(source).toContain("Astro.request.method !== 'GET'");
    expect(source).toContain("allow: 'GET'");
  });

  it('hydrates exactly one island from the loader’s verified view and puts no id in the markup', () => {
    expect(source.match(/client:load/gu)).toHaveLength(1);
    expect(source).toContain('<CmsLocaleVariantForm');
    expect(source).toContain('outcome.view.fallbackChain');
    expect(source).toContain('Astro.params.locale');
    expect(source).not.toContain('data-entry-id');
  });

  it('maps a sign-in outcome to the allowlisted 303 only', () => {
    expect(source).toContain('cmsRedirectResponse(outcome.location)');
    expect(source).not.toContain('cmsRedirectResponse(`');
  });

  it('describes the page as the spec does (FE03 :1641)', () => {
    expect(source).toContain(
      'description="Translate the localizable fields and see how each one resolves."',
    );
  });
});
