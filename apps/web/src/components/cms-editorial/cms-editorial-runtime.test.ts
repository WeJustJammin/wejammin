// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  applyCmsEditorialAcceptedRevision,
  cmsEditorialRetryAfterSecondsFrom,
  executeCmsEditorialRevisionMutation,
} from './cms-editorial-runtime';
import type { CmsEditorialEntryDraft } from './cms-editorial-types';

const FIELD_A = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dd';
const REVISION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132df';
const SCHEMA_VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132de';
const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132d9';

// `version` is the immutable revision snapshot's own version (always '1');
// `entryVersion` is the committed entry version and the only valid next
// If-Match (lane G contract: EntryRevisionResource.entryVersion).
const revisionResource = () => ({
  id: REVISION_ID,
  version: '1',
  entryVersion: '12',
  createdAt: '2026-09-26T12:00:00+00:00',
  updatedAt: '2026-09-26T12:00:00+00:00',
  state: 'draft',
  entryId: ENTRY_ID,
  revisionNumber: '5',
  schemaVersionId: SCHEMA_VERSION_ID,
  templateVersionId: null,
  taxonomyVersionIds: [],
  locale: 'en-US',
  contentHash: 'a'.repeat(64),
  parentRevisionIds: [],
  validationState: 'valid',
  conflictId: null,
});

