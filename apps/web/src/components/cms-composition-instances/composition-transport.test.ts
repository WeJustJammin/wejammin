import { afterEach, describe, expect, it, vi } from 'vitest';

import { BROWSER_READ_DEADLINE_MS } from '../../lib/read-deadline';
import { readJson, sendJson } from './composition-transport';

/*
 * The browser transport of CMS-03C-02/-13/-14/-15 (FE03 "Network and retry contract" :1172-1173): safe reads retry a
 * declared-safe dependency failure twice, a mutation never retries blindly (an unknown outcome keeps its key), a 429
 * waits for the stated delay, and a refusal is read only when it is the catalog answer of its status.
 */
const error = (
  status: number,
  code: string,
  details: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) =>
  new Response(
    JSON.stringify({
      code,
      message: `${code}: composition operation rejected or unavailable.`,
      requestId: 'r',
      details,
    }),
    { status, headers: { 'content-type': 'application/json', ...headers } },
  );
const ok = (body: unknown, status = 200, etag?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...(etag ? { etag } : {}) },
  });
const send = (fetcher: typeof fetch) =>
  sendJson(
    '/api/v1/cms/compositions/pattern-updates',
    { a: 1 },
    {
      csrfToken: 'csrf',
      idempotencyKey: 'key-0001-0001',
      ifMatch: '9',
      okStatus: 200,
      fetcher,
    },
  );

describe('sendJson', () => {
  it('sends the exact JSON with the CSRF token, key and strong If-Match, same-origin and uncached', async () => {
    const fetcher = vi.fn(async () => ok({ items: [] }, 200, '"10"'));
    const answer = await send(fetcher as unknown as typeof fetch);
    expect(answer).toEqual({
      kind: 'ok',
      status: 200,
      body: { items: [] },
      etag: '"10"',
    });
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/v1/cms/compositions/pattern-updates');
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      body: '{"a":1}',
    });
    expect(init.headers).toEqual({
      'content-type': 'application/json',
      'x-csrf-token': 'csrf',
      'idempotency-key': 'key-0001-0001',
      'if-match': '"9"',
    });
  });

  it('reads a typed refusal only when its code is the catalog code of its status', async () => {
    const typed = await send((async () =>
      error(409, 'COMPOSITION_VERSION_CONFLICT', {
        reasonCode: 'diff_has_collisions',
      })) as unknown as typeof fetch);
    expect(typed).toEqual({
      kind: 'refused',
      status: 409,
      reason: 'diff_has_collisions',
      paths: [],
      currentVersion: null,
    });
    const foreign = await send((async () =>
      error(409, 'SOMETHING_ELSE')) as unknown as typeof fetch);
    expect(foreign).toEqual({ kind: 'uncertain' });
  });

  it('collects bounded violation pointers of a 422 and the current version of a plain 409', async () => {
    const invalid = await send((async () =>
      error(422, 'COMPOSITION_VALIDATION_FAILED', {
        violations: [
          { path: '/slotPath', code: 'invalid', message: 'x' },
          { path: '/overrides', code: 'invalid', message: 'x' },
          { nope: true },
        ],
      })) as unknown as typeof fetch);
    expect(invalid).toMatchObject({
      kind: 'refused',
      status: 422,
      paths: ['/slotPath', '/overrides'],
    });
    const conflict = await send((async () =>
      error(409, 'COMPOSITION_VERSION_CONFLICT', {
        currentVersion: '12',
      })) as unknown as typeof fetch);
    expect(conflict).toMatchObject({
      kind: 'refused',
      status: 409,
      currentVersion: '12',
    });
  });

  it('reads a 429 as a wait only when the delay is stated consistently, else the outcome is unknown', async () => {
    const waited = await send((async () =>
      error(
        429,
        'RATE_LIMITED',
        { retryAfterSeconds: 8 },
        { 'retry-after': '8' },
      )) as unknown as typeof fetch);
    expect(waited).toEqual({ kind: 'rate_limited', retryAfterSeconds: 8 });
    const unstated = await send((async () =>
      error(429, 'RATE_LIMITED')) as unknown as typeof fetch);
    expect(unstated).toEqual({ kind: 'rate_limited', retryAfterSeconds: null });
  });

  it.each([
    [
      'a network failure',
      async () => {
        throw new Error('offline');
      },
    ],
    [
      'a 502',
      async () => error(502, 'DEPENDENCY_UNAVAILABLE', { retryable: true }),
    ],
    ['a 500', async () => error(500, 'INTERNAL_ERROR')],
    [
      'an unknown-outcome marker',
      async () =>
        new Response('{}', {
          status: 502,
          headers: { 'x-cms-editorial-outcome': 'unknown' },
        }),
    ],
    [
      'a 200 body that is not JSON',
      async () => new Response('nope', { status: 200 }),
    ],
    ['an unexpected success status', async () => ok({}, 201)],
  ])('keeps the key for %s: the outcome is unknown', async (_name, build) => {
    expect(await send(build as unknown as typeof fetch)).toEqual({
      kind: 'uncertain',
    });
  });
});

