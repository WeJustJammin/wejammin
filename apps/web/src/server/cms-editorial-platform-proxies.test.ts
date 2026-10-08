import { describe, expect, it, vi } from 'vitest';

import { forwardCmsEditorialEntryCreateMutation } from './cms-editorial-platform-mutation';
import { forwardCmsEditorialEntryDraftDetailRead } from './cms-editorial-platform-reads';

/*
 * Transport-hygiene tests for the CMS-03B-10 create proxy and the CMS-03B-11
 * protected draft read. These assert what the proxy itself owns: fail-closed
 * configuration, same-origin and CSRF enforcement, bounded headers, and a
 * faithful relay of whatever upstream actually answers. The endpoint and
 * Worker route are tested separately; these tests do not prove hosted policy.
 */

const origin = 'https://app.example.test';
const uuid = '123e4567-e89b-42d3-a456-426614174000';
const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
const hash = 'a'.repeat(64);
const draftDetailEtag = `"${uuid}:1:${uuid2}:1:${hash}"`;
const instant = '2026-09-26T00:00:00Z';
const csrf = 'csrf-token-000000000001';
const idempotencyKey = 'idem-key-000000000001';

type Handler = (input: Request) => Promise<Response>;

const bindingWith = (handler: Handler): { fetch: Handler } => ({
  fetch: vi.fn(handler),
});

const post = (body: string, headers: Record<string, string> = {}): Request =>
  new Request(origin + '/app/cms-content-modeling/entries/new', {
    method: 'POST',
    body,
    headers: {
      cookie: 'wj_csrf=' + csrf,
      'x-csrf-token': csrf,
      'idempotency-key': idempotencyKey,
      // A string body would otherwise default to text/plain, which the create
      // proxy now refuses (AC049); the browser always declares JSON.
      'content-type': 'application/json',
      ...headers,
    },
  });

const get = (entryId: string): Request =>
  new Request(origin + '/app/cms-content-modeling/entries/' + entryId, {
    method: 'GET',
  });

const policy = {
  key: 'editorial.standard',
  version: '1',
  policyHash: hash,
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  requiredCapabilities: [],
  approvalEvidenceHash: hash,
} as const;

const validCreateBody = JSON.stringify({
  contentTypeId: uuid,
  contentTypeVersionId: uuid2,
  locale: 'en-US',
  changedPaths: [`/fields/${uuid2}`],
  values: { [uuid2]: { title: 'Hello' } },
  schemaArtifact: {
    id: uuid,
    contentTypeVersionId: uuid2,
    artifactHash: hash,
    compilerVersion: '1.0.0',
    zodContractRef: '03a.content-type-version.v1',
  },
  validatorRefs: [{ key: 'sanitize.rich_text', version: '3' }],
  workflowPolicy: policy,
  activationEvidence: policy,
});

const validDraftDetail = {
  entry: { id: uuid, version: '1', createdAt: instant, updatedAt: instant },
  revision: { id: uuid2, version: '1', createdAt: instant, updatedAt: instant },
  revisionNumber: '1',
  lifecycle: 'active',
  state: 'draft',
  locale: 'en-US',
  contentHash: hash,
  schemaVersionId: uuid2,
  validationState: 'valid',
  openConflict: null,
  fields: [],
  relations: [],
} as const;

const validCreateResource = {
  entry: { id: uuid, version: '1', createdAt: instant, updatedAt: instant },
  revision: { id: uuid2, version: '1', createdAt: instant, updatedAt: instant },
  revisionNumber: '1',
  lifecycle: 'active',
  state: 'draft',
  locale: 'en-US',
  contentHash: hash,
  validationState: 'valid',
} as const;

const jsonResponse = (body: unknown, init: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      etag: '"1"',
      ...(init.headers ?? {}),
    },
  });

const errorCode = async (response: Response): Promise<unknown> =>
  ((await response.json()) as { code?: unknown }).code;

const apiError = {
  code: 'NOT_FOUND',
  details: {},
  message: 'The requested entry is not available.',
  requestId: '11111111-1111-4111-8111-111111111111',
} as const;

