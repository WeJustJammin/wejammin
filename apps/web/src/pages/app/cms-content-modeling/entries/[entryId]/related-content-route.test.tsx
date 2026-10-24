import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  ENTRY_ID,
  apiError,
  draftDetail,
} from '../../../../../components/cms-editorial/cms-editorial-editor-fixtures.test-support';
import CmsRelatedContentForm from '../../../../../components/cms-related-content/CmsRelatedContentForm';
import { loadRelatedContentPage } from '../../../../../components/cms-related-content/load-related-content-page';
import { createRelatedContentPageReads } from '../../../../../components/cms-related-content/related-content-page-reads';

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));
const PATH = `/app/cms-content-modeling/entries/${ENTRY_ID}/related-content`;
const id = (n: number): string =>
  `018f0c45-73fe-7dc2-9c09-${String(n).padStart(12, '0')}`;
const listItem = (n: number, lifecycle = 'active') => ({
  id: `028f0c45-73fe-7dc2-9c09-${String(n).padStart(12, '0')}`,
  revisionNumber: '2',
  locale: 'en-US',
  state: 'draft',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-10-15T10:00:00Z',
  authorClass: 'author',
  entryId: id(n),
  entryLifecycle: lifecycle,
  entryUpdatedAt: '2026-10-15T11:00:00Z',
});
const listResponse = (): Response =>
  new Response(
    JSON.stringify({
      items: [listItem(1), listItem(2, 'archived')],
      nextCursor: null,
      pageVersion: '7',
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json', etag: '"7"' },
    },
  );

/*
 * The page is a tested loader plus a tested island. This suite drives the REAL composition, including
 * the real same-origin read proxies, with only the platform-API binding replaced, for the journeys of
 * FE03 :1072: an assigned editor, a concealed entry, an expired session and a visible entry without
 * access. Then it reads the Astro file for the response invariants no other test can.
 */
const SAVED_RULE_PATH = `/api/v1/cms/entries/${ENTRY_ID}/related-content`;
/** The DEC-195 answer the same-origin proxy relays for an entry with no active rule. */
const noRuleResponse = (): Response =>
  Response.json({ rule: null }, { status: 200 });
const bindingFor = (answers: {
  readonly draft?: () => Response;
  readonly list?: () => Response;
  readonly savedRule?: () => Response;
}) => ({
  fetch: vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === '/api/v1/cms/entries')
      return (answers.list ?? listResponse)();
    if (url.pathname === SAVED_RULE_PATH)
      return (answers.savedRule ?? noRuleResponse)();
    return (
      answers.draft ??
      (() =>
        draftDetail({
          entryVersion: '4',
          revisionNumber: '2',
          values: {},
        }))
    )();
  }),
});

const load = (
  binding: ReturnType<typeof bindingFor>,
  options: { search?: string; entryId?: string; cookie?: string } = {},
) =>
  loadRelatedContentPage({
    request: new Request(`https://web.test${PATH}${options.search ?? ''}`, {
      headers: { cookie: options.cookie ?? 'wj_access=a; wj_csrf=csrf-token' },
    }),
    entryId: options.entryId ?? ENTRY_ID,
    reads: createRelatedContentPageReads(binding),
  });

