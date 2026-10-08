// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cmsEditorialDraftDetailEtagFrom,
  executeCmsEditorialEntryDraftDetailRead,
} from './cms-editorial-entry-draft-detail-transport';

const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const OTHER_ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
const REVISION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const FIELD_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dd';
const FIELD_DEFINITION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132de';
const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132df';
const TARGET_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132e0';
const HASH = 'a'.repeat(64);
const INSTANT = '2026-09-26T12:00:00+00:00';
const BASE_PATH = '/api/v1/cms/entries';
const draftDetailEtag = (entryId = ENTRY_ID) =>
  `"${entryId}:7:${REVISION_ID}:7:${HASH}"`;

const draftDetail = (entryId = ENTRY_ID) => ({
  entry: { id: entryId, version: '7', createdAt: INSTANT, updatedAt: INSTANT },
  revision: {
    id: REVISION_ID,
    version: '7',
    createdAt: INSTANT,
    updatedAt: INSTANT,
  },
  revisionNumber: '7',
  lifecycle: 'active',
  state: 'draft',
  locale: 'en-US',
  contentHash: HASH,
  schemaVersionId: FIELD_DEFINITION_ID,
  validationState: 'valid',
  openConflict: null,
  fields: [
    {
      fieldId: FIELD_ID,
      fieldDefinitionId: FIELD_DEFINITION_ID,
      locale: 'en-US',
      value: { title: 'Hello' },
      provenance: 'authored',
      valueHash: HASH,
    },
  ],
  relations: [
    {
      fieldId: FIELD_ID,
      fieldDefinitionId: FIELD_DEFINITION_ID,
      targetKind: 'artist',
      targetId: TARGET_ID,
      expectedTargetVersion: '3',
      position: 0,
      onUnavailable: 'block',
      unavailable: null,
    },
  ],
});

const jsonResponse = (status: number, body: unknown, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...(headers ?? {}) },
  });

const apiError = (code: string) => ({
  code,
  message: 'Safe message',
  requestId: REQUEST_ID,
  details: {},
});

const read = (
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  overrides: { readonly entryId?: string; readonly locale?: string } = {},
) =>
  executeCmsEditorialEntryDraftDetailRead({
    basePath: BASE_PATH,
    entryId: overrides.entryId ?? ENTRY_ID,
    ...(overrides.locale === undefined ? {} : { locale: overrides.locale }),
    fetcher,
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('executeCmsEditorialEntryDraftDetailRead request shape', () => {
  it('gets the entry with no body and no mutation headers', async () => {
    let capturedUrl: RequestInfo | URL | null = null;
    let capturedInit: RequestInit | undefined;
    const result = await read(async (input, init) => {
      capturedUrl = input;
      capturedInit = init;
      return jsonResponse(200, draftDetail(), { etag: draftDetailEtag() });
    });

    expect(capturedUrl).toBe(BASE_PATH + '/' + ENTRY_ID);
    expect(capturedInit?.method).toBe('GET');
    expect(capturedInit?.body).toBeUndefined();
    expect(capturedInit?.credentials).toBe('same-origin');
    expect(capturedInit?.redirect).toBe('manual');
    expect(capturedInit?.cache).toBe('no-store');
    const headers = new Headers(capturedInit?.headers);
    expect(headers.get('idempotency-key')).toBeNull();
    expect(headers.get('if-match')).toBeNull();
    expect(headers.get('content-type')).toBeNull();
    expect(result.outcome).toBe('success');
    expect(result.status).toBe(200);
    expect(result.etag).toBe(draftDetailEtag());
    expect(result.resource?.fields).toHaveLength(1);
    expect(result.resource?.relations[0]?.onUnavailable).toBe('block');
  });

  it('sends the optional locale as a query parameter only', async () => {
    let capturedUrl: string | null = null;
    await read(
      async (input) => {
        capturedUrl = String(input);
        return jsonResponse(200, draftDetail(), { etag: draftDetailEtag() });
      },
      { locale: 'fr-CA' },
    );
    expect(capturedUrl).toBe(BASE_PATH + '/' + ENTRY_ID + '?locale=fr-CA');
  });

  it('omits the query string when no locale is requested', async () => {
    let capturedUrl: string | null = null;
    await read(async (input) => {
      capturedUrl = String(input);
      return jsonResponse(200, draftDetail(), { etag: draftDetailEtag() });
    });
    expect(capturedUrl).toBe(BASE_PATH + '/' + ENTRY_ID);
  });

  it('refuses a non-UUID id before any network call', async () => {
    const fetcher = vi.fn(async () => jsonResponse(200, draftDetail()));
    const result = await read(fetcher, { entryId: 'not-a-uuid' });
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.outcome).toBe('validation');
    expect(result.status).toBeNull();
    expect(result.errorDetails).toEqual(['entryId']);
  });

  it('refuses a malformed locale before any network call', async () => {
    const fetcher = vi.fn(async () => jsonResponse(200, draftDetail()));
    const result = await read(fetcher, { locale: '' });
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.outcome).toBe('validation');
    expect(result.errorDetails).toEqual(['locale']);
  });
});

