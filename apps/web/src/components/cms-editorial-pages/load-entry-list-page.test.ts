import { describe, expect, it } from 'vitest';

import {
  apiError,
  json,
} from '../cms-editorial/cms-editorial-editor-fixtures.test-support';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';
import { loadEntryListPage } from './load-entry-list-page';

const ROUTE = '/app/cms-content-modeling/entries';

const row = {
  id: '018f0c45-73fe-7dc2-9c09-68f7ecf20001',
  entryId: '018f0c45-73fe-7dc2-9c09-68f7ecf10001',
  revisionNumber: '1',
  locale: 'en-US',
  state: 'draft',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-10-05T00:00:00Z',
  authorClass: 'author',
  entryLifecycle: 'active',
  entryUpdatedAt: '2026-10-05T01:00:00Z',
};

const load = (response: Response, search = '') =>
  loadEntryListPage({
    request: new Request(`https://web.test${ROUTE}${search}`),
    reads: {
      entryList: async () => response,
    } as unknown as CmsEditorialPageReads,
  });

describe('loadEntryListPage', () => {
  it('returns the verified page with the URL-owned query for the views', async () => {
    const outcome = await load(
      json(200, { items: [row], nextCursor: 'c', pageVersion: '1' }),
      '?state=draft&limit=1',
    );
    expect(outcome.kind).toBe('view');
    if (outcome.kind !== 'view') return;
    expect(outcome.heading).toBe('Entries');
    expect(outcome.view).toMatchObject({
      routePath: ROUTE,
      query: { state: 'draft', limit: '1' },
    });
    expect(outcome.view.page.items).toHaveLength(1);
  });

  it('returns an expired session to this exact list position', async () => {
    const outcome = await load(
      apiError(401, 'UNAUTHENTICATED'),
      '?state=draft&cursor=abc',
    );
    expect(outcome).toEqual({
      kind: 'redirect',
      location: `/auth/sign-in?returnTo=${encodeURIComponent(`${ROUTE}?state=draft&cursor=abc`)}`,
    });
  });

  it.each([
    [403, 'Access denied'],
    [404, 'Not found'],
    [429, 'Too many requests'],
    [503, 'Temporarily unavailable'],
  ])('renders a %i as one closed state', async (status, heading) => {
    const outcome = await load(apiError(status, 'X'));
    expect(outcome.kind === 'notice' && outcome.notice.heading).toBe(heading);
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(status);
  });

  it.each([
    [400, 'Invalid request'],
    [422, 'Invalid request'],
  ])(
    'restarts from the unfiltered first page after a %i, never repeating the bad query',
    async (status, heading) => {
      const outcome = await load(
        apiError(status, 'X'),
        '?state=bogus&cursor=stale&contentTypeId=x',
      );
      expect(outcome.kind === 'notice' && outcome.notice.heading).toBe(heading);
      expect(outcome.kind === 'notice' && outcome.notice.retryHref).toBe(ROUTE);
    },
  );

  it('retries a transient failure at the same list position', async () => {
    const outcome = await load(apiError(503, 'X'), '?state=draft');
    expect(outcome.kind === 'notice' && outcome.notice.retryHref).toBe(
      `${ROUTE}?state=draft`,
    );
  });

  it('refuses a 200 that is not the strict page, including a row that leaks an owner id', async () => {
    const leaky = await load(
      json(200, {
        items: [{ ...row, ownerId: 'p_1' }],
        nextCursor: null,
        pageVersion: '1',
      }),
    );
    expect(leaky.kind === 'notice' && leaky.notice.status).toBe(502);
    const malformed = await load(json(200, { items: 'no' }));
    expect(malformed.kind === 'notice' && malformed.notice.status).toBe(502);
  });
});
