// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cmsEditorialEntryCreateRetainsIdempotencyKey,
  executeCmsEditorialEntryCreate,
} from './cms-editorial-entry-create-transport';

const CONTENT_TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const CONTENT_TYPE_VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const REVISION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dd';
const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132de';
const HASH = 'a'.repeat(64);
const INSTANT = '2026-09-26T12:00:00+00:00';
const PATH = '/api/v1/cms/entries';

const workflowPolicy = {
  key: 'editorial.standard',
  version: '1',
  policyHash: HASH,
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  requiredCapabilities: [],
  approvalEvidenceHash: HASH,
};

const createRequest = () => ({
  contentTypeId: CONTENT_TYPE_ID,
  contentTypeVersionId: CONTENT_TYPE_VERSION_ID,
  locale: 'en-US',
  changedPaths: ['/fields/' + CONTENT_TYPE_VERSION_ID],
  values: { [CONTENT_TYPE_VERSION_ID]: { title: 'Hello' } },
  schemaArtifact: {
    id: CONTENT_TYPE_ID,
    contentTypeVersionId: CONTENT_TYPE_VERSION_ID,
    artifactHash: HASH,
    compilerVersion: '1.0.0',
    zodContractRef: '03a.content-type-version.v1',
  },
  validatorRefs: [{ key: 'sanitize.rich_text', version: '3' }],
  workflowPolicy,
  activationEvidence: workflowPolicy,
});

