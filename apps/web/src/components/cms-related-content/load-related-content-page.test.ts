import { describe, expect, it, vi } from 'vitest';

import {
  ENTRY_ID,
  apiError,
  draftDetail,
} from '../cms-editorial/cms-editorial-editor-fixtures.test-support';
import { loadRelatedContentPage } from './load-related-content-page';
import { relatedContentPagePath } from './related-content-path';
import type { RelatedContentPageReads } from './related-content-page-reads';

const PATH = `/app/cms-content-modeling/entries/${ENTRY_ID}/related-content`;
const id = (n: number): string =>
  `018f0c45-73fe-7dc2-9c09-${String(n).padStart(12, '0')}`;
const item = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `028f0c45-73fe-7dc2-9c09-${String(n).padStart(12, '0')}`,
  revisionNumber: '2',
  locale: 'en-US',
  state: 'draft',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-10-15T10:00:00Z',
  authorClass: 'author',
  entryId: id(n),
  entryLifecycle: 'active',
  entryUpdatedAt: '2026-10-15T11:00:00Z',
  ...extra,
});
const list = (
  items: unknown[] = [item(1), item(2)],
  nextCursor: string | null = null,
) =>
  new Response(JSON.stringify({ items, nextCursor, pageVersion: '7' }), {
    status: 200,
    headers: { 'content-type': 'application/json', etag: '"7"' },
  });
const detail = () =>
  draftDetail({ entryVersion: '4', revisionNumber: '2', values: {} });
