import { describe, expect, it } from 'vitest';

import {
  readEntryFacts,
  readSelectorPage,
  readUpdateDiff,
} from './composition-reads';
import {
  CONTENT_TYPE_ID,
  ENTRY_ID,
  REVISION_ID,
  diffOf,
  id,
  propsPath,
  selectorPage,
} from './composition.test-support';

/*
 * The island's three protected reads: the selector's next page (CMS-03C-13, the cursor lives in component state only),
 * the diff of one instance (CMS-03C-14, never cached: every open is a fresh GET) and the entry facts (CMS-03B-11) that
 * refresh the `If-Match` operand.
 */
const ok = (body: unknown, etag?: string) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...(etag ? { etag } : {}) },
  });
const failure = (
  status: number,
  code: string,
  details: Record<string, unknown> = {},
) =>
  new Response(
    JSON.stringify({
      code,
      message: `${code}: composition operation rejected or unavailable.`,
      requestId: 'r',
      details,
    }),
    { status },
  );
const as = (fn: unknown) => fn as typeof fetch;
/** A fetcher that answers with `respond()` and records the URL and init of every call. */
const recorder = (respond: () => Response) => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetcher = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return respond();
  };
  return Object.assign(fetcher, { calls });
};

describe('readSelectorPage', () => {
  it('asks for the content type and the cursor with the default page size and returns the verified page', async () => {
    const fetcher = recorder(() => ok(selectorPage(undefined, 'c2'), '"7"'));
    const answer = await readSelectorPage(CONTENT_TYPE_ID, 'c1', {
      fetcher: as(fetcher),
    });
    expect(answer).toEqual({
      kind: 'page',
      page: selectorPage(undefined, 'c2'),
    });
    expect(fetcher.calls[0]?.url).toBe(
      `/api/v1/cms/patterns/selector?contentTypeId=${CONTENT_TYPE_ID}&cursor=c1&limit=25`,
    );
  });

  it('leaves the cursor out of the first page and encodes it otherwise', async () => {
    const fetcher = recorder(() => ok(selectorPage(), '"7"'));
    await readSelectorPage(CONTENT_TYPE_ID, null, { fetcher: as(fetcher) });
    expect(fetcher.calls[0]?.url).toBe(
      `/api/v1/cms/patterns/selector?contentTypeId=${CONTENT_TYPE_ID}&limit=25`,
    );
    await readSelectorPage(CONTENT_TYPE_ID, 'a b/c=', { fetcher: as(fetcher) });
    expect(fetcher.calls[1]?.url).toContain('cursor=a%20b%2Fc%3D');
  });

  it('rejects a body that is not a selector page, so the list never shows a guess', async () => {
    const answer = await readSelectorPage(CONTENT_TYPE_ID, null, {
      fetcher: as(async () => ok({ items: 'x' })),
    });
    expect(answer).toEqual({ kind: 'failed', status: 200, reason: null });
  });

  it('reports a refusal and a wait', async () => {
    expect(
      await readSelectorPage(CONTENT_TYPE_ID, null, {
        fetcher: as(async () =>
          failure(403, 'COMPOSITION_FORBIDDEN', {
            reasonCode: 'capability_missing',
          }),
        ),
      }),
    ).toEqual({ kind: 'failed', status: 403, reason: 'capability_missing' });
  });
});

describe('readUpdateDiff', () => {
  const diff = diffOf(1, [propsPath()]);

  it('reads the diff of exactly this instance, uncached', async () => {
    const fetcher = recorder(() => ok(diff, '"3"'));
    const answer = await readUpdateDiff(id(1), { fetcher: as(fetcher) });
    expect(answer).toEqual({ kind: 'diff', diff });
    expect(fetcher.calls[0]?.url).toBe(
      `/api/v1/cms/compositions/instances/${id(1)}/update-diff`,
    );
    expect(fetcher.calls[0]?.init).toMatchObject({ cache: 'no-store' });
  });

  it('refuses the diff of another instance or a malformed diff', async () => {
    expect(
      await readUpdateDiff(id(2), { fetcher: as(async () => ok(diff, '"3"')) }),
    ).toEqual({
      kind: 'failed',
      status: 200,
      reason: null,
    });
    const broken = { ...diff, paths: 'x' };
    expect(
      await readUpdateDiff(id(1), {
        fetcher: as(async () => ok(broken, '"3"')),
      }),
    ).toMatchObject({
      kind: 'failed',
    });
  });

  it('keeps the typed diff_too_large refusal for the page to name', async () => {
    const answer = await readUpdateDiff(id(1), {
      fetcher: as(async () =>
        failure(422, 'COMPOSITION_VALIDATION_FAILED', {
          reasonCode: 'diff_too_large',
        }),
      ),
    });
    expect(answer).toEqual({
      kind: 'failed',
      status: 422,
      reason: 'diff_too_large',
    });
  });

  it('reports a rate-limit wait', async () => {
    const limited = new Response(
      JSON.stringify({
        code: 'RATE_LIMITED',
        message: 'm',
        requestId: 'r',
        details: { retryAfterSeconds: 4 },
      }),
      { status: 429, headers: { 'retry-after': '4' } },
    );
    expect(
      await readUpdateDiff(id(1), { fetcher: as(async () => limited) }),
    ).toEqual({
      kind: 'rate_limited',
      retryAfterSeconds: 4,
    });
  });
});

describe('readEntryFacts: the refetched If-Match operand', () => {
  const detail = {
    entry: { id: ENTRY_ID, version: '12', createdAt: 'x', updatedAt: 'x' },
    revision: { id: REVISION_ID, version: '2', createdAt: 'x', updatedAt: 'x' },
    revisionNumber: '2',
    lifecycle: 'active',
    state: 'draft',
  };

  it('returns the entry version, the draft revision and whether it is the editable draft', async () => {
    const fetcher = recorder(() => ok(detail, '"x"'));
    const answer = await readEntryFacts(ENTRY_ID, { fetcher: as(fetcher) });
    expect(answer).toEqual({
      kind: 'facts',
      version: '12',
      revisionId: REVISION_ID,
      editable: true,
    });
    expect(fetcher.calls[0]?.url).toBe(`/api/v1/cms/entries/${ENTRY_ID}`);
  });

  it('is not editable once the revision left draft or the entry is not active', async () => {
    for (const patch of [{ state: 'submitted' }, { lifecycle: 'held' }]) {
      const answer = await readEntryFacts(ENTRY_ID, {
        fetcher: as(async () => ok({ ...detail, ...patch })),
      });
      expect(answer).toMatchObject({ kind: 'facts', editable: false });
    }
  });

  it('refuses the detail of another entry and a malformed version', async () => {
    const other = { ...detail, entry: { ...detail.entry, id: id(9) } };
    expect(
      await readEntryFacts(ENTRY_ID, { fetcher: as(async () => ok(other)) }),
    ).toMatchObject({ kind: 'failed' });
    const bad = { ...detail, entry: { ...detail.entry, version: '0' } };
    expect(
      await readEntryFacts(ENTRY_ID, { fetcher: as(async () => ok(bad)) }),
    ).toMatchObject({ kind: 'failed' });
  });
});
