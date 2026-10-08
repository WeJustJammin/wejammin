import { describe, expect, it, vi } from 'vitest';

import {
  HISTORY_ENTRY_ID,
  HISTORY_ROUTE,
  RIGHT_ID,
  change,
  compareWith,
  historyPage,
  restore,
} from '../cms-editorial/cms-editorial-history-fixtures.test-support';
import {
  apiError,
  draftDetail,
  json,
} from '../cms-editorial/cms-editorial-editor-fixtures.test-support';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';
import { loadRevisionHistoryPage } from './load-revision-history-page';

const page = (search = '') =>
  new Request(`https://web.test${HISTORY_ROUTE}${search}`);

const reads = (parts: Partial<CmsEditorialPageReads>) =>
  parts as CmsEditorialPageReads;

const withCompare = (restoreValue = restore()) =>
  json(
    200,
    historyPage({ compare: compareWith([change('field')], restoreValue) }),
  );

const refusal = (reasonCode: string | undefined) =>
  apiError(
    422,
    'VALIDATION_FAILED',
    reasonCode === undefined ? {} : { reasonCode },
  );

const load = (
  parts: Partial<CmsEditorialPageReads>,
  search = '',
  entryId = HISTORY_ENTRY_ID,
) =>
  loadRevisionHistoryPage({
    request: page(search),
    entryId,
    reads: reads(parts),
  });

describe('loadRevisionHistoryPage', () => {
  it('returns the verified page and the entry version the restore needs when a restore is available', async () => {
    const draft = vi.fn(async () =>
      draftDetail({ entryVersion: '7', revisionNumber: '2', values: {} }),
    );
    const outcome = await load(
      { revisionHistory: async () => withCompare(), draftDetail: draft },
      `?compareRevisionId=${RIGHT_ID}&state=draft`,
    );
    expect(outcome.kind).toBe('view');
    if (outcome.kind !== 'view') return;
    expect(outcome.heading).toBe('Revision history');
    expect(outcome.view).toMatchObject({
      entryId: HISTORY_ENTRY_ID,
      expectedVersion: '7',
      refusal: null,
      routePath: HISTORY_ROUTE,
      query: { compareRevisionId: RIGHT_ID, state: 'draft' },
    });
    expect(outcome.view.page.items).toHaveLength(1);
    expect(draft).toHaveBeenCalledTimes(1);
  });

  it('does not read the entry when no restore is offered', async () => {
    const draft = vi.fn();
    const outcome = await load({
      revisionHistory: async () => json(200, historyPage()),
      draftDetail: draft,
    });
    expect(draft).not.toHaveBeenCalled();
    expect(outcome.kind === 'view' && outcome.view.expectedVersion).toBeNull();
    const unavailable = await load({
      revisionHistory: async () => withCompare(restore('chain_unavailable')),
      draftDetail: draft,
    });
    expect(draft).not.toHaveBeenCalled();
    expect(unavailable.kind).toBe('view');
  });

  it('leaves the restore without a version when the entry read fails, so it cannot commit', async () => {
    const outcome = await load({
      revisionHistory: async () => withCompare(),
      draftDetail: async () => apiError(503, 'DEPENDENCY_UNAVAILABLE'),
    });
    expect(outcome.kind === 'view' && outcome.view.expectedVersion).toBeNull();
  });

  it('answers a malformed entry id as an invalid request without an upstream call', async () => {
    const history = vi.fn();
    const outcome = await load({ revisionHistory: history }, '', 'nope');
    expect(history).not.toHaveBeenCalled();
    expect(outcome.kind === 'notice' && outcome.notice).toMatchObject({
      status: 400,
      heading: 'Invalid request',
    });
  });

  it('returns an expired session to this page with its URL-owned state', async () => {
    const outcome = await load(
      { revisionHistory: async () => apiError(401, 'UNAUTHENTICATED') },
      '?state=draft&limit=10',
    );
    expect(outcome).toEqual({
      kind: 'redirect',
      location: `/auth/sign-in?returnTo=${encodeURIComponent(`${HISTORY_ROUTE}?state=draft&limit=10`)}`,
    });
  });

  it.each([
    [403, 'Access denied'],
    [404, 'Not found'],
    [409, 'List position is no longer valid'],
    [503, 'Temporarily unavailable'],
  ])('renders a %i as one closed state', async (status, heading) => {
    const outcome = await load({
      revisionHistory: async () => apiError(status, 'X'),
    });
    expect(outcome.kind === 'notice' && outcome.notice.heading).toBe(heading);
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(status);
  });

  it('restarts a stale cursor from the first page', async () => {
    const outcome = await load(
      { revisionHistory: async () => apiError(409, 'CONFLICT') },
      '?cursor=stale&state=draft',
    );
    expect(outcome.kind === 'notice' && outcome.notice.retryHref).toBe(
      `${HISTORY_ROUTE}?state=draft`,
    );
  });

  it.each(['comparison_too_large', 'comparison_unavailable'] as const)(
    'turns the typed 422 %s into a refusal beside the list, never a truncated comparison',
    async (reasonCode) => {
      const urls: string[] = [];
      const outcome = await load(
        {
          revisionHistory: async (request) => {
            urls.push(request.url);
            return urls.length === 1
              ? refusal(reasonCode)
              : json(200, historyPage());
          },
        },
        `?compareRevisionId=${RIGHT_ID}&state=draft&cursor=c`,
      );
      expect(outcome.kind).toBe('view');
      if (outcome.kind !== 'view') return;
      expect(outcome.view.refusal).toBe(reasonCode);
      expect(outcome.view.page.compare).toBeNull();
      expect(outcome.view.page.items).toHaveLength(1);
      // The list is re-read without the comparison and without the cursor bound to it.
      expect(urls).toHaveLength(2);
      expect(urls[1]).not.toContain('compareRevisionId');
      expect(urls[1]).not.toContain('cursor=');
      expect(urls[1]).toContain('state=draft');
    },
  );

  it('treats an untyped 422 as an invalid request and a failing list re-read as its own state', async () => {
    const untyped = await load({
      revisionHistory: async () => refusal(undefined),
    });
    expect(untyped.kind === 'notice' && untyped.notice.heading).toBe(
      'Invalid request',
    );
    const failing = await load(
      {
        revisionHistory: (() => {
          let calls = 0;
          return async () =>
            ++calls === 1
              ? refusal('comparison_too_large')
              : apiError(503, 'X');
        })(),
      },
      `?compareRevisionId=${RIGHT_ID}`,
    );
    expect(failing.kind === 'notice' && failing.notice.status).toBe(503);
  });

  it('refuses a 200 that is not the strict contract', async () => {
    const outcome = await load({
      revisionHistory: async () => json(200, { items: 'no' }),
    });
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(502);
  });
});