const createResource = () => ({
  entry: { id: ENTRY_ID, version: '1', createdAt: INSTANT, updatedAt: INSTANT },
  revision: {
    id: REVISION_ID,
    version: '1',
    createdAt: INSTANT,
    updatedAt: INSTANT,
  },
  revisionNumber: '1',
  lifecycle: 'active',
  state: 'draft',
  locale: 'en-US',
  contentHash: HASH,
  validationState: 'valid',
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
  overrides: {
    readonly request?: unknown;
    readonly csrfToken?: string;
    readonly idempotencyKey?: string;
    readonly createIdempotencyKey?: () => string;
  } = {},
) =>
  executeCmsEditorialEntryCreate({
    path: PATH,
    request: (overrides.request ?? createRequest()) as never,
    csrfToken: overrides.csrfToken ?? 'csrf-token',
    idempotencyKey: overrides.idempotencyKey ?? 'idem-key-1',
    ...(overrides.createIdempotencyKey === undefined
      ? {}
      : { createIdempotencyKey: overrides.createIdempotencyKey }),
    fetcher,
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('executeCmsEditorialEntryCreate request shape', () => {
  it('posts once with Idempotency-Key and never If-Match', async () => {
    let capturedUrl: RequestInfo | URL | null = null;
    let capturedInit: RequestInit | undefined;
    const result = await submit(async (input, init) => {
      capturedUrl = input;
      capturedInit = init;
      return jsonResponse(201, createResource(), {
        location: '/api/v1/cms/entries/' + ENTRY_ID,
      });
    });

    expect(capturedUrl).toBe(PATH);
    expect(capturedInit?.method).toBe('POST');
    expect(capturedInit?.credentials).toBe('same-origin');
    expect(capturedInit?.redirect).toBe('manual');
    const headers = new Headers(capturedInit?.headers);
    expect(headers.get('idempotency-key')).toBe('idem-key-1');
    expect(headers.get('if-match')).toBeNull();
    expect(headers.get('x-csrf-token')).toBe('csrf-token');
    expect(JSON.parse(String(capturedInit?.body))).toEqual(createRequest());
    expect(result.outcome).toBe('success');
    expect(result.status).toBe(201);
    expect(result.location).toBe('/api/v1/cms/entries/' + ENTRY_ID);
    expect(result.resource?.entry.id).toBe(ENTRY_ID);
  });

  it('blocks a locally invalid body before any network call and keeps values', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse(201, createResource(), {
        location: '/api/v1/cms/entries/' + ENTRY_ID,
      }),
    );
    const sent = { ...createRequest(), changedPaths: [] };
    const result = await submit(fetcher, { request: sent });
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.outcome).toBe('validation');
    expect(result.status).toBeNull();
    expect(result.errorDetails).toContain('changedPaths');
    // Unsent values are returned untouched for the editor to restore.
    expect(result.request).toBe(sent);
  });

  it('refuses a caller-supplied authority field before any network call', async () => {
    const fetcher = vi.fn(async () => jsonResponse(201, createResource()));
    const result = await submit(fetcher, {
      request: { ...createRequest(), ownerId: ENTRY_ID },
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.outcome).toBe('validation');
  });
});

describe('executeCmsEditorialEntryCreate verification', () => {
  it('accepts a 201 only when the Location resolves to the returned entry', async () => {
    const mismatched = await submit(async () =>
      jsonResponse(201, createResource(), {
        location: '/api/v1/cms/entries/018f0c45-73fe-7dc2-9c09-68f7ecf13299',
      }),
    );
    expect(mismatched.outcome).toBe('unknown');
    expect(mismatched.outcomeUnknown).toBe(true);
    expect(mismatched.resource).toBeNull();
    expect(mismatched.location).toBeNull();
  });

  it('treats a 201 without a Location as unverifiable, not success', async () => {
    const result = await submit(async () =>
      jsonResponse(201, createResource()),
    );
    expect(result.outcome).toBe('unknown');
    expect(result.outcomeUnknown).toBe(true);
  });

  it('rejects a 201 whose body is not a strict EntryCreateResource', async () => {
    const result = await submit(async () =>
      jsonResponse(
        201,
        { entry: { id: 'nope' } },
        {
          location: '/api/v1/cms/entries/' + ENTRY_ID,
        },
      ),
    );
    expect(result.outcome).toBe('unknown');
    expect(result.resource).toBeNull();
  });

  it('treats a 200 with a valid body as unverifiable, not success', async () => {
    const result = await submit(async () =>
      jsonResponse(200, createResource(), {
        location: '/api/v1/cms/entries/' + ENTRY_ID,
      }),
    );
    expect(result.outcome).toBe('unknown');
    expect(result.status).toBe(200);
    expect(result.outcomeUnknown).toBe(true);
  });

  it('treats a non-JSON 201 as unverifiable', async () => {
    const result = await submit(
      async () =>
        new Response('created', {
          status: 201,
          headers: { location: '/api/v1/cms/entries/' + ENTRY_ID },
        }),
    );
    expect(result.outcome).toBe('unknown');
    expect(result.resource).toBeNull();
  });
});

describe('executeCmsEditorialEntryCreate outcomes', () => {
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
      expect(result.resource).toBeNull();
      expect(result.location).toBeNull();
    },
  );

  it('treats a network failure as unknown, never a success', async () => {
    const result = await submit(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(result.outcome).toBe('unknown');
    expect(result.status).toBeNull();
    expect(result.outcomeUnknown).toBe(true);
    expect(result.resource).toBeNull();
    expect(result.request).toEqual(createRequest());
  });

  it('treats an opaque redirect refusal as unknown', async () => {
    const result = await submit(
      async () => new Response(null, { status: 302 }),
    );
    expect(result.outcome).toBe('unknown');
    expect(result.outcomeUnknown).toBe(true);
  });

  it('keeps the safe error code and field detail on a 422', async () => {
    const result = await submit(async () =>
      jsonResponse(422, {
        code: 'VALIDATION_FAILED',
        message: 'Request failed validation.',
        requestId: REQUEST_ID,
        details: {
          violations: [{ path: '/values', message: 'Too long.' }],
        },
      }),
    );
    expect(result.errorCode).toBe('VALIDATION_FAILED');
    expect(result.errorDetails).toEqual(['/values']);
  });

  it('ignores a non-ApiError body instead of echoing it', async () => {
    const result = await submit(async () =>
      jsonResponse(503, { message: 'upstream exploded' }),
    );
    expect(result.outcome).toBe('unknown');
    expect(result.outcomeUnknown).toBe(true);
    expect(result.errorCode).toBeNull();
    expect(result.errorDetails).toEqual([]);
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

  it('treats undeclared 413 as unknown despite a plausible error body', async () => {
    const result = await submit(async () =>
      jsonResponse(413, apiError('PAYLOAD_TOO_LARGE')),
    );
    expect(result.outcome).toBe('unknown');
    expect(result.outcomeUnknown).toBe(true);
    expect(result.idempotencyKey).toBe('idem-key-1');
  });
});

describe('idempotency key lifecycle', () => {
  it.each([
    ['malformed 409', 409, { message: 'proxy failure' }, {}],
    ['mismatched 409', 409, apiError('UNAUTHENTICATED'), {}],
    [
      'mismatched 429 wait',
      429,
      { ...apiError('RATE_LIMITED'), details: { retryAfterSeconds: 8 } },
      { 'retry-after': '7' },
    ],
  ])(
    'keeps the create key when a %s is not verified',
    async (_label, status, body, headers) => {
      const nextKey = vi.fn(() => 'fresh-key');
      const result = await submit(
        async () => jsonResponse(status, body, headers),
        { createIdempotencyKey: nextKey },
      );
      expect(result.outcome).toBe('unknown');
      expect(result.outcomeUnknown).toBe(true);
      expect(result.idempotencyKey).toBe('idem-key-1');
      expect(result.resource).toBeNull();
      expect(nextKey).not.toHaveBeenCalled();
    },
  );

  it('retains the key through rate-limited, degraded, and unknown outcomes', () => {
    expect(cmsEditorialEntryCreateRetainsIdempotencyKey('rate-limited')).toBe(
      true,
    );
    expect(cmsEditorialEntryCreateRetainsIdempotencyKey('degraded')).toBe(true);
    expect(cmsEditorialEntryCreateRetainsIdempotencyKey('unknown')).toBe(true);
  });

  it('rotates the key after a definite refusal so a retry is a new create', () => {
    expect(cmsEditorialEntryCreateRetainsIdempotencyKey('conflict')).toBe(
      false,
    );
    expect(cmsEditorialEntryCreateRetainsIdempotencyKey('validation')).toBe(
      false,
    );
    expect(cmsEditorialEntryCreateRetainsIdempotencyKey('success')).toBe(false);
  });

  it('keeps the original key on an uncertain outcome', async () => {
    const result = await submit(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(result.idempotencyKey).toBe('idem-key-1');
  });

  it('mints a fresh key on a definite refusal', async () => {
    const result = await submit(
      async () => jsonResponse(409, apiError('CONFLICT')),
      { createIdempotencyKey: () => 'fresh-key' },
    );
    expect(result.outcome).toBe('conflict');
    expect(result.idempotencyKey).toBe('fresh-key');
  });
});