describe('executeCmsEditorialEntryDraftDetailRead verification', () => {
  it('captures the representation ETag verbatim without treating it as the write CAS version', async () => {
    const result = await read(async () =>
      jsonResponse(200, draftDetail(), { etag: draftDetailEtag() }),
    );
    expect(result.etag).toBe(draftDetailEtag());
    expect(result.resource?.entry.version).toBe('7');
  });

  it('rejects a weak ETag so it can never anchor an If-Match', async () => {
    const result = await read(async () =>
      jsonResponse(200, draftDetail(), { etag: `W/${draftDetailEtag()}` }),
    );
    expect(result.outcome).toBe('unknown');
    expect(result.etag).toBeNull();
    expect(result.resource).toBeNull();
  });

  it('treats a 200 without a strong ETag as unverifiable, not success', async () => {
    const result = await read(async () => jsonResponse(200, draftDetail()));
    expect(result.outcome).toBe('unknown');
    expect(result.status).toBe(200);
    expect(result.etag).toBeNull();
  });

  it.each([
    '"7"',
    `"${ENTRY_ID}:8:${REVISION_ID}:7:${HASH}"`,
    `"${ENTRY_ID}:7:${REVISION_ID}:8:${HASH}"`,
  ])(
    'rejects a read ETag that does not match both canonical versions: %s',
    async (etag) => {
      const result = await read(async () =>
        jsonResponse(200, draftDetail(), { etag }),
      );
      expect(result.outcome).toBe('unknown');
      expect(result.resource).toBeNull();
      expect(result.etag).toBeNull();
    },
  );

  it('rejects a 200 whose resource belongs to a different entry', async () => {
    const result = await read(async () =>
      jsonResponse(200, draftDetail(OTHER_ENTRY_ID), {
        etag: draftDetailEtag(OTHER_ENTRY_ID),
      }),
    );
    expect(result.outcome).toBe('unknown');
    expect(result.resource).toBeNull();
  });

  it('[P2-S09-AC-081] [P2-S09-AC-203] carries the opaque placeholder relation through as a success', async () => {
    const placeholder = {
      fieldId: FIELD_ID,
      fieldDefinitionId: FIELD_DEFINITION_ID,
      position: 0,
      onUnavailable: 'placeholder',
      unavailable: { status: 'unavailable', reason: 'unavailable' },
    };
    const result = await read(async () =>
      jsonResponse(
        200,
        { ...draftDetail(), relations: [placeholder] },
        { etag: draftDetailEtag() },
      ),
    );
    expect(result.outcome).toBe('success');
    expect(result.resource?.relations).toEqual([placeholder]);
  });

  it('[P2-S09-AC-203] rejects a placeholder relation that copies a target member', async () => {
    const result = await read(async () =>
      jsonResponse(
        200,
        {
          ...draftDetail(),
          relations: [
            {
              fieldId: FIELD_ID,
              fieldDefinitionId: FIELD_DEFINITION_ID,
              position: 0,
              onUnavailable: 'placeholder',
              unavailable: { status: 'unavailable', reason: 'unavailable' },
              targetId: TARGET_ID,
            },
          ],
        },
        { etag: draftDetailEtag() },
      ),
    );
    expect(result.outcome).toBe('unknown');
    expect(result.resource).toBeNull();
  });

  it('rejects a 200 whose body is not a strict EntryDraftDetailResource', async () => {
    const result = await read(async () =>
      jsonResponse(
        200,
        { entry: { id: ENTRY_ID } },
        { etag: draftDetailEtag() },
      ),
    );
    expect(result.outcome).toBe('unknown');
    expect(result.resource).toBeNull();
  });

  it('rejects a 200 whose body is not JSON', async () => {
    const result = await read(
      async () =>
        new Response('ok', {
          status: 200,
          headers: { etag: draftDetailEtag() },
        }),
    );
    expect(result.outcome).toBe('unknown');
    expect(result.resource).toBeNull();
  });

  it('carries no optimistic state: a success is only ever a loaded resource', async () => {
    const result = await read(async () =>
      jsonResponse(200, draftDetail(), { etag: draftDetailEtag() }),
    );
    expect(Object.keys(result)).not.toContain('optimistic');
    expect(result.outcome).toBe('success');
  });
});