/** The `cmsRelatedContentRead` answer the same-origin proxy relays: the stored rule of ENTRY_ID, or null. */
const storedRule = (extra: Record<string, unknown> = {}) => ({
  id: ENTRY_ID,
  version: '4',
  contentHash: 'b'.repeat(64),
  createdAt: '2026-10-15T10:00:00Z',
  updatedAt: '2026-10-15T10:00:00Z',
  state: 'active',
  sourceEntryId: ENTRY_ID,
  pins: [id(2), id(1)],
  exclusions: [id(3)],
  derivedRule: { key: 'shared-terms', version: '1' },
  eligibleCount: 4,
  ...extra,
});
const ruleRead = (rule: unknown = null, status = 200) =>
  new Response(JSON.stringify({ rule }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const run = (
  parts: Partial<RelatedContentPageReads> = {},
  options: { path?: string; entryId?: string; cookie?: string } = {},
) => {
  const draftDetailRead = vi.fn(async () => detail());
  const entryList = vi.fn(async () => list());
  const savedRule = vi.fn<
    (
      request: Request,
      entryId: string,
    ) => Promise<Awaited<ReturnType<typeof ruleRead>>>
  >(async () => ruleRead());
  const reads = {
    draftDetail: draftDetailRead,
    entryList,
    savedRule,
    ...parts,
  } as unknown as RelatedContentPageReads;
  const outcome = loadRelatedContentPage({
    request: new Request(`https://web.test${options.path ?? PATH}`, {
      headers: { cookie: options.cookie ?? 'wj_access=a; wj_csrf=csrf-token' },
    }),
    entryId: options.entryId ?? ENTRY_ID,
    reads,
  });
  return { outcome, draftDetailRead, entryList, savedRule };
};

describe('loadRelatedContentPage: the view', () => {
  it('builds the form from the verified entry and the first page of readable entries', async () => {
    const { outcome, draftDetailRead, entryList } = run();
    const result = await outcome;
    expect(result.kind).toBe('view');
    if (result.kind !== 'view') return;
    expect(result).toMatchObject({
      status: 200,
      title: 'Related content',
      heading: 'Related content',
      description: 'Pin and exclude related entries and choose a derived rule.',
    });
    expect(result.view).toMatchObject({
      entry: {
        entryId: ENTRY_ID,
        version: '4',
        locale: 'en-US',
        lifecycle: 'active',
      },
      csrfToken: 'csrf-token',
      path: PATH,
    });
    expect(result.view.candidates.items.map((entry) => entry.entryId)).toEqual([
      id(1),
      id(2),
    ]);
    expect(draftDetailRead).toHaveBeenCalledTimes(1);
    expect(entryList).toHaveBeenCalledTimes(1);
  });

  it('never offers the entry itself as a candidate', async () => {
    const { outcome } = run({
      entryList: async () => list([item(1), item(2, { entryId: ENTRY_ID })]),
    });
    const result = await outcome;
    expect(
      result.kind === 'view' &&
        result.view.candidates.items.map((e) => e.entryId),
    ).toEqual([id(1)]);
  });

  it('carries the next cursor so the island can load more', async () => {
    const { outcome } = run({
      entryList: async () => list([item(1)], 'next-cursor'),
    });
    const result = await outcome;
    expect(result.kind === 'view' && result.view.candidates.nextCursor).toBe(
      'next-cursor',
    );
  });

  it('starts the form from the stored rule: pins in stored order, exclusions, the rule key and version', async () => {
    const result = await run({
      savedRule: async () => ruleRead(storedRule()),
    }).outcome;
    expect(result.kind === 'view' && result.view.rule).toEqual({
      pins: [id(2), id(1)],
      exclusions: [id(3)],
      // The read's resource carries no bound (BE03c RelatedContentResource), so the form must ask for it again.
      derivedRule: { key: 'shared-terms', version: '1', maxCandidates: null },
    });
  });

  it('starts the form from an empty rule when no rule is active', async () => {
    const result = await run({ savedRule: async () => ruleRead(null) }).outcome;
    expect(result.kind === 'view' && result.view.rule).toEqual({
      pins: [],
      exclusions: [],
      derivedRule: null,
    });
  });

  it('keeps ids the viewer cannot see in the candidate list exactly as stored', async () => {
    const stored = storedRule({
      pins: [id(9)],
      exclusions: [id(8)],
      derivedRule: null,
    });
    const result = await run({ savedRule: async () => ruleRead(stored) })
      .outcome;
    expect(result.kind === 'view' && result.view.rule).toMatchObject({
      pins: [id(9)],
      exclusions: [id(8)],
    });
  });

  it('reads the rule once, for this entry and with the page request, after the entry and before the list', async () => {
    const order: string[] = [];
    const savedRule = vi.fn<
      (
        request: Request,
        entryId: string,
      ) => Promise<Awaited<ReturnType<typeof ruleRead>>>
    >(async () => {
      order.push('rule');
      return ruleRead();
    });
    const { outcome } = run({
      draftDetail: async () => {
        order.push('draft');
        return detail();
      },
      savedRule,
      entryList: async () => {
        order.push('list');
        return list();
      },
    });
    await outcome;
    expect(order).toEqual(['draft', 'rule', 'list']);
    expect(savedRule).toHaveBeenCalledTimes(1);
    expect(savedRule.mock.calls[0]?.[1]).toBe(ENTRY_ID);
    expect(savedRule.mock.calls[0]?.[0]).toBeInstanceOf(Request);
  });

  it('gives the island an empty security token when the cookie is absent', async () => {
    const result = await run({}, { cookie: 'wj_access=a' }).outcome;
    expect(result.kind === 'view' && result.view.csrfToken).toBe('');
  });

  it('derives its path from the entry id only, and has none for a malformed id', () => {
    expect(relatedContentPagePath(ENTRY_ID)).toBe(PATH);
    expect(relatedContentPagePath('nope')).toBeNull();
    expect(relatedContentPagePath(`${ENTRY_ID}/../x`)).toBeNull();
  });
});

describe('loadRelatedContentPage: the saved-rule read is the edit gate (DEC-195, FE03 :1072)', () => {
  it('answers a reader without edit authority with the page-level 403 and reads no candidates', async () => {
    const { outcome, entryList } = run({
      savedRule: async () => apiError(403, 'RELATED_CONTENT_FORBIDDEN'),
    });
    const result = await outcome;
    expect(result.kind === 'notice' && result.notice).toMatchObject({
      status: 403,
      title: 'Access denied',
      message: 'This account cannot edit related content for this entry.',
      retryHref: null,
    });
    expect(entryList).not.toHaveBeenCalled();
  });

  it('asks only after the entry is proven readable, so a concealed entry stays one 404', async () => {
    const savedRule = vi.fn(async () => ruleRead());
    const missing = run({
      savedRule,
      draftDetail: async () => apiError(404, 'NOT_FOUND'),
    });
    expect((await missing.outcome).kind).toBe('notice');
    const unsigned = run({
      savedRule,
      draftDetail: async () => new Response('x', { status: 401 }),
    });
    expect((await unsigned.outcome).kind).toBe('redirect');
    const forbidden = run({
      savedRule,
      draftDetail: async () => apiError(403, 'FORBIDDEN'),
    });
    expect((await forbidden.outcome).kind).toBe('notice');
    expect(savedRule).not.toHaveBeenCalled();
  });

  it('redirects a session that ends before the rule read to sign-in, back to this page', async () => {
    const { outcome, entryList } = run({
      savedRule: async () => new Response('x', { status: 401 }),
    });
    expect(await outcome).toEqual({
      kind: 'redirect',
      location: `/auth/sign-in?returnTo=${encodeURIComponent(PATH)}`,
    });
    expect(entryList).not.toHaveBeenCalled();
  });

  it('answers an entry concealed between the two reads with the one 404 and no form', async () => {
    const { outcome, entryList } = run({
      savedRule: async () => apiError(404, 'RELATED_CONTENT_NOT_FOUND'),
    });
    expect((await outcome).kind === 'notice').toBe(true);
    const result = await run({
      savedRule: async () => apiError(404, 'RELATED_CONTENT_NOT_FOUND'),
    }).outcome;
    expect(result.kind === 'notice' && result.notice).toMatchObject({
      status: 404,
      message: 'This entry is not available.',
    });
    expect(entryList).not.toHaveBeenCalled();
  });

  it('shows the wait of a 429 with a retry link to this page and no form (FE03 :1172)', async () => {
    const result = await run({
      savedRule: async () =>
        new Response(
          JSON.stringify({
            code: 'RATE_LIMITED',
            message:
              'RATE_LIMITED: related-content operation rejected or unavailable.',
            requestId: '10000000-0000-4000-8000-000000000006',
            details: { retryAfterSeconds: 12 },
          }),
          { status: 429, headers: { 'retry-after': '12' } },
        ),
    }).outcome;
    expect(result.kind === 'notice' && result.notice).toMatchObject({
      status: 429,
      heading: 'Too many requests',
      message: 'Too many requests. Try again in 12 seconds.',
      retryHref: PATH,
    });
  });

  it.each([500, 502, 503, 504])(
    'answers a %i of the rule read as temporarily unavailable with a retry link and no form',
    async (status) => {
      const { outcome, entryList } = run({
        savedRule: async () => new Response('x', { status }),
      });
      const result = await outcome;
      expect(result.kind === 'notice' && result.notice).toMatchObject({
        status,
        heading: 'Temporarily unavailable',
        retryHref: PATH,
      });
      expect(entryList).not.toHaveBeenCalled();
    },
  );

  it('shows no form from a rule answer the strict contract did not verify', async () => {
    const answers: Array<() => Response> = [
      () => new Response('not json', { status: 200 }),
      () => new Response(JSON.stringify({}), { status: 200 }),
      () => ruleRead(storedRule({ ownerId: id(9) })),
      () => ruleRead(storedRule({ sourceEntryId: id(9) })),
      () => ruleRead(storedRule({ state: 'revoked', derivedRule: null })),
      () => ruleRead(storedRule({ pins: [id(1)], exclusions: [id(1)] })),
      () =>
        new Response(JSON.stringify({ rule: null, extra: 1 }), { status: 200 }),
    ];
    for (const answer of answers) {
      const { outcome, entryList } = run({ savedRule: async () => answer() });
      const result = await outcome;
      expect(
        result.kind === 'notice' && result.notice.status,
        String(answer),
      ).toBe(502);
      expect(entryList).not.toHaveBeenCalled();
    }
  });
});

describe('loadRelatedContentPage: refusing before a read', () => {
  it.each(['nope', '', 'selector', ENTRY_ID.toUpperCase().slice(0, 35)])(
    'answers 400 for the entry id %j without any read',
    async (entryId) => {
      const { outcome, draftDetailRead, entryList } = run({}, { entryId });
      const result = await outcome;
      expect(result.kind === 'notice' && result.notice.status).toBe(400);
      expect(draftDetailRead).not.toHaveBeenCalled();
      expect(entryList).not.toHaveBeenCalled();
    },
  );

  it.each(['?pins=a', '?exclusions=b', '?x=1'])(
    'answers 400 for URL state %j: pins and exclusions are form state, never URL state',
    async (search) => {
      const { outcome, draftDetailRead } = run(
        {},
        { path: `${PATH}${search}` },
      );
      const result = await outcome;
      expect(result.kind === 'notice' && result.notice.status).toBe(400);
      expect(draftDetailRead).not.toHaveBeenCalled();
    },
  );
});

describe('loadRelatedContentPage: the entry read', () => {
  it('redirects a missing or expired session to sign-in, back to this page', async () => {
    const { outcome, entryList } = run({
      draftDetail: async () => new Response('x', { status: 401 }),
    });
    expect(await outcome).toEqual({
      kind: 'redirect',
      location: `/auth/sign-in?returnTo=${encodeURIComponent(PATH)}`,
    });
    expect(entryList).not.toHaveBeenCalled();
  });

  it('answers a concealed or absent entry with the one 404', async () => {
    const result = await run({
      draftDetail: async () => apiError(404, 'NOT_FOUND'),
    }).outcome;
    expect(result.kind === 'notice' && result.notice).toMatchObject({
      status: 404,
      message: 'This entry is not available.',
    });
  });

  it('answers a visible entry the account cannot read with 403', async () => {
    const result = await run({
      draftDetail: async () => apiError(403, 'FORBIDDEN'),
    }).outcome;
    expect(result.kind === 'notice' && result.notice.status).toBe(403);
  });

  it.each([500, 502, 503])(
    'answers a %i as temporarily unavailable with a retry link',
    async (status) => {
      const result = await run({
        draftDetail: async () => new Response('x', { status }),
      }).outcome;
      expect(result.kind === 'notice' && result.notice).toMatchObject({
        heading: 'Temporarily unavailable',
        retryHref: PATH,
      });
    },
  );

  it('refuses a draft that is not the strict resource, or is another entry', async () => {
    for (const draftDetailRead of [
      async () => new Response(JSON.stringify({ entry: {} }), { status: 200 }),
      async () => new Response('not json', { status: 200 }),
      async () => {
        const response = detail();
        const body = (await response.json()) as { entry: { id: string } };
        body.entry.id = id(9);
        return new Response(JSON.stringify(body), { status: 200 });
      },
    ]) {
      const result = await run({ draftDetail: draftDetailRead }).outcome;
      expect(result.kind === 'notice' && result.notice.status).toBe(502);
    }
  });
});

describe('loadRelatedContentPage: the candidate read', () => {
  it('redirects a session that ends between the two reads', async () => {
    const result = await run({
      entryList: async () => new Response('x', { status: 401 }),
    }).outcome;
    expect(result.kind).toBe('redirect');
  });

  it('shows no form from an entry list it could not read or verify', async () => {
    for (const entryList of [
      async () => new Response('x', { status: 503 }),
      async () => new Response('x', { status: 403 }),
      async () =>
        new Response(JSON.stringify({ items: [{}] }), { status: 200 }),
      async () => list([item(1, { entryLifecycle: 'gone' })]),
      async () => list([item(1, { ownerId: id(9) })]),
    ]) {
      const result = await run({ entryList }).outcome;
      expect(result.kind, String(entryList)).toBe('notice');
    }
  });

  it('answers any other status of the list as one closed notice with a retry to this page', async () => {
    const result = await run({
      entryList: async () => new Response('x', { status: 409 }),
    }).outcome;
    expect(result.kind === 'notice' && result.notice.retryHref).toBe(PATH);
  });
});
