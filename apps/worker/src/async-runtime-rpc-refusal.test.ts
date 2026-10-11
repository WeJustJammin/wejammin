import { describe, expect, it, vi } from 'vitest';

import {
  AsyncRpcDependencyError,
  AsyncRpcRefusalError,
} from './async-runtime-rpc-errors';
import { createSupabaseRpc } from './async-runtime-rpc-transport';

/*
 * A database refusal is `RAISE EXCEPTION '<token>' USING ERRCODE = 'P0001'`;
 * PostgREST answers it as an HTTP 4xx with `{ code: 'P0001', message: '<token>' }`.
 * The transport keeps every non-2xx a retryable `http_error` dependency failure
 * (so every existing caller behaves as before) but, for that one closed shape,
 * hands the caller the token as a typed refusal. Nothing else from the body ever
 * crosses: free text, other SQLSTATEs, oversized or unparseable bodies stay an
 * opaque `http_error`, so no upstream payload can reach a log line or a message.
 */

const env = {
  SUPABASE_URL: 'https://refusal.example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_refusal_test_only',
};

const rpcFor = (response: () => Response) =>
  createSupabaseRpc(vi.fn(async () => response()));

const call = (response: () => Response) =>
  rpcFor(response)(env, 'cms_execute_publication_schedule', {}).then(
    () => {
      throw new Error('the call must fail');
    },
    (error: unknown) => error,
  );

const postgrest =
  (body: unknown, status = 400) =>
  () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

describe('a database refusal token through the RPC transport', () => {
  it('surfaces a P0001 token as a typed refusal that is still a retryable http_error dependency failure', async () => {
    const error = await call(
      postgrest({
        code: 'P0001',
        details: null,
        hint: null,
        message: 'preflight_evidence_stale',
      }),
    );
    expect(error).toBeInstanceOf(AsyncRpcRefusalError);
    expect(error).toBeInstanceOf(AsyncRpcDependencyError);
    expect(error).toMatchObject({
      name: 'AsyncRpcRefusalError',
      refusal: 'preflight_evidence_stale',
      reason: 'http_error',
      disposition: 'dependency_unavailable',
      retryable: true,
      code: 'DEPENDENCY_UNAVAILABLE',
    });
    expect((error as Error).message).toBe(
      'Supabase RPC dependency is unavailable.',
    );
  });

  it.each([
    ['an uppercase application code', 'CONFLICT', 'CONFLICT'],
    ['a lowercase reason token', 'version_set_stale', 'version_set_stale'],
  ])('accepts %s', async (_name, message, expected) => {
    const error = await call(postgrest({ code: 'P0001', message }));
    expect(error).toMatchObject({ refusal: expected });
  });

  it.each([
    ['free text', { code: 'P0001', message: 'stale proof for tenant 42' }],
    ['a token over 64 characters', { code: 'P0001', message: 'a'.repeat(65) }],
    ['a non-P0001 SQLSTATE', { code: '23505', message: 'duplicate_key' }],
    ['a PostgREST error code', { code: 'PGRST202', message: 'not_found' }],
    ['a missing message', { code: 'P0001' }],
    ['a non-string message', { code: 'P0001', message: 7 }],
    ['an array', ['preflight_evidence_stale']],
    ['malformed JSON', 'postgres-error:sb_secret_refusal_test_only'],
    ['an empty body', ''],
  ])(
    'keeps %s an opaque http_error without leaking the body',
    async (_n, body) => {
      const error = await call(postgrest(body));
      expect(error).not.toBeInstanceOf(AsyncRpcRefusalError);
      expect(error).toMatchObject({
        name: 'AsyncRpcDependencyError',
        reason: 'http_error',
        retryable: true,
      });
      expect(JSON.stringify(error)).not.toContain('refusal_test_only');
      expect((error as Error).message).not.toContain('tenant');
    },
  );

  it('keeps an oversized error body an opaque http_error', async () => {
    const error = await call(
      postgrest({
        code: 'P0001',
        message: 'preflight_evidence_stale',
        details: 'x'.repeat(64 * 1024),
      }),
    );
    expect(error).not.toBeInstanceOf(AsyncRpcRefusalError);
    expect(error).toMatchObject({ reason: 'http_error' });
  });

  it('keeps a 5xx with a token body a plain http_error: only a client refusal is a refusal', async () => {
    const error = await call(
      postgrest({ code: 'P0001', message: 'preflight_evidence_stale' }, 503),
    );
    expect(error).not.toBeInstanceOf(AsyncRpcRefusalError);
    expect(error).toMatchObject({ reason: 'http_error' });
  });

  it('does not read the body of a successful response differently: a 200 still parses as before', async () => {
    const rpc = rpcFor(() => Response.json({ ok: true }));
    await expect(
      rpc(env, 'cms_execute_publication_schedule', {}),
    ).resolves.toEqual({ ok: true });
  });
});
