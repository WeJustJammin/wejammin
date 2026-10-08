import { describe, expect, it, vi } from 'vitest';

import { submitCmsEditorialEntryCreate } from './cms-editorial-entry-create-submit';

const CONTENT_TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const CONTENT_TYPE_VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const REVISION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dd';
const FIELD_A = '018f0c45-73fe-7dc2-9c09-68f7ecf132e1';
const FIELD_B = '018f0c45-73fe-7dc2-9c09-68f7ecf132e2';
const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132e9';
const HASH = 'a'.repeat(64);
const INSTANT = '2026-10-05T00:00:00+00:00';
const CSRF_TOKEN = 'csrf-token';

const policy = {
  key: 'editorial.standard',
  version: '1',
  policyHash: HASH,
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  requiredCapabilities: [],
  approvalEvidenceHash: HASH,
} as const;

const prefill = {
  contentTypeId: CONTENT_TYPE_ID,
  contentTypeVersionId: CONTENT_TYPE_VERSION_ID,
  locale: 'en-US',
  schemaArtifact: {
    id: CONTENT_TYPE_ID,
    contentTypeVersionId: CONTENT_TYPE_VERSION_ID,
    artifactHash: HASH,
    compilerVersion: '1.0.0',
    zodContractRef: '03a.content-type-version.v1',
  },
  validatorRefs: [{ key: 'sanitize.rich_text', version: '3' }],
  workflowPolicy: policy,
  activationEvidence: policy,
} as const;

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const createdResource = () => ({
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

const createdResponse = (etag = '"1"') =>
  new Response(JSON.stringify(createdResource()), {
    status: 201,
    headers: {
      'content-type': 'application/json',
      location: `/api/v1/cms/entries/${ENTRY_ID}`,
      etag,
      'cache-control': 'no-store',
    },
  });

const apiError = (status: number, code: string, details: unknown = {}) =>
  new Response(
    JSON.stringify({ code, message: 'Safe.', requestId: REQUEST_ID, details }),
    { status, headers: { 'content-type': 'application/json' } },
  );

const submit = (
  fetcher: Fetcher,
  overrides: Partial<Parameters<typeof submitCmsEditorialEntryCreate>[0]> = {},
) =>
  submitCmsEditorialEntryCreate({
    prefill,
    values: { [FIELD_B]: 'Second', [FIELD_A]: 'First' },
    csrfToken: CSRF_TOKEN,
    idempotencyKey: 'create-key-1',
    fetcher,
    ...overrides,
  });

describe('submitCmsEditorialEntryCreate', () => {
  it('sends the real JSON command with CSRF and Idempotency-Key, no If-Match, and /fields/ pointers', async () => {
    let captured: RequestInit | undefined;
    const result = await submit(async (_input, init) => {
      captured = init;
      return createdResponse();
    });
    expect(result.status).toBe('created');
    if (result.status !== 'created') return;
    expect(result.entryId).toBe(ENTRY_ID);
    expect(result.location).toBe(`/api/v1/cms/entries/${ENTRY_ID}`);
    const headers = new Headers(captured?.headers);
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('x-csrf-token')).toBe(CSRF_TOKEN);
    expect(headers.get('idempotency-key')).toBe('create-key-1');
    expect(headers.get('if-match')).toBeNull();
    const body = JSON.parse(String(captured?.body)) as Record<string, unknown>;
    expect(body.contentTypeId).toBe(CONTENT_TYPE_ID);
    expect(body.values).toEqual({ [FIELD_A]: 'First', [FIELD_B]: 'Second' });
    // SQL accepts only ^/fields/<uuid>$; the former /values/<id> shape always
    // failed server-side. Pointers are sorted so one edit set is one request.
    expect(body.changedPaths).toEqual([
      `/fields/${FIELD_A}`,
      `/fields/${FIELD_B}`,
    ]);
    for (const authority of ['ownerId', 'assigneeId', 'actingPartyId'])
      expect(body).not.toHaveProperty(authority);
  });

  it('refuses without a CSRF token and never calls the network', async () => {
    const fetcher = vi.fn();
    const result = await submit(fetcher as unknown as Fetcher, {
      csrfToken: null,
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'refused' });
    if (result.status === 'refused') expect(result.message).toContain('CSRF');
  });

  it('refuses a create with no value at all before any network call', async () => {
    const fetcher = vi.fn();
    const result = await submit(fetcher as unknown as Fetcher, { values: {} });
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.status).toBe('refused');
  });

  it('refuses tampered prefill evidence before any network call', async () => {
    const fetcher = vi.fn();
    const result = await submit(fetcher as unknown as Fetcher, {
      prefill: {
        ...prefill,
        schemaArtifact: { ...prefill.schemaArtifact, artifactHash: 'forged' },
      },
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.status).toBe('refused');
  });

  it('reuses the key for the same request after a response that cannot be verified', async () => {
    const first = await submit(async () => createdResponse('W/"1"'));
    expect(first).toMatchObject({
      status: 'error',
      outcomeUnknown: true,
      idempotencyKey: 'create-key-1',
    });
    let replay = new Headers();
    const second = await submit(
      async (_input, init) => {
        replay = new Headers(init?.headers);
        return createdResponse();
      },
      {
        idempotencyKey: first.status === 'error' ? first.idempotencyKey : null,
      },
    );
    expect(second.status).toBe('created');
    expect(replay.get('idempotency-key')).toBe('create-key-1');
  });

  it('treats a lost response as an unknown outcome that keeps the key', async () => {
    const result = await submit(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(result).toMatchObject({
      status: 'error',
      outcomeUnknown: true,
      retryable: true,
      idempotencyKey: 'create-key-1',
    });
  });

  it('maps a typed 422 to the field it names and to fixed copy, never the server message', async () => {
    const result = await submit(async () =>
      apiError(422, 'VALIDATION_FAILED', {
        reasonCode: 'rich_text_not_canonical',
        violations: [
          { path: `/values/${FIELD_A}`, code: 'invalid_value', message: 'x' },
          { path: '/changedPaths/0', code: 'invalid_value', message: 'y' },
        ],
      }),
    );
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') return;
    expect(result.reasonCode).toBe('rich_text_not_canonical');
    expect(result.message).toContain('rich text');
    expect(result.message).not.toContain('Safe.');
    expect(result.violations).toEqual([
      { path: `/values/${FIELD_A}`, fieldId: FIELD_A },
      { path: '/changedPaths/0', fieldId: null },
    ]);
    // A definite refusal is a new logical create next time.
    expect(result.idempotencyKey).not.toBe('create-key-1');
  });

  it.each([
    [401, 'UNAUTHENTICATED', 'Sign in again'],
    [403, 'FORBIDDEN', 'cannot create'],
    [404, 'NOT_FOUND', 'not available'],
    [409, 'CONFLICT', 'Reload'],
  ])(
    'states a %i without leaking a server message',
    async (status, code, copy) => {
      const result = await submit(async () => apiError(status, code));
      expect(result.status).toBe('error');
      if (result.status !== 'error') return;
      expect(result.message).toContain(copy);
      expect(result.outcomeUnknown).toBe(false);
      expect(result.idempotencyKey).not.toBe('create-key-1');
    },
  );

  it('keeps the key and the wait for a rate-limited create', async () => {
    const result = await submit(
      async () =>
        new Response(
          JSON.stringify({
            code: 'RATE_LIMITED',
            message: 'Slow down.',
            requestId: REQUEST_ID,
            details: { retryAfterSeconds: 12 },
          }),
          {
            status: 429,
            headers: {
              'content-type': 'application/json',
              'retry-after': '12',
            },
          },
        ),
    );
    expect(result).toMatchObject({
      status: 'error',
      retryable: true,
      retryAfterSeconds: 12,
      idempotencyKey: 'create-key-1',
    });
  });

  it('treats a response the proxy marked outcome-unknown as unknown, keeping the key', async () => {
    // BE03b / lane I contract: x-cms-editorial-outcome: unknown means a commit
    // may be hidden behind this response (post-dispatch 5xx, unverifiable 2xx).
    const result = await submit(
      async () =>
        new Response(
          JSON.stringify({
            code: 'DEPENDENCY_UNAVAILABLE',
            message: 'x',
            requestId: REQUEST_ID,
            details: {},
          }),
          {
            status: 503,
            headers: {
              'content-type': 'application/json',
              'x-cms-editorial-outcome': 'unknown',
            },
          },
        ),
    );
    expect(result).toMatchObject({
      status: 'error',
      outcomeUnknown: true,
      idempotencyKey: 'create-key-1',
    });
    if (result.status === 'error')
      expect(result.message).toContain('could not be confirmed');
  });

  it('treats an unmarked 5xx as a definite refusal that created nothing', async () => {
    const result = await submit(async () =>
      apiError(503, 'DEPENDENCY_UNAVAILABLE'),
    );
    expect(result).toMatchObject({ status: 'error', outcomeUnknown: false });
    if (result.status !== 'error') return;
    expect(result.message).toContain('Nothing was created');
  });
});