describe('readJson', () => {
  const read = (fetcher: typeof fetch) =>
    readJson('/api/v1/x', { fetcher, sleep: async () => undefined });

  it('returns the body and ETag of a 200 and forwards no body or precondition', async () => {
    const fetcher = vi.fn(async () => ok({ v: 1 }, 200, '"7"'));
    expect(await read(fetcher as unknown as typeof fetch)).toEqual({
      kind: 'ok',
      status: 200,
      body: { v: 1 },
      etag: '"7"',
    });
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    });
    expect(init.body).toBeUndefined();
  });

  it('retries a dependency failure that declares itself retryable at most twice, then reports it', async () => {
    const fetcher = vi.fn(async () =>
      error(503, 'DEPENDENCY_UNAVAILABLE', {
        retryable: true,
        dependencyClass: 'cms_composition',
      }),
    );
    const answer = await read(fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(answer).toMatchObject({ kind: 'failed', status: 503 });
  });

  it('does not retry a 404, reports the reason of a typed 403/422 and the wait of a 429', async () => {
    const missing = vi.fn(async () => error(404, 'COMPOSITION_NOT_FOUND'));
    expect(await read(missing as unknown as typeof fetch)).toMatchObject({
      kind: 'failed',
      status: 404,
    });
    expect(missing).toHaveBeenCalledTimes(1);
    expect(
      await read((async () =>
        error(422, 'COMPOSITION_VALIDATION_FAILED', {
          reasonCode: 'diff_too_large',
        })) as unknown as typeof fetch),
    ).toEqual({ kind: 'failed', status: 422, reason: 'diff_too_large' });
    expect(
      await read((async () =>
        error(
          429,
          'RATE_LIMITED',
          { retryAfterSeconds: 5 },
          { 'retry-after': '5' },
        )) as unknown as typeof fetch),
    ).toEqual({ kind: 'rate_limited', retryAfterSeconds: 5 });
  });

  it('reports a thrown fetch as a failure with no status', async () => {
    expect(
      await read((async () => {
        throw new Error('offline');
      }) as unknown as typeof fetch),
    ).toEqual({
      kind: 'failed',
      status: null,
      reason: null,
    });
  });
});

describe('readJson deadline (review V20 m10, DEC-246 ruling 1)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  const failed = { kind: 'failed', status: null, reason: null };
  const never = () => new Promise<Response>(() => undefined);

  it('answers a failure at the shared deadline when the fetch never settles, and not before', async () => {
    vi.useFakeTimers();
    const answer = readJson('/api/v1/x', {
      fetcher: never as unknown as typeof fetch,
    });
    let settled: unknown = null;
    void answer.then((value) => (settled = value));
    await vi.advanceTimersByTimeAsync(BROWSER_READ_DEADLINE_MS - 1);
    expect(settled).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toEqual(failed);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('gives the fetch a signal that the deadline aborts', async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn((_path: string, init?: RequestInit) => {
      signals.push(init?.signal as AbortSignal);
      return never();
    });
    const answer = readJson('/api/v1/x', {
      fetcher: fetcher as unknown as typeof fetch,
    });
    await vi.advanceTimersByTimeAsync(BROWSER_READ_DEADLINE_MS);
    expect(await answer).toEqual(failed);
    expect(signals[0]?.aborted).toBe(true);
  });

  it('answers a failure when the body never arrives', async () => {
    vi.useFakeTimers();
    const hung = async () =>
      new Response(new ReadableStream({ start: () => undefined }), {
        status: 200,
      });
    const answer = readJson('/api/v1/x', {
      fetcher: hung as unknown as typeof fetch,
    });
    await vi.advanceTimersByTimeAsync(BROWSER_READ_DEADLINE_MS);
    expect(await answer).toEqual(failed);
  });

  it('ends at once when the caller aborts, which is not waited for', async () => {
    vi.useFakeTimers();
    const caller = new AbortController();
    const answer = readJson('/api/v1/x', {
      fetcher: never as unknown as typeof fetch,
      signal: caller.signal,
    });
    caller.abort();
    expect(await answer).toEqual(failed);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts no retry once the caller has aborted while the retry waited', async () => {
    const caller = new AbortController();
    const fetcher = vi.fn(async () =>
      error(503, 'DEPENDENCY_UNAVAILABLE', { retryable: true }),
    );
    const answer = await readJson('/api/v1/x', {
      fetcher: fetcher as unknown as typeof fetch,
      signal: caller.signal,
      sleep: async () => caller.abort(),
    });
    expect(answer).toEqual(failed);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('answers a failure for a fetch that does not answer with a Response', async () => {
    const answer = await readJson('/api/v1/x', {
      fetcher: (async () => ({ status: 200 })) as unknown as typeof fetch,
    });
    expect(answer).toEqual(failed);
  });

  it('leaves no timer behind after an answer', async () => {
    vi.useFakeTimers();
    const answer = await readJson('/api/v1/x', {
      fetcher: (async () => ok({ v: 1 })) as unknown as typeof fetch,
    });
    expect(answer).toMatchObject({ kind: 'ok' });
    expect(vi.getTimerCount()).toBe(0);
  });
});
