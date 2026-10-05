import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseJsonBody,
  parseMutationHeaders,
  parseQuery,
  rejectReadMutationHeadersOrBody,
} from './admission';

import {
  expectError,
  makeHarness,
  jsonRequest,
  readRequest,
  releaseRequest,
} from './phase-02-slice-09-adversarial-test-support';
import {
  API_ORIGIN,
  CMS_ORIGIN,
  USER_ID,
  TYPE_ID,
  VERSION_ID,
  REQUEST_ID,
  SIGNATURE,
  validDraft,
  validBlock,
  ok,
  error,
} from './phase-02-slice-09-test-values';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('S09 adversarial worker admission errors', () => {
  it('[P2-S09-AC-216, P2-S09-AC-280] rejects malformed reads, mutation headers, and bodies without session or port calls', async () => {
    const mutationHeaders = await rejectReadMutationHeadersOrBody(
      readRequest(undefined, { 'idempotency-key': 'read-key-001' }),
    );
    expect(mutationHeaders).toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST',
    });

    const declaredBody = await rejectReadMutationHeadersOrBody(
      readRequest(undefined, { 'content-length': '1' }),
    );
    expect(declaredBody).toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST',
    });

    const harness = makeHarness();
    const response = await harness.app.request(
      readRequest(undefined, { 'if-match': '"1"' }),
    );
    await expectError(response, 400, 'INVALID_REQUEST');
    expect(harness.rateLimit).not.toHaveBeenCalled();
    expect(harness.ports.listContentTypes).not.toHaveBeenCalled();

    expect(
      parseMutationHeaders(
        jsonRequest('/api/v1/cms/content-types', validDraft, {
          'idempotency-key': 'x'.repeat(129),
        }),
        'CMS-03A-01',
      ),
    ).toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    expect(
      parseMutationHeaders(
        jsonRequest('/api/v1/cms/content-types', validDraft, {
          'if-match': '"1"',
        }),
        'CMS-03A-01',
      ),
    ).toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
  });

  it('[P2-S09-AC-216] keeps parser failures bounded and returns no executable error payload', async () => {
    const malformedJson = await parseJsonBody(
      new Request(`${API_ORIGIN}/api/v1/cms/content-types`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"typeKey": "article",',
      }),
      { safeParse: () => ({ success: false }) },
    );
    expect(malformedJson).toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST',
    });

    const unsupportedMedia = await parseJsonBody(
      new Request(`${API_ORIGIN}/api/v1/cms/content-types`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: '<script>alert(1)</script>',
      }),
      { safeParse: () => ({ success: true, data: {} }) },
    );
    expect(unsupportedMedia).toMatchObject({
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });

    const invalidQuery = parseQuery(
      readRequest(
        '/api/v1/cms/content-types?limit=101&ownerId=private&limit=102',
      ),
    );
    expect(invalidQuery).toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST',
    });
  });

  it('[P2-S09-AC-214, P2-S09-AC-217] rejects malformed port responses at the worker boundary with a safe 502', async () => {
    const harness = makeHarness();
    harness.ports.listContentTypes!.mockResolvedValueOnce(
      ok({ items: Array.from({ length: 101 }, () => {}), nextCursor: null }),
    );
    const response = await harness.app.request(readRequest());
    await expectError(response, 502, 'DEPENDENCY_UNAVAILABLE');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('[P2-S09-AC-214, P2-S09-AC-216] normalizes unexpected error codes/details and never reflects private diagnostics', async () => {
    const harness = makeHarness();
    harness.ports.listContentTypes!.mockResolvedValueOnce(
      error(500, 'DROP TABLE cms_private', 'select * from private', {
        ownerId: USER_ID,
        sql: 'select * from cms_private',
        stack: 'private stack',
      }),
    );
    const response = await harness.app.request(readRequest());
    const body = await expectError(response, 500, 'INTERNAL_ERROR');
    expect(body.message).toBe('An unexpected error occurred.');
    expect(body.details).toEqual({});
  });

  it('[P2-S09-AC-214, P2-S09-AC-216] covers authentication, concealed-resource, verifier, dependency, and route error branches safely', async () => {
    const unauthenticated = makeHarness({
      session: error(401, 'UNAUTHENTICATED', 'private auth detail', {
        ownerId: USER_ID,
        sql: 'private auth SQL',
      }),
    });
    await expectError(
      await unauthenticated.app.request(readRequest()),
      401,
      'UNAUTHENTICATED',
    );
    expect(unauthenticated.ports.listContentTypes).not.toHaveBeenCalled();

    const concealed = makeHarness();
    concealed.ports.getContentTypeVersion!.mockResolvedValueOnce(
      error(404, 'NOT_FOUND', 'private owner detail', { ownerId: USER_ID }),
    );
    await expectError(
      await concealed.app.request(
        readRequest(
          `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}`,
        ),
      ),
      404,
      'NOT_FOUND',
    );
    expect(concealed.ports.getContentTypeVersion).toHaveBeenCalledTimes(1);

    const unavailable = makeHarness({
      session: error(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'private dependency',
        {
          sql: 'private dependency SQL',
        },
        5,
      ),
    });
    const unavailableResponse = await unavailable.app.request(readRequest());
    await expectError(unavailableResponse, 503, 'DEPENDENCY_UNAVAILABLE');
    expect(unavailableResponse.headers.get('retry-after')).toBe('5');
    expect(unavailable.ports.listContentTypes).not.toHaveBeenCalled();

    const rejectedRelease = makeHarness({
      release: error(401, 'INVALID_SIGNATURE', 'private signature detail', {
        signature: SIGNATURE,
      }),
    });
    await expectError(
      await rejectedRelease.app.request(
        releaseRequest('/api/v1/cms/blocks/versions', validBlock),
      ),
      401,
      'WEBHOOK_REJECTED',
    );
    expect(rejectedRelease.ports.registerBlock).not.toHaveBeenCalled();

    const notFoundRoute = makeHarness();
    await expectError(
      await notFoundRoute.app.request(
        new Request(`${API_ORIGIN}/api/v1/cms/unknown`, {
          headers: { origin: CMS_ORIGIN, 'x-request-id': REQUEST_ID },
        }),
      ),
      404,
      'NOT_FOUND',
    );
  });
});
