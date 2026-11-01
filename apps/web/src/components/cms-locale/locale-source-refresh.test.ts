import { describe, expect, it, vi } from 'vitest';

import {
  parseSourceSnapshot,
  refreshLocaleSource,
} from './locale-source-refresh';
import {
  ENTRY_ID,
  HASH,
  SOURCE_REVISION_ID,
  TITLE,
  LEGAL,
} from './locale-variant.test-support';

const draft = (extra: Record<string, unknown> = {}) => ({
  entry: { id: ENTRY_ID, version: '6' },
  revision: { id: SOURCE_REVISION_ID },
  locale: 'en-US',
  contentHash: HASH,
  fields: [
    { fieldId: TITLE, value: 'Autumn tour' },
    { fieldId: LEGAL, value: false },
    { fieldId: 'x', value: { a: 1 } },
  ],
  ...extra,
});
const ids = [TITLE, LEGAL, '028f0c45-73fe-7dc2-9c09-000000000009'];

describe('parseSourceSnapshot', () => {
  it('reads the version, the revision, the hash and the source text of the localizable fields only', () => {
    expect(parseSourceSnapshot(draft(), ENTRY_ID, 'en-US', ids)).toEqual({
      version: '6',
      sourceRevisionId: SOURCE_REVISION_ID,
      sourceHash: HASH,
      texts: {
        [TITLE]: 'Autumn tour',
        [LEGAL]: 'false',
        [ids[2]!]: null,
      },
    });
  });

  it.each([
    [
      'another entry',
      draft({ entry: { id: SOURCE_REVISION_ID, version: '6' } }),
    ],
    ['a non-source locale head', draft({ locale: 'fr-CA' })],
    ['a bad hash', draft({ contentHash: 'nope' })],
    ['a bad version', draft({ entry: { id: ENTRY_ID, version: '0' } })],
    ['a bad revision id', draft({ revision: { id: 'nope' } })],
    ['a non-object body', 'x'],
  ])('refuses %s', (_name, body) => {
    expect(parseSourceSnapshot(body, ENTRY_ID, 'en-US', ids)).toBeNull();
  });
});

describe('refreshLocaleSource (one no-store GET of the draft detail)', () => {
  const read = (response: Response | (() => Promise<Response>)) => {
    const fetcher = vi.fn(async () =>
      typeof response === 'function' ? response() : response,
    );
    return {
      fetcher,
      result: refreshLocaleSource({
        entryId: ENTRY_ID,
        sourceLocale: 'en-US',
        fieldIds: ids,
        fetcher: fetcher as unknown as typeof fetch,
      }),
    };
  };

  it('reads the same-origin draft detail with the session only and verifies it', async () => {
    const { fetcher, result } = read(Response.json(draft()));
    expect(await result).toMatchObject({
      kind: 'ready',
      snapshot: { version: '6', sourceHash: HASH },
    });
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`/api/v1/cms/entries/${ENTRY_ID}`);
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    });
    expect(init.body).toBeUndefined();
  });

  it('reports a failed or unverifiable read without adopting anything', async () => {
    expect(await read(new Response('{}', { status: 404 })).result).toEqual({
      kind: 'failed',
      status: 404,
    });
    expect(await read(Response.json({ entry: 1 })).result).toEqual({
      kind: 'failed',
      status: null,
    });
    expect(
      await read(async () => Promise.reject(new Error('net'))).result,
    ).toEqual({ kind: 'failed', status: null });
  });

  it('reports a 429 with its wait', async () => {
    expect(
      await read(
        new Response('{}', { status: 429, headers: { 'retry-after': '9' } }),
      ).result,
    ).toEqual({ kind: 'rate_limited', retryAfterSeconds: 9 });
  });
});
