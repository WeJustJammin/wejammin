import { describe, expect, it, vi } from 'vitest';

import {
  apiError,
  json,
} from '../cms-editorial/cms-editorial-editor-fixtures.test-support';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';
import { loadEntryListPage } from './load-entry-list-page';

/**
 * Slice 10 evidence lane EC, remediation R1 (P2-S10-AC-098), fixed by lane N.
 * FE03 CmsEditorialEntryList (.memory/wiki/specs/fe/03-cms-content-modeling.md:574): a 409 on the
 * cursor (expired, tampered, foreign or changed collection; DEC-140) "drops the cursor from URL
 * state, keeps the filters and loads the first page with a polite announcement that the list
 * changed". The loader redirects to the same list WITHOUT the cursor and with a one-shot
 * `listChanged=1` marker; that request loads the first page (the marker never reaches the read) and
 * carries the announcement.
 */

const ROUTE = '/app/cms-content-modeling/entries';
const TYPE = '018f0c45-73fe-7dc2-9c09-68f7ecf10001';
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
const page = (response: Response, search: string) => {
  const entryList = vi.fn<(request: Request) => Promise<Response>>(
    async () => response,
  );
  return {
    entryList,
    run: () =>
      loadEntryListPage({
        request: new Request(`https://web.test${ROUTE}${search}`),
        reads: { entryList } as unknown as CmsEditorialPageReads,
      }),
  };
};

describe('AC-098: a cursor 409 restarts from the first page and keeps the filters', () => {
  it('redirects to the same list without the cursor, keeping state, type and limit', async () => {
    const { run } = page(
      apiError(409, 'CONFLICT'),
      `?state=draft&contentTypeId=${TYPE}&limit=1&cursor=stale`,
    );
    const outcome = await run();
    expect(outcome.kind).toBe('redirect');
    const location = outcome.kind === 'redirect' ? outcome.location : '';
    const target = new URL(location, 'https://web.test');
    expect(target.pathname).toBe(ROUTE);
    expect(target.searchParams.get('state')).toBe('draft');
    expect(target.searchParams.get('contentTypeId')).toBe(TYPE);
    expect(target.searchParams.get('limit')).toBe('1');
    expect(target.searchParams.has('cursor')).toBe(false);
    expect(target.searchParams.get('listChanged')).toBe('1');
  });

  it('loads the first page on the restarted request with a polite announcement, and never forwards the marker', async () => {
    const read = page(
      json(200, { items: [row], nextCursor: null, pageVersion: '1' }),
      `?state=draft&limit=1&listChanged=1`,
    );
    const outcome = await read.run();
    expect(outcome.kind).toBe('view');
    if (outcome.kind !== 'view') return;
    expect(outcome.view.announcement).toBe(
      'The list changed, so it restarted from the first page. Your filters are kept.',
    );
    expect(outcome.view.query).toEqual({ state: 'draft', limit: '1' });
    const forwarded = read.entryList.mock.calls[0]?.[0] as Request;
    expect(new URL(forwarded.url).searchParams.has('listChanged')).toBe(false);
    expect(new URL(forwarded.url).searchParams.get('state')).toBe('draft');
  });

  it('announces nothing on an ordinary load', async () => {
    const outcome = await page(
      json(200, { items: [row], nextCursor: null, pageVersion: '1' }),
      '?state=draft',
    ).run();
    expect(outcome.kind === 'view' && outcome.view.announcement).toBeNull();
  });

  it('a 409 with no cursor to drop is the closed state, retrying the same position', async () => {
    const outcome = await page(apiError(409, 'CONFLICT'), '?state=draft').run();
    expect(outcome.kind === 'notice' && outcome.notice.retryHref).toBe(
      `${ROUTE}?state=draft`,
    );
  });

  it('does not loop: a restarted request that is refused again shows the closed state', async () => {
    const outcome = await page(
      apiError(409, 'CONFLICT'),
      '?state=draft&listChanged=1',
    ).run();
    expect(outcome.kind).toBe('notice');
  });

  it('keeps the position for a transient failure', async () => {
    const outcome = await page(
      json(503, {
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'x',
        requestId: 'r',
        details: {},
      }),
      '?state=draft&cursor=abc',
    ).run();
    expect(outcome.kind === 'notice' && outcome.notice.retryHref).toBe(
      `${ROUTE}?state=draft&cursor=abc`,
    );
  });
});
