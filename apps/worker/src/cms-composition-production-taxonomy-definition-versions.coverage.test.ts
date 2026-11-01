import { describe, expect, it, vi } from 'vitest';

import {
  taxonomyDefinitionId,
  taxonomyDefinitionRequestId,
  taxonomySession,
} from './cms-composition/taxonomy-definition.test-support';
import {
  createTaxonomyDefinitionRpc,
  createTaxonomyDefinitionVersionsReader,
  type TaxonomyContextVerifier,
} from './cms-composition-production-taxonomy-definition-versions';
import type { TaxonomyBaseInput } from './cms-composition/taxonomy-definition-shared';

/*
 * BE03c taxonomy transport (161, 166-167, 1447): one named RPC per operation, one total deadline over headers and
 * body, no mutation retry, a typed envelope for every failure and never a thrown message.
 */

const configuration = (fetchImpl: typeof fetch) => ({
  baseUrl: 'https://supabase.example.test',
  secret: 'sb_secret_test_only',
  fetchImpl,
  maxResponseBytes: 256 * 1024,
  now: () => 0,
});
const versionsUrl = `https://api.example.test/api/v1/cms/taxonomies/${taxonomyDefinitionId}/versions`;
const baseInput = (request?: Request): TaxonomyBaseInput => ({
  operationId: 'cmsTaxonomyVersionsRead',
  request: request ?? new Request(versionsUrl),
  requestId: taxonomyDefinitionRequestId,
  session: taxonomySession,
});
const verified: TaxonomyContextVerifier = async () => ({
  ok: true,
  value: { authUserId: taxonomySession.userId },
});
const isAny = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createTaxonomyDefinitionRpc deadline and fault handling', () => {
  it('answers a 504 with Retry-After 5 for a caller that already aborted, before verifying or sending', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const verify = vi.fn(verified);
    const controller = new AbortController();
    controller.abort();
    const result = await createTaxonomyDefinitionRpc(
      configuration(fetchImpl),
      verify,
      8_000,
    )(baseInput(), {}, isAny, controller.signal);
    expect(result).toMatchObject({
      ok: false,
      status: 504,
      retryAfterSeconds: 5,
    });
    expect(verify).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('answers a retryable 503 when the context verifier throws, and sends nothing', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await createTaxonomyDefinitionRpc(
      configuration(fetchImpl),
      async () => {
        throw new Error('provider private resolver detail');
      },
      8_000,
    )(baseInput(), {}, isAny, new AbortController().signal);
    expect(result).toMatchObject({
      ok: false,
      status: 503,
      retryAfterSeconds: 5,
    });
    expect(JSON.stringify(result)).not.toContain('provider private');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('answers a 504 and sends nothing when the deadline fires while the verifier is answering', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const controller = new AbortController();
    const result = await createTaxonomyDefinitionRpc(
      configuration(fetchImpl),
      async () => {
        controller.abort();
        return { ok: true, value: { authUserId: taxonomySession.userId } };
      },
      8_000,
    )(baseInput(), {}, isAny, controller.signal);
    expect(result).toMatchObject({
      ok: false,
      status: 504,
      retryAfterSeconds: 5,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('answers a 504 and sends nothing when the deadline fires in the instant the verifier settles', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const controller = new AbortController();
    // The verifier's answer is delivered, and the caller aborts before the transport resumes.
    const settling = {
      then: (resolve: (value: unknown) => void) => {
        resolve({ ok: true, value: { authUserId: taxonomySession.userId } });
        controller.abort();
      },
    };
    const result = await createTaxonomyDefinitionRpc(
      configuration(fetchImpl),
      (() => settling) as unknown as TaxonomyContextVerifier,
      8_000,
    )(baseInput(), {}, isAny, controller.signal);
    expect(result).toMatchObject({
      ok: false,
      status: 504,
      retryAfterSeconds: 5,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('answers a 504, not an answer, when the caller aborts while the response body is being read', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(
          new ReadableStream(
            {
              // Pulled by the first read of the body, after the headers were accepted.
              pull(stream) {
                controller.abort();
                stream.enqueue(new TextEncoder().encode('{"taxonomyId":"x"}'));
                stream.close();
              },
            },
            { highWaterMark: 0 },
          ),
          { headers: { 'content-type': 'application/json' } },
        ),
    );
    const validate = vi.fn(isAny);
    const result = await createTaxonomyDefinitionRpc(
      configuration(fetchImpl),
      verified,
      8_000,
    )(baseInput(), {}, validate as never, controller.signal);
    expect(result).toMatchObject({
      ok: false,
      status: 504,
      retryAfterSeconds: 5,
    });
    expect(validate).not.toHaveBeenCalled();
  });

  it('refuses a request payload over the 256 KiB ceiling with a 400 before any network', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await createTaxonomyDefinitionRpc(
      configuration(fetchImpl),
      verified,
      8_000,
    )(
      baseInput(),
      { taxonomyId: 'x'.repeat(256 * 1024) },
      isAny,
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('cancels the body of an answer that lands after the deadline, and a failing cancel stays silent', async () => {
    const cancelled = vi.fn(async () => {
      throw new Error('cancel failed');
    });
    let deliver!: (response: Response) => void;
    const fetchImpl = vi.fn<typeof fetch>(
      () => new Promise<Response>((resolve) => (deliver = resolve)),
    );
    const controller = new AbortController();
    const pending = createTaxonomyDefinitionRpc(
      configuration(fetchImpl),
      verified,
      8_000,
    )(baseInput(), {}, isAny, controller.signal);
    await settle();
    controller.abort();
    expect(await pending).toMatchObject({ ok: false, status: 504 });
    deliver(
      new Response(
        new ReadableStream({
          pull(stream) {
            stream.enqueue(new TextEncoder().encode('{}'));
          },
          cancel: cancelled,
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    );
    await settle();
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['is still running', false, 503],
    ['has already expired', true, 504],
  ] as const)(
    'maps an unexpected fault while the deadline %s to a scrubbed %s',
    async (_label, expired, status) => {
      const fetchImpl = vi.fn<typeof fetch>();
      const controller = new AbortController();
      const hostile = new Proxy(new Request(versionsUrl), {
        get(target, property, receiver) {
          if (property === 'headers') {
            if (expired) controller.abort();
            throw new Error('provider private header');
          }
          return Reflect.get(target, property, receiver) as unknown;
        },
      });
      const result = await createTaxonomyDefinitionRpc(
        configuration(fetchImpl),
        verified,
        8_000,
      )(baseInput(hostile), {}, isAny, controller.signal);
      expect(result).toMatchObject({
        ok: false,
        status,
        retryAfterSeconds: 5,
      });
      expect(JSON.stringify(result)).not.toContain('provider private');
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('answers 502 and cancels an unread body when the answer is not JSON, ignoring a failing cancel', async () => {
    const cancelled = vi.fn(async () => {
      throw new Error('cancel failed');
    });
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(
          new ReadableStream({
            pull(stream) {
              stream.enqueue(new TextEncoder().encode('<html>'));
            },
            cancel: cancelled,
          }),
          { headers: { 'content-type': 'text/html' } },
        ),
    );
    const result = await createTaxonomyDefinitionRpc(
      configuration(fetchImpl),
      verified,
      8_000,
    )(baseInput(), {}, isAny, new AbortController().signal);
    expect(result).toMatchObject({ ok: false, status: 502 });
    await settle();
    expect(cancelled).toHaveBeenCalledTimes(1);
  });
});

describe('cmsTaxonomyVersionsRead producer request shape', () => {
  const read = (input: Partial<ReturnType<typeof versionsInput>>) => {
    const rpc = vi.fn<
      (
        input: unknown,
        payload: unknown,
        validate: unknown,
        signal: unknown,
      ) => Promise<{ ok: boolean; status: number }>
    >(async () => ({ ok: false, status: 404 }));
    return {
      rpc,
      result: createTaxonomyDefinitionVersionsReader(rpc as never)(
        { ...versionsInput(), ...input } as never,
        new AbortController().signal,
      ),
    };
  };
  const versionsInput = (request = new Request(versionsUrl)) => ({
    ...baseInput(request),
    operationId: 'cmsTaxonomyVersionsRead' as const,
    taxonomyId: taxonomyDefinitionId,
  });

  it.each([
    ['another operation', { operationId: 'CMS-03C-16' as never }],
    ['a taxonomy id that is not a UUID', { taxonomyId: 'not-a-uuid' }],
    [
      'a method other than GET',
      { request: new Request(versionsUrl, { method: 'HEAD' }) },
    ],
    [
      'another path',
      {
        request: new Request(
          'https://api.example.test/api/v1/cms/taxonomies/other/versions',
        ),
      },
    ],
    ['a query string', { request: new Request(`${versionsUrl}?limit=1`) }],
    [
      'an If-Match header',
      {
        request: new Request(versionsUrl, { headers: { 'if-match': '"1"' } }),
      },
    ],
    [
      'an Idempotency-Key header',
      {
        request: new Request(versionsUrl, {
          headers: { 'idempotency-key': 'taxonomy-definition-red-001' },
        }),
      },
    ],
    [
      'a Content-Type header',
      {
        request: new Request(versionsUrl, {
          headers: { 'content-type': 'application/json' },
        }),
      },
    ],
    [
      'a non-zero Content-Length',
      {
        request: new Request(versionsUrl, {
          headers: { 'content-length': '2' },
        }),
      },
    ],
    [
      'a Transfer-Encoding header',
      {
        request: new Request(versionsUrl, {
          headers: { 'transfer-encoding': 'chunked' },
        }),
      },
    ],
  ])('answers a 400 without any RPC for %s', async (_label, override) => {
    const { rpc, result } = read(override);
    expect(await result).toMatchObject({ ok: false, status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('forwards the lineage id to the named producer for a well-formed request', async () => {
    const { rpc, result } = read({});
    expect(await result).toMatchObject({ ok: false, status: 404 });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]?.[1]).toEqual({
      taxonomyId: taxonomyDefinitionId,
    });
  });
});
