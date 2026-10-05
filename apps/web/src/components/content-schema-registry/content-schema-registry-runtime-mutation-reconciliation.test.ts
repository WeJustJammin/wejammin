import { describe, expect, it, vi } from 'vitest';

import {
  isAuthoritativeContentSchemaRegistryMutationResponse,
  reconcileContentSchemaRegistryMutation,
} from './content-schema-registry-runtime-mutation-reconciliation';

const ACTION = '/app/cms-content-modeling';
const OPERATION = 'CMS-03A-01';
const KEY = 'cms-schema-cms-03a-01-request-123';

const formData = (): FormData => {
  const form = new FormData();
  form.set('operationId', OPERATION);
  form.set('idempotency-key', KEY);
  form.set('typeKey', 'release_note');
  return form;
};

describe('content schema registry mutation reconciliation', () => {
  it('uses the existing mutation route and accepts its committed redirect', async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> =
      [];
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push(init === undefined ? { input } : { input, init });
        return new Response(null, {
          status: 303,
          headers: { location: '/app/cms-content-modeling/next' },
        });
      },
    );

    const result = await reconcileContentSchemaRegistryMutation(
      fetcher,
      ACTION,
      OPERATION,
      formData(),
      KEY,
    );

    expect(result.outcome).toBe('committed');
    expect(result.status).toBe(303);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.input).toBe(ACTION);
    expect(requests[0]?.init?.method).toBe('POST');
    expect((requests[0]?.init?.body as FormData).get('idempotency-key')).toBe(
      KEY,
    );
    const headers = requests[0]?.init?.headers as Headers;
    expect(headers.get('cache-control')).toBe('no-store');
    expect(headers.get('idempotency-key')).toBe(KEY);
    expect(headers.get('x-content-schema-registry-operation')).toBeNull();
    expect(headers.get('x-content-schema-registry-idempotency-key')).toBeNull();
  });

  it('[P2-S09-AC-202] keeps a pending dependency response fail-closed', async () => {
    const result = await reconcileContentSchemaRegistryMutation(
      vi.fn(async () => new Response('{}', { status: 504 })),
      ACTION,
      OPERATION,
      formData(),
      KEY,
    );

    expect(result).toMatchObject({ outcome: 'pending', status: 504 });
  });

  it('[P2-S09-AC-202] classifies a replay network failure as unknown', async () => {
    const result = await reconcileContentSchemaRegistryMutation(
      vi.fn(async () => {
        throw new TypeError('network unavailable');
      }),
      ACTION,
      OPERATION,
      formData(),
      KEY,
    );

    expect(result).toMatchObject({ outcome: 'unknown', status: null });
  });

  it('[P2-S09-AC-202] does not replay when the idempotency binding is incomplete', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 303 }));
    const result = await reconcileContentSchemaRegistryMutation(
      fetcher,
      ACTION,
      OPERATION,
      formData(),
      'different-key',
    );

    expect(result).toMatchObject({ outcome: 'unknown', status: null });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
    new Response(null, { status: 204 }),
  ])(
    'rejects an arbitrary 2xx response as non-authoritative',
    async (response) => {
      await expect(
        isAuthoritativeContentSchemaRegistryMutationResponse(
          ACTION,
          OPERATION,
          response,
        ),
      ).resolves.toBe(false);
    },
  );

  it('[P2-S09-AC-202] rejects an unknown operation even when a response looks successful', async () => {
    await expect(
      isAuthoritativeContentSchemaRegistryMutationResponse(
        ACTION,
        'unknown-operation',
        new Response('{}', {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ).resolves.toBe(false);
  });

  it('[P2-S09-AC-202] does not replay an unknown operation', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 303 }));

    await expect(
      reconcileContentSchemaRegistryMutation(
        fetcher,
        ACTION,
        'unknown-operation',
        formData(),
        KEY,
      ),
    ).resolves.toMatchObject({ outcome: 'unknown', status: null });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
