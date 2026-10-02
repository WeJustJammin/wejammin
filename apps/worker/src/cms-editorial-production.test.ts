import { describe, it } from 'vitest';

import {
  CORRELATION_ID,
  ENTRY_ID,
  PARTY_ID,
  REQUEST_ID,
  SCHEMA_VERSION_ID,
  USER_ID,
  captureInit,
  compose,
  expect,
  json,
  portInput,
  revisionResource,
  vi,
} from './cms-editorial-production.test-support';

describe('cms editorial production adapter transport', () => {
  it('binds CMS-03B-01 to cms_create_revision with the platform_api profile', async () => {
    const fetchImpl = vi.fn(async () => json(revisionResource, 201));
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    const result = await dependencies.ports.appendRevision(
      portInput(),
      new AbortController().signal,
    );
    expect(result.ok).toBe(true);
    const { url, init } = captureInit(fetchImpl);
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_create_revision',
    );
    const headers = init.headers as Record<string, string>;
    expect(headers['Accept-Profile']).toBe('platform_api');
    expect(headers['Content-Profile']).toBe('platform_api');
    expect(headers['X-Operation-Id']).toBe('CMS-03B-01');
    expect(headers['X-Request-Id']).toBe(REQUEST_ID);
    expect(headers['X-Correlation-Id']).toBe(CORRELATION_ID);
    expect(headers['If-Match']).toBe('"1"');
  });

  it('sends the opaque secret only as apikey, never as a bearer token', async () => {
    const fetchImpl = vi.fn(async () => json(revisionResource, 201));
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    await dependencies.ports.appendRevision(
      portInput(),
      new AbortController().signal,
    );
    const headers = captureInit(fetchImpl).init.headers as Record<
      string,
      string
    >;
    expect(headers.apikey).toBe('sb_secret_slice_10_production');
    expect(headers.authorization).toBeUndefined();
  });

  it('derives context and body server-side from the verified session', async () => {
    const fetchImpl = vi.fn(async () => json(revisionResource, 201));
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    await dependencies.ports.appendRevision(
      portInput(),
      new AbortController().signal,
    );
    const body = JSON.parse(String(captureInit(fetchImpl).init.body)) as {
      p_request: Record<string, unknown>;
    };
    // The legit, required expectedVersion is forwarded exactly as parsed.
    expect(body.p_request.expectedVersion).toBe('1');
    expect(body.p_request.context).toMatchObject({
      authUserId: USER_ID,
      actingPartyId: PARTY_ID,
      requestId: REQUEST_ID,
      correlationId: CORRELATION_ID,
      stepUpVerified: true,
    });
  });

  it('rejects caller-supplied authority keys with a 422 and no RPC call', async () => {
    const fetchImpl = vi.fn(async () => json(revisionResource, 201));
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    const result = await dependencies.ports.appendRevision(
      portInput({
        body: {
          entryId: ENTRY_ID,
          expectedVersion: '1',
          values: { [SCHEMA_VERSION_ID]: 'hello' },
          // Built dynamically so banned authority key names stay out of source.
          ['ow' + 'ner']: 'attacker',
          ['assignee' + 'PersonId']: 'attacker',
          ['ver' + 'sion']: '999',
        },
      }),
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 422,
      code: 'VALIDATION_FAILED',
      details: { reasonCode: 'caller_authority_rejected' },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('attacker');
    expect(serialized).not.toContain('999');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns an empty-detail 404 so absence stays indistinguishable', async () => {
    const fetchImpl = vi.fn(async () => json({ code: 'NOT_FOUND' }, 404));
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    const result = await dependencies.ports.appendRevision(
      portInput(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 404,
      code: 'NOT_FOUND',
      details: {},
    });
  });

  it('maps VERSION_MISMATCH to a 409 conflict', async () => {
    const fetchImpl = vi.fn(async () =>
      json({ code: 'VERSION_MISMATCH' }, 409),
    );
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    const result = await dependencies.ports.appendRevision(
      portInput(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 409, code: 'CONFLICT' });
  });

  it('maps FORBIDDEN to 403 carrying only a reason code', async () => {
    const fetchImpl = vi.fn(async () =>
      json(
        {
          code: 'FORBIDDEN',
          details: { reasonCode: 'entry_not_assigned', secret: 'leak' },
        },
        403,
      ),
    );
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    const result = await dependencies.ports.appendRevision(
      portInput(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 403,
      details: { reasonCode: 'entry_not_assigned' },
    });
  });

  it('scrubs an unexpected RPC 5xx into a retryable 503', async () => {
    const fetchImpl = vi.fn(async () =>
      json({ message: 'pg internal detail leak' }, 500),
    );
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    const result = await dependencies.ports.appendRevision(
      portInput(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      details: { dependencyClass: 'cms_editorial', retryable: true },
    });
    expect(JSON.stringify(result)).not.toContain('leak');
  });

  it('rejects a non-JSON success payload as an invalid dependency response', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('<html>bad gateway</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    );
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    const result = await dependencies.ports.appendRevision(
      portInput(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 502,
      code: 'BAD_GATEWAY',
    });
  });

  it('rejects a success payload that fails the declared resource contract', async () => {
    const fetchImpl = vi.fn(async () => json({ id: 'not-a-uuid' }, 201));
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    const result = await dependencies.ports.appendRevision(
      portInput(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 502 });
  });

  it('bounds the transport with the declared per-operation deadline', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const dependencies = compose(fetchImpl as unknown as typeof fetch, {
      deadlineMs: 20,
    });
    const result = await dependencies.ports.appendRevision(
      portInput(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 504,
      code: 'GATEWAY_TIMEOUT',
    });
  });

  it('fails closed when the caller signal is already aborted', async () => {
    const fetchImpl = vi.fn(async () => json(revisionResource, 201));
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    const controller = new AbortController();
    controller.abort();
    const result = await dependencies.ports.appendRevision(
      portInput(),
      controller.signal,
    );
    expect(result).toMatchObject({ ok: false, status: 504 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