const request = () => ({
  entryId: ENTRY_ID,
  baseRevision: '4',
  changedPaths: ['/fields/' + FIELD_A],
  values: { [FIELD_A]: 'hello there' },
  locale: 'en-US',
  expectedVersion: '11',
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

const submit = (
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  overrides: { readonly request?: unknown; readonly csrfToken?: string } = {},
) =>
  executeCmsEditorialRevisionMutation({
    path: '/api/v1/cms/entries/' + ENTRY_ID + '/revisions',
    request: (overrides.request ?? request()) as never,
    csrfToken: overrides.csrfToken ?? 'csrf-token',
    idempotencyKey: 'idem-key-1',
    fetcher,
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('executeCmsEditorialRevisionMutation request shape', () => {
  it('posts once to the CMS-03B-01 route with conditional and idempotency headers', async () => {
    let capturedUrl: RequestInfo | URL | null = null;
    let capturedInit: RequestInit | undefined;
    const result = await submit(async (input, init) => {
      capturedUrl = input;
      capturedInit = init;
      return jsonResponse(201, revisionResource());
    });

    expect(capturedUrl).toBe('/api/v1/cms/entries/' + ENTRY_ID + '/revisions');
    expect(capturedInit?.method).toBe('POST');
    expect(capturedInit?.credentials).toBe('same-origin');
    expect(capturedInit?.redirect).toBe('manual');
    const headers = new Headers(capturedInit?.headers);
    expect(headers.get('accept')).toBe('application/json');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('x-csrf-token')).toBe('csrf-token');
    expect(headers.get('idempotency-key')).toBe('idem-key-1');
    expect(headers.get('if-match')).toBe('"11"');
    expect(JSON.parse(String(capturedInit?.body))).toEqual(request());
    expect(result.outcome).toBe('success');
    expect(result.status).toBe(201);
    expect(result.outcomeUnknown).toBe(false);
    expect(result.errorCode).toBeNull();
    expect(result.retryable).toBe(false);
    expect(result.resource?.revisionNumber).toBe('5');
  });

  it('carries the caller-supplied CSRF token verbatim', async () => {
    let capturedInit: RequestInit | undefined;
    await submit(
      async (_input, init) => {
        capturedInit = init;
        return jsonResponse(201, revisionResource());
      },
      { csrfToken: 'rotated-token' },
    );
    expect(new Headers(capturedInit?.headers).get('x-csrf-token')).toBe(
      'rotated-token',
    );
  });

  it('treats a 200 response with a valid body as unverifiable, not success', async () => {
    const result = await submit(async () =>
      jsonResponse(200, revisionResource()),
    );
    expect(result.outcome).toBe('unknown');
    expect(result.status).toBe(200);
    expect(result.outcomeUnknown).toBe(true);
    expect(result.resource).toBeNull();
    expect(result.retryable).toBe(false);
  });

  it('rejects a 201 whose resource belongs to a different entry', async () => {
    const result = await submit(async () =>
      jsonResponse(201, {
        ...revisionResource(),
        entryId: '018f0c45-73fe-7dc2-9c09-68f7ecf13299',
      }),
    );
    expect(result.outcome).toBe('unknown');
    expect(result.status).toBe(201);
    expect(result.outcomeUnknown).toBe(true);
  });

  it('rejects a 201 whose body is not a strict EntryRevisionResource', async () => {
    const result = await submit(async () => jsonResponse(201, { id: 'nope' }));
    expect(result.outcome).toBe('unknown');
    expect(result.outcomeUnknown).toBe(true);
  });

  it('rejects a 201 whose body is not JSON at all', async () => {
    const result = await submit(
      async () => new Response('ok', { status: 201 }),
    );
    expect(result.outcome).toBe('unknown');
    expect(result.outcomeUnknown).toBe(true);
  });

  it('blocks a locally invalid request before any network call', async () => {
    const fetcher = vi.fn(async () => jsonResponse(201, revisionResource()));
    const result = await submit(fetcher, {
      request: { ...request(), changedPaths: [] },
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.outcome).toBe('validation');
    expect(result.status).toBeNull();
    expect(result.errorCode).toBe('VALIDATION_FAILED');
    expect(result.errorDetails).toContain('changedPaths');
  });

  it('refuses a request whose values key is not a stable field UUID', async () => {
    const fetcher = vi.fn(async () => jsonResponse(201, revisionResource()));
    const result = await submit(fetcher, {
      request: { ...request(), values: { body: 'hello' } },
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.outcome).toBe('validation');
  });
});

describe('executeCmsEditorialRevisionMutation outcomes', () => {
  it.each([
    [400, 'INVALID_REQUEST', 'validation', false],
    [422, 'VALIDATION_FAILED', 'validation', false],
    [409, 'CONFLICT', 'conflict', false],
    [401, 'UNAUTHENTICATED', 'unauthenticated', false],
    [403, 'FORBIDDEN', 'forbidden', false],
    [404, 'NOT_FOUND', 'not-found', false],
    [415, 'UNSUPPORTED_MEDIA_TYPE', 'unsupported-media', false],
    [429, 'RATE_LIMITED', 'rate-limited', true],
    [502, 'BAD_GATEWAY', 'degraded', true],
    [503, 'DEPENDENCY_UNAVAILABLE', 'degraded', true],
    [500, 'INTERNAL_ERROR', 'degraded', true],
  ] as const)(
    'maps %i %s to a %s outcome with retryable=%s',
    async (status, code, outcome, retryable) => {
      const result = await submit(async () =>
        jsonResponse(
          status,
          {
            ...apiError(code),
            details: status === 429 ? { retryAfterSeconds: 7 } : {},
          },
          status === 429 ? { 'retry-after': '7' } : undefined,
        ),
      );
      expect(result.outcome).toBe(outcome);
      expect(result.status).toBe(status);
      expect(result.retryable).toBe(retryable);
      expect(result.outcomeUnknown).toBe(false);
    },
  );

  it('treats a network failure as an unknown outcome, never a success', async () => {
    const result = await submit(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(result.outcome).toBe('unknown');
    expect(result.status).toBeNull();
    expect(result.outcomeUnknown).toBe(true);
    expect(result.resource).toBeNull();
  });

  it('treats an opaque redirect refusal as an unknown outcome', async () => {
    const result = await submit(
      async () => new Response(null, { status: 302 }),
    );
    expect(result.outcomeUnknown).toBe(true);
    expect(result.outcome).toBe('unknown');
  });

  it('keeps the safe error code and field-level detail on a 422', async () => {
    const result = await submit(async () =>
      jsonResponse(422, {
        code: 'VALIDATION_FAILED',
        message: 'Request failed validation.',
        requestId: REQUEST_ID,
        details: {
          violations: [
            { path: '/values/' + FIELD_A, message: 'Too long.' },
            { path: '/baseRevision', message: 'Stale.' },
          ],
        },
      }),
    );
    expect(result.outcome).toBe('validation');
    expect(result.status).toBe(422);
    expect(result.errorCode).toBe('VALIDATION_FAILED');
    expect(result.errorDetails).toEqual([
      '/values/' + FIELD_A,
      '/baseRevision',
    ]);
  });

  it('keeps a typed reason token from the closed vocabulary and drops any other', async () => {
    const withReason = (reasonCode: unknown) =>
      submit(async () =>
        jsonResponse(422, {
          code: 'VALIDATION_FAILED',
          message: 'Request failed validation.',
          requestId: REQUEST_ID,
          details: {
            reasonCode,
            violations: [{ path: '/values/' + FIELD_A, code: 'x' }],
          },
        }),
      );
    expect((await withReason('rich_text_not_canonical')).reasonCode).toBe(
      'rich_text_not_canonical',
    );
    expect((await withReason('object_property_invalid')).reasonCode).toBe(
      'object_property_invalid',
    );
    // A foreign token, a non-string and markup never reach the UI copy.
    expect((await withReason('provider stack trace')).reasonCode).toBeNull();
    expect((await withReason('<script>')).reasonCode).toBeNull();
    expect((await withReason(42)).reasonCode).toBeNull();
    expect((await withReason(undefined)).reasonCode).toBeNull();
  });

  it('reports an unverifiable body as unknown when the proxy marked the outcome unknown', async () => {
    const marked = await submit(
      async () =>
        new Response('upstream exploded', {
          status: 502,
          headers: { 'x-cms-editorial-outcome': 'unknown' },
        }),
    );
    expect(marked.outcome).toBe('unknown');
    expect(marked.outcomeUnknown).toBe(true);
    expect(marked.errorDetails).toEqual([]);
    // A marker on any other value is not a marker.
    const other = await submit(async () =>
      jsonResponse(503, apiError('DEPENDENCY_UNAVAILABLE'), {
        'x-cms-editorial-outcome': 'definite',
      }),
    );
    expect(other.outcome).toBe('degraded');
    expect(other.outcomeUnknown).toBe(false);
  });

  it('ignores a non-ApiError body instead of echoing it to the UI', async () => {
    const result = await submit(async () =>
      jsonResponse(503, { message: 'upstream exploded' }),
    );
    expect(result.outcome).toBe('unknown');
    expect(result.outcomeUnknown).toBe(true);
    expect(result.errorCode).toBeNull();
    expect(result.errorDetails).toEqual([]);
  });

  it('does not report a stale-base conflict from an unverified 409', async () => {
    const result = await submit(async () =>
      jsonResponse(409, apiError('UNAUTHENTICATED')),
    );
    expect(result.outcome).toBe('unknown');
    expect(result.outcomeUnknown).toBe(true);
    expect(result.errorCode).toBeNull();
  });

  it('surfaces Retry-After only for a rate-limited response', async () => {
    const limited = await submit(async () =>
      jsonResponse(
        429,
        { ...apiError('RATE_LIMITED'), details: { retryAfterSeconds: 7 } },
        { 'retry-after': '7' },
      ),
    );
    expect(limited.retryAfterSeconds).toBe(7);

    const degraded = await submit(async () =>
      jsonResponse(503, apiError('DEPENDENCY_UNAVAILABLE'), {
        'retry-after': '7',
      }),
    );
    expect(degraded.retryAfterSeconds).toBeNull();
  });

  it('treats an invalid Retry-After as an unverified outcome', async () => {
    const result = await submit(async () =>
      jsonResponse(429, apiError('RATE_LIMITED'), { 'retry-after': 'soon' }),
    );
    expect(result.outcome).toBe('unknown');
    expect(result.outcomeUnknown).toBe(true);
    expect(result.retryAfterSeconds).toBeNull();
  });

  it('treats undeclared 413 as unknown', async () => {
    const result = await submit(async () =>
      jsonResponse(413, apiError('PAYLOAD_TOO_LARGE')),
    );
    expect(result.outcome).toBe('unknown');
    expect(result.outcomeUnknown).toBe(true);
  });

  it('rejects partial, fractional, signed, and unsafe Retry-After seconds', () => {
    for (const value of ['7junk', '1.5', '-1', '+7', '9007199254740992']) {
      expect(
        cmsEditorialRetryAfterSecondsFrom(
          new Headers({ 'retry-after': value }),
        ),
      ).toBeNull();
    }
    expect(
      cmsEditorialRetryAfterSecondsFrom(
        new Headers({ 'retry-after': ' 007 ' }),
      ),
    ).toBe(7);
  });
});

describe('applyCmsEditorialAcceptedRevision', () => {
  const draft: CmsEditorialEntryDraft = {
    entryId: ENTRY_ID,
    entryLifecycle: 'active',
    baseRevision: '4',
    expectedVersion: '11',
    locale: 'en-US',
    schemaVersionId: SCHEMA_VERSION_ID,
    fields: [],
  };

  it('advances the base revision and the ENTRY version together, never the revision snapshot version', () => {
    const next = applyCmsEditorialAcceptedRevision(
      draft,
      revisionResource() as never,
    );
    expect(next.baseRevision).toBe('5');
    // The resource's own `version` is '1'; adopting it would make the second
    // autosave a stale-version 409.
    expect(next.expectedVersion).toBe('12');
    expect(next.entryId).toBe(ENTRY_ID);
  });

  it('never mutates the draft it was given', () => {
    applyCmsEditorialAcceptedRevision(draft, revisionResource() as never);
    expect(draft.baseRevision).toBe('4');
    expect(draft.expectedVersion).toBe('11');
  });
});
