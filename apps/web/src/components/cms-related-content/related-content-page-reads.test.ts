import { describe, expect, it, vi } from 'vitest';

import {
  ENTRY_ID,
  draftDetail,
} from '../cms-editorial/cms-editorial-editor-fixtures.test-support';
import { createRelatedContentPageReads } from './related-content-page-reads';

const emptyList = (): Response =>
  new Response(
    JSON.stringify({ items: [], nextCursor: null, pageVersion: '1' }),
    {
      status: 200,
      headers: { 'content-type': 'application/json', etag: '"1"' },
    },
  );
const page = (extra: Record<string, string> = {}) =>
  new Request(`https://web.test/app/x?pins=a&cursor=zzz`, {
    headers: { cookie: 'wj_access=a; wj_csrf=c', ...extra },
  });
const binding = (answer: () => Response) => ({
  fetch: vi.fn(async () => answer()),
});
const upstream = (stub: ReturnType<typeof binding>): Request =>
  (stub.fetch.mock.calls as unknown as Request[][])[0]?.[0] as Request;

describe('createRelatedContentPageReads', () => {
  it('reads the draft detail of the entry with the session cookie and none of the page URL state', async () => {
    const stub = binding(() =>
      draftDetail({ entryVersion: '4', revisionNumber: '2', values: {} }),
    );
    const response = await createRelatedContentPageReads(stub).draftDetail(
      page(),
      ENTRY_ID,
    );
    expect(response.status).toBe(200);
    const sent = upstream(stub);
    expect(new URL(sent.url).pathname).toBe(`/api/v1/cms/entries/${ENTRY_ID}`);
    expect(new URL(sent.url).search).toBe('');
    expect(sent.headers.get('cookie')).toContain('wj_access=a');
    expect(sent.method).toBe('GET');
  });

  it('reads one bounded first page of the entry list with no filter and no page cursor', async () => {
    const stub = binding(emptyList);
    const response =
      await createRelatedContentPageReads(stub).entryList(page());
    expect(response.status).toBe(200);
    const sent = new URL(upstream(stub).url);
    expect(sent.pathname).toBe('/api/v1/cms/entries');
    expect(sent.search).toBe('?limit=50');
  });

  it('never forwards a browser conditional header, so a reload cannot turn a read into a 304', async () => {
    const stub = binding(emptyList);
    await createRelatedContentPageReads(stub).entryList(
      page({
        'if-none-match': '"7"',
        'if-modified-since': 'Wed, 14 Oct 2026 00:00:00 GMT',
      }),
    );
    const sent = upstream(stub);
    expect(sent.headers.get('if-none-match')).toBeNull();
    expect(sent.headers.get('if-modified-since')).toBeNull();
  });

  it('reads the stored rule of the entry with the session and none of the page URL state (DEC-195)', async () => {
    const stub = binding(
      () =>
        new Response(JSON.stringify({ rule: null }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const response = await createRelatedContentPageReads(stub).savedRule(
      page({
        'if-none-match': '"4"',
        'if-modified-since': 'Wed, 14 Oct 2026 00:00:00 GMT',
      }),
      ENTRY_ID,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rule: null });
    expect(stub.fetch).toHaveBeenCalledTimes(1);
    const sent = upstream(stub);
    expect(new URL(sent.url).pathname).toBe(
      `/api/v1/cms/entries/${ENTRY_ID}/related-content`,
    );
    expect(new URL(sent.url).search).toBe('');
    expect(sent.method).toBe('GET');
    expect(sent.headers.get('cookie')).toContain('wj_access=a');
    expect(sent.headers.get('if-none-match')).toBeNull();
    expect(sent.headers.get('if-modified-since')).toBeNull();
  });

  describe('the retry contract of the rule read (FE03 :1172, :1173)', () => {
    const dependency = (status: number): Response =>
      new Response(
        JSON.stringify({
          code: 'DEPENDENCY_UNAVAILABLE',
          message:
            'DEPENDENCY_UNAVAILABLE: related-content operation rejected or unavailable.',
          requestId: '10000000-0000-4000-8000-000000000006',
          details: { dependencyClass: 'cms_composition', retryable: true },
        }),
        { status, headers: { 'content-type': 'application/json' } },
      );
    const rate = (): Response =>
      new Response(
        JSON.stringify({
          code: 'RATE_LIMITED',
          message:
            'RATE_LIMITED: related-content operation rejected or unavailable.',
          requestId: '10000000-0000-4000-8000-000000000006',
          details: { retryAfterSeconds: 9 },
        }),
        { status: 429, headers: { 'retry-after': '9' } },
      );
    const sequence = (...answers: Array<() => Response>) => {
      const queue = [...answers];
      return {
        fetch: vi.fn(async () =>
          (queue.shift() ?? answers.at(-1) ?? emptyList)(),
        ),
      };
    };

    it('retries a declared-safe 503 twice, after 250 ms and 750 ms, then answers the success', async () => {
      vi.useFakeTimers();
      try {
        const stub = sequence(
          () => dependency(503),
          () => dependency(502),
          () => new Response(JSON.stringify({ rule: null }), { status: 200 }),
        );
        const pending = createRelatedContentPageReads(stub).savedRule(
          page(),
          ENTRY_ID,
        );
        await vi.advanceTimersByTimeAsync(249);
        expect(stub.fetch).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(stub.fetch).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(749);
        expect(stub.fetch).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(1);
        expect((await pending).status).toBe(200);
        expect(stub.fetch).toHaveBeenCalledTimes(3);
      } finally {
        vi.useRealTimers();
      }
    });

    it('gives up after the second retry and hands the last answer to the page', async () => {
      vi.useFakeTimers();
      try {
        const stub = sequence(() => dependency(504));
        const pending = createRelatedContentPageReads(stub).savedRule(
          page(),
          ENTRY_ID,
        );
        await vi.advanceTimersByTimeAsync(1_000);
        expect((await pending).status).toBe(504);
        expect(stub.fetch).toHaveBeenCalledTimes(3);
      } finally {
        vi.useRealTimers();
      }
    });

    it("does not retry a 429, a 403 or a 404: they are the page's answer at once", async () => {
      const refusal = (status: number, code: string) => () =>
        new Response(
          JSON.stringify({
            code,
            message: `${code}: related-content operation rejected or unavailable.`,
            requestId: '10000000-0000-4000-8000-000000000006',
            details: {},
          }),
          { status, headers: { 'content-type': 'application/json' } },
        );
      for (const [answer, status] of [
        [rate, 429],
        [refusal(403, 'RELATED_CONTENT_FORBIDDEN'), 403],
        [refusal(404, 'RELATED_CONTENT_NOT_FOUND'), 404],
      ] as const) {
        const stub = sequence(answer);
        const response = await createRelatedContentPageReads(stub).savedRule(
          page(),
          ENTRY_ID,
        );
        expect(response.status).toBe(status);
        expect(stub.fetch).toHaveBeenCalledTimes(1);
      }
    });
  });

  it('answers a missing platform binding as a closed 503 without a read', async () => {
    const response =
      await createRelatedContentPageReads(undefined).entryList(page());
    expect(response.status).toBe(503);
  });
});