describe('cms-editorial create proxy (CMS-03B-10)', () => {
  it('fails closed without a usable PLATFORM_API binding', async () => {
    const response = await forwardCmsEditorialEntryCreateMutation(
      post(validCreateBody),
      undefined,
    );
    expect(response.status).toBe(503);
    expect(await errorCode(response)).toBe('DEPENDENCY_UNAVAILABLE');
  });

  it('refuses a non-POST method without reaching upstream', async () => {
    const handler = vi.fn(async () => jsonResponse({}, { status: 201 }));
    const response = await forwardCmsEditorialEntryCreateMutation(
      new Request(origin + '/x', { method: 'GET' }),
      bindingWith(handler),
    );
    expect(response.status).toBe(503);
    expect(handler).not.toHaveBeenCalled();
  });

  it('refuses a cross-origin mutation', async () => {
    const response = await forwardCmsEditorialEntryCreateMutation(
      post(validCreateBody, { origin: 'https://evil.example.test' }),
      bindingWith(async () => jsonResponse({}, { status: 201 })),
    );
    expect(response.status).toBe(403);
  });

  it('requires the CSRF header to match the csrf cookie', async () => {
    const response = await forwardCmsEditorialEntryCreateMutation(
      post(validCreateBody, { 'x-csrf-token': 'a-different-token' }),
      bindingWith(async () => jsonResponse({}, { status: 201 })),
    );
    expect(response.status).toBe(403);
  });

  it('requires a bounded idempotency key', async () => {
    const response = await forwardCmsEditorialEntryCreateMutation(
      post(validCreateBody, { 'idempotency-key': 'short' }),
      bindingWith(async () => jsonResponse({}, { status: 201 })),
    );
    expect(response.status).toBe(400);
  });

  it('rejects a non-JSON body locally', async () => {
    const response = await forwardCmsEditorialEntryCreateMutation(
      post('not-json'),
      bindingWith(async () => jsonResponse({}, { status: 201 })),
    );
    expect(response.status).toBe(400);
  });

  it('rejects a schema-invalid body before it can reach upstream', async () => {
    const handler = vi.fn(async () => jsonResponse({}, { status: 201 }));
    const response = await forwardCmsEditorialEntryCreateMutation(
      post(JSON.stringify({ contentTypeId: 'not-a-uuid' })),
      bindingWith(handler),
    );
    expect(response.status).toBe(422);
    expect(handler).not.toHaveBeenCalled();
  });

  it('relays a 201 with its Location and never forwards If-Match', async () => {
    let forwarded: Request | null = null;
    const response = await forwardCmsEditorialEntryCreateMutation(
      post(validCreateBody),
      bindingWith(async (input) => {
        forwarded = input as Request;
        return jsonResponse(validCreateResource, {
          status: 201,
          headers: { location: '/api/v1/cms/entries/' + uuid },
        });
      }),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get('location')).toBe(
      '/api/v1/cms/entries/' + uuid,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    // CMS-03B-10 declares no If-Match member at all, so the proxy never
    // sends one upstream. A caller that supplies one is refused outright;
    // see cms-editorial-platform-proxies-hardening.test.ts.
    const sent = forwarded as Request | null;
    expect(sent?.headers.get('if-match')).toBeNull();
    expect(sent?.headers.get('idempotency-key')).toBe(idempotencyKey);
  });

  it('treats a 201 without a bounded Location as an invalid upstream', async () => {
    const response = await forwardCmsEditorialEntryCreateMutation(
      post(validCreateBody),
      bindingWith(async () => jsonResponse({ entry: {} }, { status: 201 })),
    );
    expect(response.status).toBe(502);
  });

  it('relays a genuine upstream ApiError unchanged', async () => {
    const response = await forwardCmsEditorialEntryCreateMutation(
      post(validCreateBody),
      bindingWith(async () =>
        jsonResponse(apiError, { status: 404, statusText: 'Not Found' }),
      ),
    );
    expect(response.status).toBe(404);
    expect(await errorCode(response)).toBe('NOT_FOUND');
  });

  it('collapses a malformed upstream error instead of relaying it', async () => {
    const response = await forwardCmsEditorialEntryCreateMutation(
      post(validCreateBody),
      bindingWith(
        async () => new Response('<html>gateway</html>', { status: 502 }),
      ),
    );
    expect(response.status).toBe(502);
    expect(await errorCode(response)).toBe('BAD_GATEWAY');
  });

  it('collapses an oversize upstream error instead of buffering it', async () => {
    // A real ApiError padded past the cap: relaying it would mean buffering an
    // unbounded upstream body, so it must collapse to the safe local error.
    const oversizeError = JSON.stringify({
      ...apiError,
      message: 'padded'.repeat(48_000),
    });
    const response = await forwardCmsEditorialEntryCreateMutation(
      post(validCreateBody),
      bindingWith(
        async () =>
          new Response(oversizeError, {
            status: 404,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );
    expect(response.status).toBe(404);
    // The padded upstream body is never relayed: the local safe message stands
    // in, so the request id is not the upstream one either.
    const relayed = (await response.json()) as {
      code?: string;
      message?: string;
      requestId?: string;
    };
    expect(relayed.code).toBe('NOT_FOUND');
    expect((relayed.message ?? '').length).toBeLessThan(100);
    expect(relayed.requestId).not.toBe(apiError.requestId);
  });
});

describe('cms-editorial draft-detail read proxy (CMS-03B-11)', () => {
  it('fails closed without a usable PLATFORM_API binding', async () => {
    const response = await forwardCmsEditorialEntryDraftDetailRead(
      get(uuid),
      undefined,
      uuid,
    );
    expect(response.status).toBe(503);
  });

  it('answers a malformed entry id as 400 INVALID_REQUEST without upstream (DEC-145)', async () => {
    const handler = vi.fn(async () =>
      jsonResponse(validDraftDetail, { status: 200 }),
    );
    const response = await forwardCmsEditorialEntryDraftDetailRead(
      get('not-a-uuid'),
      bindingWith(handler),
      'not-a-uuid',
    );
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe('INVALID_REQUEST');
    expect(handler).not.toHaveBeenCalled();
  });

  it('relays a 200 and preserves the strong ETag verbatim', async () => {
    const response = await forwardCmsEditorialEntryDraftDetailRead(
      get(uuid),
      bindingWith(async () =>
        jsonResponse(validDraftDetail, {
          status: 200,
          headers: { etag: draftDetailEtag },
        }),
      ),
      uuid,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe(draftDetailEtag);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it.each([
    '"7"',
    `"${uuid}:2:${uuid2}:1:${hash}"`,
    `"${uuid}:1:${uuid2}:2:${hash}"`,
    `"${uuid}:1:${uuid2}:1:short"`,
  ])(
    'refuses a draft validator not bound to the returned entry and revision: %s',
    async (etag) => {
      const response = await forwardCmsEditorialEntryDraftDetailRead(
        get(uuid),
        bindingWith(async () =>
          jsonResponse(validDraftDetail, { status: 200, headers: { etag } }),
        ),
        uuid,
      );
      expect(response.status).toBe(502);
    },
  );

  it('refuses a 200 that describes a different entry', async () => {
    const response = await forwardCmsEditorialEntryDraftDetailRead(
      get(uuid2),
      bindingWith(async () => jsonResponse(validDraftDetail, { status: 200 })),
      uuid2,
    );
    expect(response.status).toBe(502);
  });

  it('refuses a 200 that is not the strict draft resource', async () => {
    const response = await forwardCmsEditorialEntryDraftDetailRead(
      get(uuid),
      bindingWith(async () =>
        jsonResponse({ entry: { id: uuid } }, { status: 200 }),
      ),
      uuid,
    );
    expect(response.status).toBe(502);
  });

  it("relays the Worker's genuine not-found envelope while unserved", async () => {
    const response = await forwardCmsEditorialEntryDraftDetailRead(
      get(uuid),
      bindingWith(async () =>
        jsonResponse(apiError, { status: 404, statusText: 'Not Found' }),
      ),
      uuid,
    );
    expect(response.status).toBe(404);
    expect(await errorCode(response)).toBe('NOT_FOUND');
  });

  it('rejects mutation preconditions and read body/media claims before forwarding', async () => {
    const handler = vi.fn(async () =>
      jsonResponse(validDraftDetail, { status: 200 }),
    );
    const mutationHeaders = await forwardCmsEditorialEntryDraftDetailRead(
      new Request(origin + '/app/x?locale=en-US', {
        method: 'GET',
        headers: { 'if-match': '"3"', 'idempotency-key': idempotencyKey },
      }),
      bindingWith(handler),
      uuid,
    );
    expect(mutationHeaders.status).toBe(400);
    for (const [headers, status] of [
      [{ 'content-type': 'application/json' }, 415],
      [{ 'content-length': '1' }, 400],
      [{ 'transfer-encoding': 'chunked' }, 400],
    ] as const) {
      const response = await forwardCmsEditorialEntryDraftDetailRead(
        new Request(origin + '/app/x?locale=en-US', {
          method: 'GET',
          headers,
        }),
        bindingWith(handler),
        uuid,
      );
      expect(response.status).toBe(status);
      if (status === 415)
        expect(await response.json()).toMatchObject({
          message: 'A protected CMS read has no request media.',
        });
    }
    expect(handler).not.toHaveBeenCalled();
  });
});
