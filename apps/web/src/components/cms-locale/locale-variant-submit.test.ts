import { describe, expect, it, vi } from 'vitest';

import { buildLocaleVariantRequest } from './locale-variant-request';
import {
  localeCatalogCodes,
  submitLocaleVariant,
} from './locale-variant-submit';
import {
  CHAIN,
  ENTRY_ID,
  LEGAL,
  LOCALE,
  SOURCE_REVISION_ID,
  TITLE,
  entryFacts,
  fieldInits,
} from './locale-variant.test-support';

const built = buildLocaleVariantRequest(
  { fields: fieldInits(), values: { [TITLE]: 'Titre' }, fallbackChain: CHAIN },
  entryFacts(),
);
if (!built.ok) throw new Error('fixture request must build');
const request = built.value;
const REVISION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132e0';

const resource = (extra: Record<string, unknown> = {}) => ({
  id: '018f0c45-73fe-7dc2-9c09-68f7ecf132e1',
  version: '1',
  contentHash: 'b'.repeat(64),
  createdAt: '2026-10-22T10:00:00.000Z',
  updatedAt: '2026-10-22T10:00:00.000Z',
  state: 'draft',
  entryId: ENTRY_ID,
  revisionId: REVISION_ID,
  locale: LOCALE,
  sourceRevisionId: SOURCE_REVISION_ID,
  fallbackChain: [...CHAIN],
  noFallbackFieldIds: [LEGAL],
  staleFieldIds: [],
  ...extra,
});
const created = (body: unknown = resource(), etag: string | null = '"5"') =>
  new Response(JSON.stringify(body), {
    status: 201,
    headers: etag === null ? {} : { etag },
  });
const refusal = (
  status: number,
  details: Record<string, unknown> = {},
  headers: Record<string, string> = {},
  code: string | undefined = localeCatalogCodes[status],
) =>
  new Response(
    JSON.stringify({ code, message: 'm', requestId: 'r', details }),
    {
      status,
      headers,
    },
  );
const send = (response: Response | (() => Promise<Response>)) =>
  submitLocaleVariant(
    request,
    'csrf-token',
    'idem-key-0001',
    vi.fn(async () =>
      typeof response === 'function' ? response() : response,
    ) as unknown as typeof fetch,
  );

describe('submitLocaleVariant (CMS-03C-04 browser transport)', () => {
  it('posts the exact request with the CSRF token, the idempotency key and the entry version as the strong If-Match', async () => {
    const fetcher = vi.fn(async () => created());
    await submitLocaleVariant(
      request,
      'csrf-token',
      'idem-key-0001',
      fetcher as unknown as typeof fetch,
    );
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      `/api/v1/cms/entries/${ENTRY_ID}/locales/${LOCALE}/variants`,
    );
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      body: built.ok ? built.body : '',
    });
    expect(init.headers).toEqual({
      'content-type': 'application/json',
      'x-csrf-token': 'csrf-token',
      'idempotency-key': 'idem-key-0001',
      'if-match': '"4"',
    });
  });

  it('accepts a 201 that answers THIS request and reports the next entry version and the draft state', async () => {
    expect(await send(created())).toEqual({
      kind: 'saved',
      saved: {
        version: '5',
        state: 'draft',
        staleFieldIds: [],
        savedFieldIds: [TITLE],
      },
    });
  });

  it.each([
    ['another locale', created(resource({ locale: 'de' }))],
    ['another entry', created(resource({ entryId: REVISION_ID }))],
    ['another source', created(resource({ sourceRevisionId: ENTRY_ID }))],
    ['another chain', created(resource({ fallbackChain: ['en-US'] }))],
    ['another no_fallback set', created(resource({ noFallbackFieldIds: [] }))],
    ['a non-draft state', created(resource({ state: 'approved' }))],
    ['stale ids on a draft', created(resource({ staleFieldIds: [TITLE] }))],
    ['a missing ETag', created(resource(), null)],
    ['the wrong ETag', created(resource(), '"4"')],
    ['a non-object body', created('nope')],
    ['an unparseable body', new Response('{', { status: 201 })],
  ])(
    'treats a 201 with %s as an unknown outcome, never a success',
    async (_n, response) => {
      expect(await send(response)).toEqual({ kind: 'uncertain' });
    },
  );

  it('treats a network failure, an unknown-outcome header and an uncatalogued status as unknown', async () => {
    expect(await send(async () => Promise.reject(new Error('net')))).toEqual({
      kind: 'uncertain',
    });
    expect(
      await send(
        new Response('x', {
          status: 503,
          headers: { 'x-cms-editorial-outcome': 'unknown' },
        }),
      ),
    ).toEqual({ kind: 'uncertain' });
    expect(await send(new Response('{}', { status: 418 }))).toEqual({
      kind: 'uncertain',
    });
    expect(await send(refusal(409, {}, {}, 'OTHER'))).toEqual({
      kind: 'uncertain',
    });
  });

  it('reads the active chain from a 409 FALLBACK_CHAIN_MISMATCH and only a well-formed one', async () => {
    expect(
      await send(
        refusal(409, {
          reasonCode: 'FALLBACK_CHAIN_MISMATCH',
          activeFallbackChain: ['fr', 'en-US'],
          currentVersion: '4',
        }),
      ),
    ).toEqual({
      kind: 'chain_mismatch',
      activeFallbackChain: ['fr', 'en-US'],
    });
    for (const bad of [
      { reasonCode: 'FALLBACK_CHAIN_MISMATCH' },
      { reasonCode: 'FALLBACK_CHAIN_MISMATCH', activeFallbackChain: ['fr_CA'] },
      {
        reasonCode: 'FALLBACK_CHAIN_MISMATCH',
        activeFallbackChain: Array.from({ length: 17 }, () => 'fr'),
      },
    ])
      expect(await send(refusal(409, bad))).toEqual({
        kind: 'conflict',
        currentVersion: null,
      });
  });

  it('distinguishes the 33rd-locale refusal and a plain version conflict', async () => {
    expect(
      await send(refusal(409, { reasonCode: 'locale_limit_reached' })),
    ).toEqual({ kind: 'limit_reached' });
    expect(await send(refusal(409, { currentVersion: '9' }))).toEqual({
      kind: 'conflict',
      currentVersion: '9',
    });
    expect(await send(refusal(409, { currentVersion: 'x' }))).toEqual({
      kind: 'conflict',
      currentVersion: null,
    });
  });

  it.each([400, 401, 403, 404, 415, 422, 500, 502, 503, 504] as const)(
    'maps a catalogued %s to a rejected result',
    async (status) => {
      expect(await send(refusal(status))).toEqual({ kind: 'rejected', status });
    },
  );

  it('keeps a bounded 429 wait and treats a malformed one as unknown', async () => {
    expect(
      await send(
        refusal(429, { retryAfterSeconds: 7 }, { 'retry-after': '7' }),
      ),
    ).toEqual({ kind: 'rejected', status: 429, retryAfterSeconds: 7 });
    expect(await send(refusal(429, {}, { 'retry-after': 'soon' }))).toEqual({
      kind: 'uncertain',
    });
    expect(
      await send(
        refusal(429, { retryAfterSeconds: 5 }, { 'retry-after': '9' }),
      ),
    ).toEqual({ kind: 'uncertain' });
  });

  it('never sends an unusable request', async () => {
    const fetcher = vi.fn();
    expect(
      await submitLocaleVariant(
        { ...request, entryId: 'nope' },
        'csrf',
        'key',
        fetcher as unknown as typeof fetch,
      ),
    ).toEqual({ kind: 'uncertain' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
