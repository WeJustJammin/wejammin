import { describe, expect, it, vi } from 'vitest';

import {
  CONTENT_SCHEMA_REGISTRY_LOADING_DELAY_MS,
  CONTENT_SCHEMA_REGISTRY_MAX_RETRIES,
  CONTENT_SCHEMA_REGISTRY_RETRY_DELAYS_MS,
  executeContentSchemaRegistryMutation,
  executeContentSchemaRegistryRead,
  parseContentSchemaRegistryRetryAfter,
} from './content-schema-registry-runtime';

const idempotencyKey = 'cms-schema-cms-03a-01-request-123';

const formDataWithKey = (): FormData => {
  const form = new FormData();
  form.set('idempotency-key', idempotencyKey);
  form.set('typeKey', 'release_note');
  return form;
};

describe('content schema registry runtime retry contract', () => {
  it('exposes the locked loading and bounded retry timings', () => {
    expect(CONTENT_SCHEMA_REGISTRY_LOADING_DELAY_MS).toBe(250);
    expect(CONTENT_SCHEMA_REGISTRY_MAX_RETRIES).toBe(2);
    expect(CONTENT_SCHEMA_REGISTRY_RETRY_DELAYS_MS).toEqual([250, 750]);
  });

  it.each([
    ['5', 5],
    ['0', 0],
    ['Wed, 21 Oct 2015 07:28:00 GMT', 0],
    [null, null],
    ['not-a-delay', null],
  ] as const)('parses Retry-After %s safely', (header, expected) => {
    expect(
      parseContentSchemaRegistryRetryAfter(
        header,
        Date.parse('Wed, 21 Oct 2015 07:28:00 GMT'),
      ),
    ).toBe(expected);
  });

  it('asks for JSON on the first post because a manual-redirect fetch can never read a 303', async () => {
    let accept: string | null = null;
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        accept = new Headers(init?.headers).get('accept');
        return new Response('{}', {
          status: 303,
          headers: { location: '/next' },
        });
      },
    );
    await executeContentSchemaRegistryMutation({
      action: '/app/cms-content-modeling',
      operationId: 'CMS-03A-01',
      formData: formDataWithKey(),
      fetcher,
    });
    expect(accept).toContain('application/json');
  });

  it('[P2-S09-AC-201] [P2-S09-AC-253] replays a transient mutation with the same idempotency key and reconciles success', async () => {
    const requests: FormData[] = [];
    const methods: string[] = [];
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        methods.push(init?.method ?? 'GET');
        if (init?.method === 'POST') requests.push(init.body as FormData);
        return methods.length === 1
          ? new Response('{}', { status: 503 })
          : new Response('{}', {
              status: 303,
              headers: { location: '/next' },
            });
      },
    );
    const sleep = vi.fn(async () => undefined);

    const result = await executeContentSchemaRegistryMutation({
      action: '/app/cms-content-modeling',
      operationId: 'CMS-03A-01',
      formData: formDataWithKey(),
      fetcher,
      sleep,
    });

    expect(result).toMatchObject({
      outcome: 'success',
      attempts: 2,
      reconciled: true,
      statusChecks: 1,
      location: '/next',
    });
    expect(sleep).not.toHaveBeenCalled();
    expect(methods).toEqual(['POST', 'POST']);
    expect(requests).toHaveLength(2);
    expect(requests.map((body) => body.get('idempotency-key'))).toEqual([
      idempotencyKey,
      idempotencyKey,
    ]);
  });

  it('[P2-S09-AC-201] [P2-S09-AC-253] does not replay a 502 mutation response', async () => {
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Response('{}', { status: init?.method === 'POST' ? 502 : 200 }),
    );
    const result = await executeContentSchemaRegistryMutation({
      action: '/app/cms-content-modeling',
      operationId: 'CMS-03A-01',
      formData: formDataWithKey(),
      fetcher,
      sleep: vi.fn(async () => undefined),
    });

    expect(result).toMatchObject({
      outcome: 'degraded',
      attempts: 1,
      reconciled: false,
      statusChecks: 0,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('[P2-S09-AC-202] [P2-S09-AC-253] does not treat an arbitrary successful projection as mutation reconciliation', async () => {
    const methods: string[] = [];
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        methods.push(init?.method ?? 'GET');
        return new Response('{}', {
          status: init?.method === 'POST' ? 503 : 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    );

    const result = await executeContentSchemaRegistryMutation({
      action: '/app/cms-content-modeling',
      operationId: 'CMS-03A-01',
      formData: formDataWithKey(),
      fetcher,
      sleep: vi.fn(async () => undefined),
    });

    expect(result).toMatchObject({
      outcome: 'degraded',
      attempts: 2,
      reconciled: true,
      statusChecks: 1,
    });
    expect(methods).toEqual(['POST', 'POST']);
  });

  it('[P2-S09-AC-202] [P2-S09-AC-253] leaves an ambiguous mutation degraded after the bounded retries', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response('{}', {
          status: 504,
        }),
    );
    const sleep = vi.fn(async () => undefined);

    const result = await executeContentSchemaRegistryMutation({
      action: '/app/cms-content-modeling',
      operationId: 'CMS-03A-04',
      formData: formDataWithKey(),
      fetcher,
      sleep,
    });

    expect(result).toMatchObject({
      outcome: 'degraded',
      attempts: 2,
      reconciled: true,
    });
    expect(sleep).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-201] [P2-S09-AC-253] reconciles a network failure through one same-key mutation replay', async () => {
    const requests: FormData[] = [];
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          requests.push(init.body as FormData);
          if (requests.length === 1) throw new TypeError('network offline');
        }
        return new Response('{}', {
          status: 303,
          headers: { location: '/next' },
        });
      },
    );

    const result = await executeContentSchemaRegistryMutation({
      action: '/app/cms-content-modeling',
      operationId: 'CMS-03A-01',
      formData: formDataWithKey(),
      fetcher,
    });

    expect(result).toMatchObject({
      outcome: 'success',
      attempts: 2,
      reconciled: true,
      status: 303,
      statusChecks: 1,
      location: '/next',
    });
    expect(requests.map((body) => body.get('idempotency-key'))).toEqual([
      idempotencyKey,
      idempotencyKey,
    ]);
  });

  it('[P2-S09-AC-201] [P2-S09-AC-253] honors Retry-After for 429 without discarding the submitted input', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response('{}', { status: 429, headers: { 'retry-after': '9' } }),
    );

    const result = await executeContentSchemaRegistryMutation({
      action: '/app/cms-content-modeling',
      operationId: 'CMS-03A-01',
      formData: formDataWithKey(),
      fetcher,
    });

    expect(result).toMatchObject({
      outcome: 'rate-limited',
      attempts: 1,
      retryAfterSeconds: 9,
    });
    expect(result.formData.get('idempotency-key')).toBe(idempotencyKey);
  });

  it('uses a safe body currentVersion when a conflict has no ETag', async () => {
    const result = await executeContentSchemaRegistryMutation({
      action: '/app/cms-content-modeling',
      operationId: 'CMS-03A-02',
      formData: formDataWithKey(),
      fetcher: vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 'CONFLICT',
              message: 'The schema changed elsewhere.',
              requestId: '018f0c45-73fe-7dc2-9c09-68f7ecf132da',
              details: { expectedVersion: '4', currentVersion: '5' },
            }),
            { status: 409, headers: { 'content-type': 'application/json' } },
          ),
      ),
    });

    expect(result).toMatchObject({
      outcome: 'conflict',
      attempts: 1,
      serverVersion: '5',
    });
  });

  it('[P2-S09-AC-201] [P2-S09-AC-253] retries canonical reads without mutation headers', async () => {
    const fetcher = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(
        new Response('{}', {
          status: 503,
          headers: { 'x-content-schema-registry-retryable': 'true' },
        }),
      )
      .mockResolvedValueOnce(new Response('{"items":[]}', { status: 200 }));
    const sleep = vi.fn(async () => undefined);

    const result = await executeContentSchemaRegistryRead({
      url: '/app/cms-content-modeling?cursor=opaque',
      fetcher,
      sleep,
    });

    expect(result).toMatchObject({
      outcome: 'success',
      attempts: 2,
      retryable: false,
      retryAfterSeconds: null,
    });
    expect(sleep).toHaveBeenCalledWith(250);
    const init = fetcher.mock.calls[0]?.[1];
    expect(init?.method).toBe('GET');
    expect((init?.headers as Headers).get('idempotency-key')).toBeNull();
    expect((init?.headers as Headers).get('if-match')).toBeNull();
  });

  it.each([502, 503, 504] as const)(
    'does not retry a %s read without the server retry proof',
    async (status) => {
      const fetcher = vi
        .fn<
          (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
        >()
        .mockResolvedValueOnce(new Response('{}', { status }))
        .mockResolvedValueOnce(new Response('{"items":[]}', { status: 200 }));
      const sleep = vi.fn(async () => undefined);

      const result = await executeContentSchemaRegistryRead({
        url: '/app/cms-content-modeling',
        fetcher,
        sleep,
      });

      expect(result).toMatchObject({
        outcome: 'degraded',
        attempts: 1,
        retryable: false,
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    },
  );

  it('[P2-S09-AC-253] preserves Retry-After on a rate-limited canonical read', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response('{}', { status: 429, headers: { 'retry-after': '9' } }),
    );
    const result = await executeContentSchemaRegistryRead({
      url: '/app/cms-content-modeling',
      fetcher,
    });

    expect(result).toMatchObject({
      outcome: 'degraded',
      attempts: 1,
      retryable: false,
      retryAfterSeconds: 9,
    });
    expect(result.response?.headers.get('retry-after')).toBe('9');
  });
});
