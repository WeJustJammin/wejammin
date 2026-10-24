import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { AuthoringContextResourceSchema } from '@wejammin/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import CmsCompositionPage from '../../../../../components/cms-composition-instances/CmsCompositionPage';
import { createCompositionPageReads } from '../../../../../components/cms-composition-instances/composition-page-reads';
import { loadCompositionPage } from '../../../../../components/cms-composition-instances/load-composition-page';
import {
  row,
  selectorItem,
  selectorPage,
} from '../../../../../components/cms-composition-instances/composition.test-support';
import {
  CONTENT_TYPE_ID,
  selectedType,
} from '../../../../../components/cms-editorial-fields/cms-field-fixtures.test-support';
import {
  ENTRY_ID,
  REVISION_ID,
  apiError,
  draftDetail,
} from '../../../../../components/cms-editorial/cms-editorial-editor-fixtures.test-support';

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));
const PATH = `/app/cms-content-modeling/entries/${ENTRY_ID}/composition`;
const json = (body: unknown, etag?: string): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...(etag ? { etag } : {}) },
  });

/*
 * FE03 1072, 1640; P2-S12-AC-269. The page is a tested loader plus a tested island. This suite drives the REAL
 * composition, including the real same-origin read proxies, with only the platform-API binding replaced, for the
 * journeys of FE03 :1072: an assigned editor, a concealed entry, an expired session and a visible entry without
 * access. Then it reads the Astro file for the response invariants no other test can.
 */
/** The CMS-03B-14 answer with the representation ETag the proxy binds (a SHA-256 of the strict resource). */
const authoringContext = async (): Promise<Response> => {
  const resource = AuthoringContextResourceSchema.parse({
    creatableTypes: [selectedType()],
    selectedType: selectedType(),
    fields: [],
  });
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(resource)),
  );
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return json(resource, `"sha256:${hex}"`);
};

/** The instance list read (DEC-206) for the draft revision `draftDetail` answers, with one row. */
const instancesAnswer = (
  cursor: string | null,
  rows: readonly unknown[] = [row(1, { revisionId: REVISION_ID })],
): Response =>
  json({
    revisionId: REVISION_ID,
    items: cursor === null ? rows : [],
    nextCursor: null,
  });

const bindingFor = (answers: {
  readonly draft?: () => Response;
  readonly selector?: () => Response;
  readonly instances?: (cursor: string | null) => Response;
}) => ({
  fetch: vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === `/api/v1/cms/entries/${ENTRY_ID}/compositions`)
      return (answers.instances ?? instancesAnswer)(
        url.searchParams.get('cursor'),
      );
    if (url.pathname === '/api/v1/cms/patterns/selector')
      return (
        answers.selector ??
        (() => json(selectorPage([selectorItem('hero-block', 2)]), '"7"'))
      )();
    if (url.pathname === '/api/v1/cms/entries/authoring-context')
      return authoringContext();
    return (
      answers.draft ??
      (() =>
        draftDetail({ entryVersion: '4', revisionNumber: '2', values: {} }))
    )();
  }),
});
const load = (
  binding: ReturnType<typeof bindingFor>,
  options: { search?: string; entryId?: string } = {},
) =>
  loadCompositionPage({
    request: new Request(`https://web.test${PATH}${options.search ?? ''}`, {
      headers: { cookie: 'wj_access=a; wj_csrf=csrf-token' },
    }),
    entryId: options.entryId ?? ENTRY_ID,
    reads: createCompositionPageReads(binding),
  });