describe('CMS-03C-05 protected related-content page, composed', () => {
  it('refuses a visible entry the account cannot edit with the page-level 403 and reads no candidates (DEC-195)', async () => {
    const binding = bindingFor({
      savedRule: () => apiError(403, 'RELATED_CONTENT_FORBIDDEN'),
    });
    const outcome = await load(binding);
    expect(outcome.kind).toBe('notice');
    if (outcome.kind !== 'notice') return;
    expect(outcome.notice).toMatchObject({
      status: 403,
      message: 'This account cannot edit related content for this entry.',
    });
    const paths = binding.fetch.mock.calls.map(
      ([input]) => new URL((input as Request).url).pathname,
    );
    expect(paths.sort()).toEqual(
      [`/api/v1/cms/entries/${ENTRY_ID}`, SAVED_RULE_PATH].sort(),
    );
  });

  it('serves the editing form once the composed read supplies the saved rule, with the picker and the version', async () => {
    const binding = bindingFor({});
    const outcome = await load(binding);
    expect(outcome.kind).toBe('view');
    if (outcome.kind !== 'view') return;
    const html = renderToStaticMarkup(
      <CmsRelatedContentForm
        entry={outcome.view.entry}
        rule={outcome.view.rule}
        candidates={outcome.view.candidates}
        returnTo={outcome.view.path}
        csrfToken={outcome.view.csrfToken}
      />,
    );
    expect(html).toContain('Pinned entries');
    expect(html).toContain('Excluded entries');
    expect(html).toContain('Exclusions win.');
    expect(html).not.toContain('Saving related content is unavailable');
    expect(html).toContain(`<code>${id(1)}</code>`);
    expect(html).toContain('Pin entry ' + id(1).slice(-12));
    // An archived entry is listed and excludable but not pinnable.
    expect(html).not.toContain('Pin entry ' + id(2).slice(-12));
    expect(html).toContain('Exclude entry ' + id(2).slice(-12));
    expect(html).toContain('Save related content');
    expect(html).not.toContain('csrf-token');
  });

  it('reads the entry, the stored rule and the list exactly once each, with the session and no URL state', async () => {
    const binding = bindingFor({});
    await load(binding);
    expect(binding.fetch).toHaveBeenCalledTimes(3);
    const urls = binding.fetch.mock.calls.map(
      ([input]) => new URL((input as Request).url),
    );
    expect(urls.map((url) => url.pathname).sort()).toEqual(
      [
        '/api/v1/cms/entries',
        `/api/v1/cms/entries/${ENTRY_ID}`,
        SAVED_RULE_PATH,
      ].sort(),
    );
    expect(
      urls.find((url) => url.pathname === '/api/v1/cms/entries')?.search,
    ).toBe('?limit=50');
    expect(urls.find((url) => url.pathname === SAVED_RULE_PATH)?.search).toBe(
      '',
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

  it('answers a visible entry the account cannot read with 403', async () => {
    const outcome = await load(
      bindingFor({ draft: () => apiError(403, 'FORBIDDEN') }),
    );
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(403);
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
    for (const options of [{ entryId: 'nope' }, { search: '?pins=x' }]) {
      const binding = bindingFor({});
      const outcome = await load(binding, options);
      expect(outcome.kind === 'notice' && outcome.notice.status).toBe(400);
      expect(binding.fetch).not.toHaveBeenCalled();
    }
  });
});

describe('entries/[entryId]/related-content.astro response invariants', () => {
  const source = readFileSync(fromHere('./related-content.astro'), 'utf8');

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

  it('hydrates exactly one island, from the loader’s verified view, and puts no id in the markup', () => {
    expect(source.match(/client:load/gu)).toHaveLength(1);
    expect(source).toContain('<CmsRelatedContentForm');
    expect(source).toContain('outcome.view.candidates');
    expect(source).not.toContain('data-entry-id');
  });

  it('maps a sign-in outcome to the allowlisted 303 only', () => {
    expect(source).toContain('Astro.redirect(outcome.location, 303)');
    expect(source).not.toContain('Astro.redirect(`');
  });

  it('describes the page as the spec does (FE03 :1601)', () => {
    expect(source).toContain(
      'description="Pin and exclude related entries and choose a derived rule."',
    );
  });
});

describe('the entry page reaches the related-content page', () => {
  const source = readFileSync(fromHere('../[entryId].astro'), 'utf8');

  it('links to it from the draft editor, only for a valid entry id', () => {
    expect(source).toContain('relatedContentPagePath(Astro.params.entryId');
    expect(source).toContain('<a href={relatedPath}>Related content</a>');
    expect(source).toContain('relatedPath !== null');
  });
});
