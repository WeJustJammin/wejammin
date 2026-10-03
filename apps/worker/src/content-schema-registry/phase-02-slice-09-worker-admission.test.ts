import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  expectApiError,
  jsonRequest,
  makeHarness,
  mutationPath,
  releaseHeaders,
  releaseRequest,
} from './phase-02-slice-09-worker-test-support';
import {
  API_ORIGIN,
  CMS_ORIGIN,
  RELEASE_ORIGIN,
  USER_ID,
  PARTY_ID,
  REQUEST_ID,
  HASH,
  session,
  validDraft,
  validField,
  validRelation,
  validActivation,
  validBlock,
  ok,
  error,
} from './phase-02-slice-09-test-values';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('S09 worker content-schema-registry admission', () => {
  it('ignores forged actor, party, role, and capability headers', async () => {
    const harness = makeHarness({
      session: ok({ ...session, capabilities: [] }),
    });
    await expectApiError(
      await harness.app.request(
        jsonRequest('/api/v1/cms/content-types', validDraft, {
          'x-actor-id': USER_ID,
          'x-acting-party-id': PARTY_ID,
          'x-capability': 'cms.schema_designer',
          'x-role': 'schema_designer',
        }),
      ),
      403,
      'FORBIDDEN',
    );
    expect(harness.ports.createTypeDraft).not.toHaveBeenCalled();
  });

  it('parses media and body before authentication and rejects malformed JSON safely', async () => {
    const harness = makeHarness({ session: error(401, 'UNAUTHENTICATED') });
    const response = await harness.app.request(
      new Request(`${API_ORIGIN}/api/v1/cms/content-types`, {
        method: 'POST',
        headers: {
          origin: CMS_ORIGIN,
          authorization: 'Bearer missing',
          'content-type': 'text/plain',
          'idempotency-key': 'cms-test-key-001',
          'x-request-id': REQUEST_ID,
        },
        body: '{not-json}',
      }),
    );
    await expectApiError(response, 415, 'UNSUPPORTED_MEDIA_TYPE');
    expect(harness.resolveSession).not.toHaveBeenCalled();
  });

  it('rejects oversized JSON before calling auth or a port', async () => {
    const harness = makeHarness();
    const response = await harness.app.request(
      new Request(`${API_ORIGIN}/api/v1/cms/content-types`, {
        method: 'POST',
        headers: {
          origin: CMS_ORIGIN,
          authorization: 'Bearer verified-session',
          'content-type': 'application/json',
          'content-length': String(256 * 1024 + 1),
          'idempotency-key': 'cms-test-key-001',
          'x-request-id': REQUEST_ID,
        },
      }),
    );
    await expectApiError(response, 413, 'PAYLOAD_TOO_LARGE');
    expect(harness.resolveSession).not.toHaveBeenCalled();
    expect(harness.ports.createTypeDraft).not.toHaveBeenCalled();
  });

  it.each([
    [
      'CMS-03A-01',
      '/api/v1/cms/content-types',
      validDraft,
      'createTypeDraft',
      false,
    ],
    ['CMS-03A-02', mutationPath.field, validField, 'addFieldDefinition', true],
    ['CMS-03A-03', mutationPath.relation, validRelation, 'bindRelation', true],
    [
      'CMS-03A-04',
      mutationPath.activate,
      validActivation,
      'activateSchema',
      true,
    ],
  ] as const)(
    'requires Idempotency-Key and exact strong If-Match for $0',
    async (_operation, path, body, port, ifMatchRequired) => {
      const harness = makeHarness();
      const missing = await harness.app.request(
        jsonRequest(path, body, { 'idempotency-key': '' }),
      );
      await expectApiError(missing, 400, 'INVALID_REQUEST');
      expect(harness.ports[port]).not.toHaveBeenCalled();
      if (ifMatchRequired) {
        const weak = await harness.app.request(
          jsonRequest(path, body, { 'if-match': 'W/"1"' }),
        );
        await expectApiError(weak, 400, 'INVALID_REQUEST');
        expect(harness.ports[port]).not.toHaveBeenCalled();
      }
    },
  );

  it('hands every idempotent human command to the RPC, which owns the replay and the mismatch refusal', async () => {
    const harness = makeHarness();
    const first = await harness.app.request(
      jsonRequest('/api/v1/cms/content-types', validDraft),
    );
    const second = await harness.app.request(
      jsonRequest('/api/v1/cms/content-types', validDraft),
    );
    const changed = await harness.app.request(
      jsonRequest('/api/v1/cms/content-types', {
        ...validDraft,
        label: 'Changed',
      }),
    );
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(changed.status).toBe(201);
    // The Worker holds no replay binding: the database answers the retry and
    // refuses the mismatch (see phase-02-slice-09-r8-db-errors.test.ts).
    expect(harness.ports.createTypeDraft).toHaveBeenCalledTimes(3);
  });

  it('applies cookie CSRF to human mutations after session and capability admission', async () => {
    const harness = makeHarness();
    const response = await harness.app.request(
      jsonRequest('/api/v1/cms/content-types', validDraft, {
        cookie: 'wj_session_ref=session; wj_csrf=server-token',
        'x-csrf-token': 'wrong-token',
      }),
    );
    await expectApiError(response, 403, 'FORBIDDEN');
    expect(harness.ports.createTypeDraft).not.toHaveBeenCalled();
  });

  it.each([
    ['unknown release header', { 'x-release-principal': 'forged' }],
    ['missing signature', { 'X-WeJammin-Release-Signature': '' }],
    ['internal alias', { keyId: 'release-key-1' }],
  ] as const)(
    'rejects %s before JSON parsing and port invocation',
    async (_label, headers) => {
      const harness = makeHarness();
      const response = await harness.app.request(
        releaseRequest(
          '/api/v1/cms/blocks/versions',
          { invalid: true },
          headers,
        ),
      );
      await expectApiError(response, 400, 'INVALID_REQUEST');
      expect(harness.verifyRelease).not.toHaveBeenCalled();
      expect(harness.ports.registerBlock).not.toHaveBeenCalled();
    },
  );

  it('passes untouched release raw bytes and exact operation to the verifier before parsing', async () => {
    const harness = makeHarness();
    const raw = JSON.stringify(validBlock);
    const request = new Request(`${API_ORIGIN}/api/v1/cms/blocks/versions`, {
      method: 'POST',
      headers: {
        origin: RELEASE_ORIGIN,
        'content-type': 'application/json',
        'idempotency-key': 'release-test-key-001',
        'x-request-id': REQUEST_ID,
        ...releaseHeaders(),
      },
      body: raw,
    });
    const response = await harness.app.request(request);
    expect(response.status).toBe(201);
    expect(harness.verifyRelease.mock.calls[0]?.[0].rawBody).toEqual(
      new TextEncoder().encode(raw),
    );
    expect(harness.ports.registerBlock.mock.calls[0]?.[0].rawBody).toEqual(
      new TextEncoder().encode(raw),
    );
  });

  it('never grants browser authority to a release route', async () => {
    const harness = makeHarness();
    const response = await harness.app.request(
      releaseRequest('/api/v1/cms/blocks/versions', validBlock, {
        origin: CMS_ORIGIN,
        authorization: 'Bearer verified-session',
      }),
    );
    await expectApiError(response, 403, 'FORBIDDEN');
    expect(harness.verifyRelease).not.toHaveBeenCalled();
    expect(harness.ports.registerBlock).not.toHaveBeenCalled();
  });

  it('maps an invalid signed principal to worker-only WEBHOOK_REJECTED telemetry', async () => {
    const harness = makeHarness({
      release: error(401, 'WEBHOOK_REJECTED', 'Release authentication failed.'),
    });
    const response = await harness.app.request(
      releaseRequest('/api/v1/cms/blocks/versions', validBlock),
    );
    await expectApiError(response, 401, 'WEBHOOK_REJECTED');
    expect(harness.ports.registerBlock).not.toHaveBeenCalled();
  });

  it('requires the release capability even after a valid signature', async () => {
    const harness = makeHarness({
      release: ok({
        principalId: 'release-worker-1',
        keyId: 'release-key-1',
        capabilities: [],
        verifiedAt: '2026-09-02T12:00:00.000Z',
        rawBodyHash: HASH,
        signatureHash: HASH,
        nonceHash: HASH,
      }),
    });
    const response = await harness.app.request(
      releaseRequest('/api/v1/cms/blocks/versions', validBlock),
    );
    await expectApiError(response, 403, 'FORBIDDEN');
    expect(harness.ports.registerBlock).not.toHaveBeenCalled();
  });

  it('normalizes a malformed verified release principal as WEBHOOK_REJECTED', async () => {
    const harness = makeHarness({
      release: ok({} as never),
    });
    const response = await harness.app.request(
      releaseRequest('/api/v1/cms/blocks/versions', validBlock),
    );
    await expectApiError(response, 401, 'WEBHOOK_REJECTED');
    expect(harness.ports.registerBlock).not.toHaveBeenCalled();
  });

  it('normalizes a malformed human session as UNAUTHENTICATED', async () => {
    const harness = makeHarness({
      session: ok({} as never),
    });
    const response = await harness.app.request(
      jsonRequest('/api/v1/cms/content-types', validDraft),
    );
    await expectApiError(response, 401, 'UNAUTHENTICATED');
    expect(harness.ports.createTypeDraft).not.toHaveBeenCalled();
  });
});