describe('executeCmsEditorialEntryDraftDetailRead outcomes', () => {
  it.each([
    [400, 'validation', false],
    [422, 'validation', false],
    [401, 'unauthenticated', false],
    [403, 'forbidden', false],
    [404, 'not-found', false],
    [409, 'unknown', false],
    [429, 'rate-limited', true],
    [502, 'degraded', true],
    [503, 'degraded', true],
    [500, 'degraded', true],
  ] as const)(
    'maps %i to a %s outcome with retryable=%s',
    async (status, outcome, retryable) => {
      const result = await read(async () =>
        jsonResponse(status, apiError('INTERNAL_ERROR')),
      );
      expect(result.outcome).toBe(outcome);
      expect(result.status).toBe(status);
      expect(result.retryable).toBe(retryable);
      expect(result.resource).toBeNull();
      expect(result.etag).toBeNull();
    },
  );

  it('never discloses whether a hidden entry exists: 403 and 404 stay distinct classes but no values leak', async () => {
    const hidden = await read(async () =>
      jsonResponse(404, apiError('NOT_FOUND')),
    );
    const visibleUnassigned = await read(async () =>
      jsonResponse(403, apiError('FORBIDDEN')),
    );
    expect(hidden.resource).toBeNull();
    expect(hidden.etag).toBeNull();
    expect(hidden.errorDetails).toEqual([]);
    expect(visibleUnassigned.resource).toBeNull();
    expect(visibleUnassigned.etag).toBeNull();
    expect(visibleUnassigned.errorDetails).toEqual([]);
  });

  it('treats a network failure as degraded and never claims success', async () => {
    const result = await read(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(result.outcome).toBe('degraded');
    expect(result.status).toBeNull();
    expect(result.resource).toBeNull();
  });

  it('surfaces Retry-After only for a rate-limited read', async () => {
    const limited = await read(async () =>
      jsonResponse(429, apiError('RATE_LIMITED'), { 'retry-after': '9' }),
    );
    expect(limited.retryAfterSeconds).toBe(9);
  });
});

describe('cmsEditorialDraftDetailEtagFrom', () => {
  it('accepts only the bounded entry-and-revision validator', () => {
    expect(
      cmsEditorialDraftDetailEtagFrom(new Headers({ etag: draftDetailEtag() })),
    ).toBe(draftDetailEtag());
    expect(
      cmsEditorialDraftDetailEtagFrom(
        new Headers({ etag: `W/${draftDetailEtag()}` }),
      ),
    ).toBeNull();
    expect(
      cmsEditorialDraftDetailEtagFrom(new Headers({ etag: '"7"' })),
    ).toBeNull();
    expect(cmsEditorialDraftDetailEtagFrom(new Headers())).toBeNull();
  });
});
