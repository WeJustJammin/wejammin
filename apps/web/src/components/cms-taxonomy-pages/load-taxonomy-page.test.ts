import { describe, expect, it } from 'vitest';

import {
  TAXONOMY_ID,
  jsonResponse,
  termsPageFixture,
  versionFixture,
  versionsPageFixture,
} from '../../server/cms-taxonomy-platform.test-support';
import { GOVERNED_QUEUE_PATH } from '../cms-governed-review/CmsGovernedReviewDetail';
import { loadTaxonomyPage, taxonomyReviewHref } from './load-taxonomy-page';
import {
  BASE,
  failure,
  reads,
  request,
  termsOk,
  versionsOk,
} from './load-taxonomy-page.test-support';
import type { TaxonomyPageReads } from './taxonomy-page-reads';

describe('loadTaxonomyPage: a saved vocabulary', () => {
  const load = (
    stub: TaxonomyPageReads,
    search = '',
    id: string | null = TAXONOMY_ID,
  ) =>
    loadTaxonomyPage({
      request: request(`${BASE}${search}`),
      taxonomyId: id ?? '',
      reads: stub,
    });

  it('serves the newest version as the edit preimage, the history, the active version and the first term page', async () => {
    const stub = reads();
    const outcome = await load(stub);
    if (outcome.kind !== 'view') throw new Error('expected a view');
    const { view } = outcome;
    expect(outcome.status).toBe(200);
    expect(view.mode).toBe('edit');
    expect(view.csrfToken).toBe('csrf-token-1');
    expect(view.latest).toMatchObject({
      taxonomyId: TAXONOMY_ID,
      taxonomyVersion: 3,
      state: 'draft',
    });
    expect(view.versions.map((row) => [row.version, row.state])).toEqual([
      ['3', 'draft'],
      ['2', 'active'],
      ['1', 'superseded'],
    ]);
    expect(view.vocabulary).toEqual({
      taxonomyId: TAXONOMY_ID,
      taxonomyKey: view.latest?.taxonomyKey,
      shape: view.latest?.shape,
      active: { version: '2' },
      versionsBounded: false,
    });
    expect(view.terms?.items).toHaveLength(2);
    expect(view.query).toEqual({ lifecycle: null, cursor: null });
    expect(view.basePath).toBe(BASE);
    expect(view.panel).toEqual({
      id: view.latest?.id,
      contentHash: view.latest?.contentHash,
      taxonomyId: TAXONOMY_ID,
      taxonomyKey: view.latest?.taxonomyKey,
      taxonomyVersion: 3,
      state: 'draft',
    });
    expect(stub.versions).toHaveBeenCalledWith(
      expect.any(Request),
      TAXONOMY_ID,
    );
  });

  it('offers term actions against no version when none is active', async () => {
    const outcome = await load(
      reads(
        jsonResponse(
          200,
          versionsPageFixture({
            items: versionsPageFixture().items.filter(
              (row) => row.state !== 'active',
            ),
          }),
          { etag: '"3"' },
        ),
      ),
    );
    expect(outcome.kind === 'view' && outcome.view.vocabulary?.active).toBe(
      null,
    );
  });

  describe('the newest-50 bound on finding the active version (BE03c 406)', () => {
    const history = (count: number, activeVersion: number | null) =>
      Array.from({ length: count }, (_value, index) => {
        const number = count - index;
        return versionFixture({
          id: `40000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
          version: String(number),
          taxonomyVersion: number,
          state: number === activeVersion ? 'active' : 'superseded',
        });
      });
    const boundedOf = async (count: number, activeVersion: number | null) => {
      const outcome = await load(
        reads(
          jsonResponse(
            200,
            versionsPageFixture({ items: history(count, activeVersion) }),
            { etag: '"3"' },
          ),
        ),
      );
      if (outcome.kind !== 'view') throw new Error('expected a view');
      return outcome.view.vocabulary;
    };

    it('says the search stopped at the newest 50 when 50 versions hold no active one', async () => {
      expect(await boundedOf(50, null)).toMatchObject({
        active: null,
        versionsBounded: true,
      });
    });

    it('says nothing of the bound when fewer than 50 versions hold no active one', async () => {
      expect(await boundedOf(49, null)).toMatchObject({
        active: null,
        versionsBounded: false,
      });
    });

    it('finds an active version inside the newest 50', async () => {
      expect(await boundedOf(50, 7)).toMatchObject({
        active: { version: '7' },
        versionsBounded: false,
      });
    });
  });

  it('forwards the URL state of the term list and never any other member of the page URL', async () => {
    const stub = reads(versionsOk(), termsOk({ nextCursor: null }));
    const outcome = await load(stub, '?lifecycle=deprecated&cursor=abc.def');
    expect(outcome.kind).toBe('view');
    const [call] = stub.terms.mock.calls as unknown as [
      [Request, string, string],
    ];
    expect(call[1]).toBe(TAXONOMY_ID);
    expect(call[2]).toBe('?lifecycle=deprecated&cursor=abc.def');
    if (outcome.kind === 'view')
      expect(outcome.view.query).toEqual({
        lifecycle: 'deprecated',
        cursor: 'abc.def',
      });
  });

  it.each([
    ['an unknown member', '?q=1'],
    ['a duplicated member', '?lifecycle=active&lifecycle=merged'],
    ['an unknown lifecycle', '?lifecycle=gone'],
    ['an empty cursor', '?cursor='],
    ['an oversize cursor', `?cursor=${'a'.repeat(513)}`],
  ])('answers %s before any protected read', async (_name, search) => {
    const stub = reads();
    const outcome = await load(stub, search);
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(400);
    expect(stub.versions).not.toHaveBeenCalled();
    expect(stub.terms).not.toHaveBeenCalled();
  });

  it.each([
    ['selector'],
    ['versions'],
    ['not-a-uuid'],
    ['90000000-0000-4000-8000-00000000000'],
  ])(
    'answers the malformed or reserved id %s with 400 before any read',
    async (id) => {
      const stub = reads();
      const outcome = await loadTaxonomyPage({
        request: request(`${BASE}`),
        taxonomyId: id,
        reads: stub,
      });
      expect(outcome.kind === 'notice' && outcome.notice.status).toBe(400);
      expect(stub.versions).not.toHaveBeenCalled();
    },
  );

  it('redirects an expired session on either read back to the vocabulary page', async () => {
    const expected = {
      kind: 'redirect',
      location: `/auth/sign-in?returnTo=${encodeURIComponent(BASE)}`,
    };
    expect(await load(reads(failure(401)))).toEqual(expected);
    expect(await load(reads(versionsOk(), failure(401)))).toEqual(expected);
  });

  it('restarts a stale cursor from the first page (409)', async () => {
    expect(
      await load(
        reads(versionsOk(), failure(409)),
        '?lifecycle=merged&cursor=x',
      ),
    ).toEqual({ kind: 'redirect', location: `${BASE}?lifecycle=merged` });
    expect(await load(reads(versionsOk(), failure(409)), '?cursor=x')).toEqual({
      kind: 'redirect',
      location: BASE,
    });
    expect(
      await load(reads(versionsOk(), failure(409)), '?lifecycle=&cursor=x'),
    ).toEqual({ kind: 'redirect', location: BASE });
  });

  it.each(['', '?lifecycle=merged', '?lifecycle='])(
    'never redirects a 409 to its own address: %j has no cursor to restart from',
    async (search) => {
      const outcome = await load(reads(versionsOk(), failure(409)), search);
      expect(outcome.kind).toBe('notice');
      if (outcome.kind === 'notice') expect(outcome.notice.status).toBe(409);
    },
  );

  it('treats an empty lifecycle as no filter and forwards only the cursor', async () => {
    const stub = reads();
    const outcome = await load(stub, '?lifecycle=&cursor=abc.def');
    expect(outcome.kind).toBe('view');
    expect(
      (stub.terms.mock.calls as unknown as [[Request, string, string]])[0][2],
    ).toBe('?cursor=abc.def');
    if (outcome.kind === 'view')
      expect(outcome.view.query).toEqual({
        lifecycle: null,
        cursor: 'abc.def',
      });
  });

  it('still rejects a repeated empty lifecycle', async () => {
    const outcome = await load(reads(), '?lifecycle=&lifecycle=active');
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(400);
  });

  it.each([
    [403, 'Vocabulary curator access'],
    [404, 'unavailable to the current acting context'],
    [503, 'not responding'],
  ])('shows one fixed notice for a versions %i', async (status, copy) => {
    const outcome = await load(reads(failure(status)));
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(status);
    expect(outcome.kind === 'notice' && outcome.notice.message).toContain(copy);
  });

  it('explains the versions answer first, then the terms answer', async () => {
    const both = await load(reads(failure(404), failure(503)));
    expect(both.kind === 'notice' && both.notice.status).toBe(404);
    const terms = await load(reads(versionsOk(), failure(503)));
    expect(terms.kind === 'notice' && terms.notice.status).toBe(503);
  });

  it('keeps the wait of a rate limit', async () => {
    const outcome = await load(reads(failure(429, { 'retry-after': '12' })));
    expect(outcome.kind === 'notice' && outcome.notice.message).toContain(
      '12 seconds',
    );
  });

  it.each([
    [
      'a version page without the strong ETag',
      jsonResponse(200, versionsPageFixture()),
    ],
    [
      'a version page of another vocabulary',
      jsonResponse(
        200,
        versionsPageFixture({
          items: versionsPageFixture().items.map((row) => ({
            ...row,
            taxonomyId: '90000000-0000-4000-8000-0000000000aa',
          })),
        }),
        { etag: '"3"' },
      ),
    ],
    [
      'an unknown member',
      jsonResponse(
        200,
        { ...versionsPageFixture(), owner: 'x' },
        { etag: '"3"' },
      ),
    ],
    [
      'an empty history',
      jsonResponse(200, { items: [], pageVersion: '3' }, { etag: '"3"' }),
    ],
  ])('renders nothing from %s', async (_name, response) => {
    const outcome = await load(reads(response));
    expect(outcome.kind === 'notice').toBe(true);
    if (outcome.kind === 'notice')
      expect([404, 502]).toContain(outcome.notice.status);
  });

  it('renders nothing from a term page without its strong ETag', async () => {
    const outcome = await load(
      reads(versionsOk(), jsonResponse(200, termsPageFixture())),
    );
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(502);
  });
});

describe('taxonomyReviewHref', () => {
  it('links the known review, else the governed queue', () => {
    expect(taxonomyReviewHref(null)).toBe(GOVERNED_QUEUE_PATH);
    expect(
      taxonomyReviewHref({
        reviewId: 'r/1',
        state: 'open',
        requiredDecisionCount: 1,
        recordedDecisionCount: 0,
      }),
    ).toBe(`${GOVERNED_QUEUE_PATH}/r%2F1`);
  });
});