describe('protected composition page, composed', () => {
  it('serves the insert form with the real selector and the entry instances once the four reads are verified', async () => {
    const binding = bindingFor({});
    const outcome = await load(binding);
    expect(outcome.kind).toBe('view');
    if (outcome.kind !== 'view') return;
    const html = renderToStaticMarkup(
      <CmsCompositionPage
        entry={outcome.view.entry}
        selector={outcome.view.selector}
        instances={outcome.view.instances}
        csrfToken={outcome.view.csrfToken}
      />,
    );
    expect(html).toContain('Insert a pattern');
    expect(html).toContain('Composition instances');
    expect(html).toContain('1 row');
    expect(html).toContain('/main/row-1');
    expect(html).toContain('hero-block version 2 (3 nodes)');
    expect(html).toContain('1 compatible pattern');
    expect(html).toContain('Place pattern');
    expect(html).not.toContain('csrf-token');
    expect(outcome.view.entry.contentTypeId).toBe(CONTENT_TYPE_ID);
  });

  it('reads the entry, its instances, its content type and the selector exactly once each, with the session and no URL state', async () => {
    const binding = bindingFor({});
    await load(binding);
    const urls = binding.fetch.mock.calls.map(
      ([input]) => new URL((input as Request).url),
    );
    expect(urls.map((url) => url.pathname).sort()).toEqual(
      [
        `/api/v1/cms/entries/${ENTRY_ID}`,
        `/api/v1/cms/entries/${ENTRY_ID}/compositions`,
        '/api/v1/cms/entries/authoring-context',
        '/api/v1/cms/patterns/selector',
      ].sort(),
    );
    expect(urls.find((url) => url.pathname.endsWith('/selector'))?.search).toBe(
      `?contentTypeId=${CONTENT_TYPE_ID}&limit=25`,
    );
    for (const [input] of binding.fetch.mock.calls)
      expect((input as Request).headers.get('cookie')).toContain('wj_access=a');
  });

  it('refuses a visible entry the account cannot edit with the page-level 403 of the instance list read, before the content type or the selector is read', async () => {
    const binding = bindingFor({
      instances: () =>
        new Response(
          JSON.stringify({
            code: 'COMPOSITION_FORBIDDEN',
            message:
              'COMPOSITION_FORBIDDEN: composition operation rejected or unavailable.',
            requestId: '018f0c45-73fe-7dc2-9c09-68f7ecf132e9',
            details: { reasonCode: 'capability_missing' },
          }),
          { status: 403 },
        ),
    });
    const outcome = await load(binding);
    expect(outcome.kind === 'notice' && outcome.notice).toMatchObject({
      status: 403,
      message: 'This account cannot edit the composition of this entry.',
    });
    expect(
      binding.fetch.mock.calls.map(
        ([input]) => new URL((input as Request).url).pathname,
      ),
    ).toEqual([
      `/api/v1/cms/entries/${ENTRY_ID}`,
      `/api/v1/cms/entries/${ENTRY_ID}/compositions`,
    ]);
  });

  it('lists a long entry by following the cursor of every page through the real proxy', async () => {
    const full = (start: number) =>
      Array.from({ length: 50 }, (_, n) =>
        row(start + n, { revisionId: REVISION_ID }),
      );
    const binding = bindingFor({
      instances: (cursor) =>
        cursor === null
          ? json({ revisionId: REVISION_ID, items: full(0), nextCursor: 'c1' })
          : json({
              revisionId: REVISION_ID,
              items: [row(50, { revisionId: REVISION_ID })],
              nextCursor: null,
            }),
    });
    const outcome = await load(binding);
    expect(outcome.kind === 'view' && outcome.view.instances).toHaveLength(51);
    const listUrls = binding.fetch.mock.calls
      .map(([input]) => new URL((input as Request).url))
      .filter((url) => url.pathname.endsWith('/compositions'));
    expect(listUrls.map((url) => url.search)).toEqual([
      '?limit=50',
      '?cursor=c1&limit=50',
    ]);
  });

  it('refuses a visible entry the selector will not serve with the page-level 403 as well', async () => {
    const outcome = await load(
      bindingFor({
        selector: () =>
          new Response(
            JSON.stringify({
              code: 'COMPOSITION_FORBIDDEN',
              message:
                'COMPOSITION_FORBIDDEN: composition operation rejected or unavailable.',
              requestId: '018f0c45-73fe-7dc2-9c09-68f7ecf132e9',
              details: { reasonCode: 'capability_missing' },
            }),
            { status: 403 },
          ),
      }),
    );
    expect(outcome.kind === 'notice' && outcome.notice).toMatchObject({
      status: 403,
      message: 'This account cannot edit the composition of this entry.',
    });
  });

  it('answers a concealed or absent entry with one closed 404 and reads nothing more', async () => {
    const binding = bindingFor({ draft: () => apiError(404, 'NOT_FOUND') });
    const outcome = await load(binding);
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(404);
    expect(binding.fetch).toHaveBeenCalledTimes(1);
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

  it('answers malformed ids and any URL state with 400 and no read', async () => {
    for (const options of [{ entryId: 'nope' }, { search: '?instance=x' }]) {
      const binding = bindingFor({});
      const outcome = await load(binding, options);
      expect(outcome.kind === 'notice' && outcome.notice.status).toBe(400);
      expect(binding.fetch).not.toHaveBeenCalled();
    }
  });
});

describe('entries/[entryId]/composition.astro response invariants', () => {
  const source = readFileSync(fromHere('./composition.astro'), 'utf8');

  it('is never prerendered or cached, uses the one shared shell and bundles no script of its own', () => {
    expect(source).toContain('export const prerender = false');
    expect(source).toContain(
      "Astro.response.headers.set('Cache-Control', 'no-store')",
    );
    expect(source).toContain('<CmsEditorialDocument');
    expect(source).not.toContain('<script');
    expect(source).not.toContain('set:html');
    expect(source.match(/new Response\(/gu)).toHaveLength(1);
    expect(source).toContain("'Method not allowed'");
    expect(source).toContain("Astro.request.method !== 'GET'");
    expect(source).toContain("allow: 'GET'");
  });

  it('hydrates exactly one island from the loader view and puts no id in the markup', () => {
    expect(source.match(/client:load/gu)).toHaveLength(1);
    expect(source).toContain('<CmsCompositionPage');
    expect(source).toContain('outcome.view.selector');
    expect(source).not.toContain('data-entry-id');
  });

  it('maps a sign-in outcome to the allowlisted 303 only', () => {
    expect(source).toContain('Astro.redirect(outcome.location, 303)');
    expect(source).not.toContain('Astro.redirect(`');
  });

  it('describes the page as the spec does (FE03 :1640)', () => {
    expect(source).toContain(
      'description="Insert patterns and resolve pattern updates for the current draft."',
    );
  });
});

describe('the entry page reaches the composition page', () => {
  const source = readFileSync(fromHere('../[entryId].astro'), 'utf8');

  it('links to it from the draft editor, only for a valid entry id', () => {
    expect(source).toContain('compositionPagePath(Astro.params.entryId');
    expect(source).toContain('<a href={compositionPath}>Composition</a>');
    expect(source).toContain('compositionPath !== null');
  });
});
