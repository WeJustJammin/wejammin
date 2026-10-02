import { describe, expect, it, vi } from 'vitest';

import { normalizeAuthProductionOptions } from '../authentication/production-configuration';
import { createAdminMfaResetPort } from './admin-mfa-reset-port';
import {
  RESET_ID,
  resetBody,
  resetResponse,
  stepUpAgo,
} from './admin-mfa-reset.test-support';
import {
  TARGET_ID,
  bindings,
  contextFor,
} from './phase-02-slice-08-worker.test-support';

const TARGET_AUTH_ID = 'abababab-abab-4bab-8bab-abababababab';
const FACTOR_A = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1';
const FACTOR_B = 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2';
const KEY = 'mfa-reset-0123456789';
const NOW = Date.parse('2026-10-02T14:00:00Z');

const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

type Reply = (url: string, init: RequestInit) => Response | Promise<Response>;

const begun = (patch: Readonly<Record<string, unknown>> = {}) => ({
  ...resetResponse({ state: 'reconciling', removedFactorCount: 0 }),
  targetAuthUserId: TARGET_AUTH_ID,
  pendingProviderFactorIds: [FACTOR_A, FACTOR_B],
  ...patch,
});

const build = (reply: Reply, clock = { now: NOW }) => {
  const calls: Array<Readonly<{ url: string; method: string; body: unknown }>> =
    [];
  const fetchImpl = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({
      url,
      method: String(init.method),
      body: init.body === undefined ? null : JSON.parse(String(init.body)),
    });
    return reply(url, init);
  });
  const config = normalizeAuthProductionOptions({
    environment: bindings,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    now: () => clock.now,
  });
  return { calls, fetchImpl, clock, port: createAdminMfaResetPort(config) };
};

const input = () => ({
  request: new Request('https://api.wejammin.test/api/v1/admin', {
    method: 'POST',
    headers: {
      'x-request-id': '11111111-1111-4111-8111-111111111111',
      authorization: 'Bearer caller-token-secret',
    },
  }),
  body: resetBody,
  session: stepUpAgo(30),
  requestContext: contextFor(['admin.identity.mfa_reset']),
  idempotencyKey: KEY,
});

const signal = new AbortController().signal;
const rpc = (calls: ReturnType<typeof build>['calls'], name: string) =>
  calls.find((call) => call.url.endsWith(`/rpc/${name}`));
const providerCalls = (calls: ReturnType<typeof build>['calls']) =>
  calls.filter((call) => call.url.includes('/auth/v1/admin/'));

const standard: Reply = (url) => {
  if (url.endsWith('/rpc/admin_mfa_factor_reset')) return json(begun());
  if (url.endsWith('/rpc/admin_mfa_factor_reset_settle'))
    return json(resetResponse({ removedFactorCount: 2 }));
  return json({}, 200);
};

describe('CFG-05B-06 production port', () => {
  it('reserves the reset, removes each provider factor with the operator credential, then settles', async () => {
    const { port, calls } = build(standard);
    const result = await port(input(), bindings, signal);
    expect(result).toEqual({
      ok: true,
      value: resetResponse({ removedFactorCount: 2 }),
    });
    expect(
      calls.map((call) => call.url.split('/').slice(-2).join('/')),
    ).toEqual([
      'rpc/admin_mfa_factor_reset',
      `factors/${FACTOR_A}`,
      `factors/${FACTOR_B}`,
      'rpc/admin_mfa_factor_reset_settle',
    ]);
    const begin = rpc(calls, 'admin_mfa_factor_reset');
    expect(begin?.body).toMatchObject({
      p_request: {
        targetPersonId: TARGET_ID,
        reason: resetBody.reason,
        idempotencyKey: KEY,
        context: { stepUpAt: expect.any(String) },
      },
    });
    expect(rpc(calls, 'admin_mfa_factor_reset_settle')?.body).toMatchObject({
      p_request: {
        resetId: RESET_ID,
        outcomes: [
          { providerFactorId: FACTOR_A, outcome: 'removed' },
          { providerFactorId: FACTOR_B, outcome: 'removed' },
        ],
      },
    });
  });

  it('uses only the service credential at the provider, never the caller token', async () => {
    const { port, fetchImpl, calls } = build(standard);
    await port(input(), bindings, signal);
    const provider = providerCalls(calls);
    expect(provider).toHaveLength(2);
    for (const call of provider) {
      expect(call.method).toBe('DELETE');
      expect(call.url).toBe(
        `https://staging.example.supabase.co/auth/v1/admin/users/${TARGET_AUTH_ID}/factors/${call.url.split('/').pop()}`,
      );
    }
    const serialized = JSON.stringify(fetchImpl.mock.calls);
    expect(serialized).not.toContain('caller-token-secret');
    const [, init] = fetchImpl.mock.calls.find(([url]) =>
      String(url).includes('/auth/v1/admin/'),
    ) as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({
      apikey: 'sb_secret_slice_08_worker_red',
    });
  });

  it('counts an already absent provider factor as removed', async () => {
    const { port, calls } = build((url) =>
      url.includes(FACTOR_A)
        ? json({ message: 'user not found' }, 404)
        : standard(url, {}),
    );
    await port(input(), bindings, signal);
    expect(rpc(calls, 'admin_mfa_factor_reset_settle')?.body).toMatchObject({
      p_request: {
        outcomes: [
          { providerFactorId: FACTOR_A, outcome: 'absent' },
          { providerFactorId: FACTOR_B, outcome: 'removed' },
        ],
      },
    });
  });

  it('settles a failed or ambiguous removal as failed and never resends', async () => {
    const { port, calls } = build((url) =>
      url.includes(FACTOR_A)
        ? json({}, 500)
        : url.endsWith('/rpc/admin_mfa_factor_reset_settle')
          ? json(resetResponse({ state: 'reconciling', removedFactorCount: 1 }))
          : standard(url, {}),
    );
    const result = await port(input(), bindings, signal);
    expect(result).toMatchObject({
      ok: true,
      value: { state: 'reconciling', removedFactorCount: 1 },
    });
    expect(
      providerCalls(calls).filter((c) => c.url.includes(FACTOR_A)),
    ).toHaveLength(1);
    expect(rpc(calls, 'admin_mfa_factor_reset_settle')?.body).toMatchObject({
      p_request: {
        outcomes: [
          { providerFactorId: FACTOR_A, outcome: 'failed' },
          { providerFactorId: FACTOR_B, outcome: 'removed' },
        ],
      },
    });
  });

  it('returns a replayed completed reset without touching the provider', async () => {
    const { port, calls } = build((url) =>
      url.endsWith('/rpc/admin_mfa_factor_reset')
        ? json(
            begun({
              state: 'completed',
              removedFactorCount: 2,
              pendingProviderFactorIds: [],
            }),
          )
        : json({}),
    );
    const result = await port(input(), bindings, signal);
    expect(result).toEqual({ ok: true, value: resetResponse() });
    expect(providerCalls(calls)).toEqual([]);
    expect(rpc(calls, 'admin_mfa_factor_reset_settle')).toBeUndefined();
  });

  it('never returns the Auth UUID or provider ids', async () => {
    const { port } = build((url) =>
      url.endsWith('/rpc/admin_mfa_factor_reset_settle')
        ? json({
            ...resetResponse(),
            targetAuthUserId: TARGET_AUTH_ID,
            pendingProviderFactorIds: [FACTOR_A],
          })
        : standard(url, {}),
    );
    const result = await port(input(), bindings, signal);
    expect(JSON.stringify(result)).not.toContain(TARGET_AUTH_ID);
    expect(JSON.stringify(result)).not.toContain(FACTOR_A);
  });

  it.each([
    ['TARGET_NOT_FOUND', 404],
    ['MFA_RESET_IN_PROGRESS', 409],
    ['IDEMPOTENCY_CONFLICT', 409],
    ['MFA_RESET_INVALID', 422],
    ['FORBIDDEN', 403],
    ['STEP_UP_REQUIRED', 401],
  ])(
    'maps the %s database refusal to %i before any provider call',
    async (message, status) => {
      const { port, calls } = build(() => json({ message }, 400));
      const result = await port(input(), bindings, signal);
      expect(result).toMatchObject({ ok: false, status, code: message });
      expect(providerCalls(calls)).toEqual([]);
    },
  );

  it('answers 503 IDENTITY_UNAVAILABLE when the identity database is down', async () => {
    const { port } = build(() => json({}, 500));
    expect(await port(input(), bindings, signal)).toMatchObject({
      ok: false,
      status: 503,
      code: 'IDENTITY_UNAVAILABLE',
    });
  });

  it('rejects a begin response that is not the reservation shape', async () => {
    const { port, calls } = build(() => json({ resetId: RESET_ID }));
    expect(await port(input(), bindings, signal)).toMatchObject({
      ok: false,
      status: 502,
    });
    expect(providerCalls(calls)).toEqual([]);
  });

  it('opens the breaker after five provider failures in a minute and leaves rows reconciling', async () => {
    const clock = { now: NOW };
    const { port, calls } = build(
      (url) =>
        url.includes('/auth/v1/admin/')
          ? json({}, 500)
          : url.endsWith('/rpc/admin_mfa_factor_reset_settle')
            ? json(
                resetResponse({ state: 'reconciling', removedFactorCount: 0 }),
              )
            : json(
                begun({
                  pendingProviderFactorIds: [FACTOR_A, FACTOR_B, FACTOR_A],
                }),
              ),
      clock,
    );
    await port(input(), bindings, signal);
    await port(input(), bindings, signal);
    const before = providerCalls(calls).length;
    expect(before).toBe(5);
    const open = await port(input(), bindings, signal);
    expect(open).toMatchObject({
      ok: false,
      status: 503,
      code: 'IDENTITY_UNAVAILABLE',
    });
    expect(providerCalls(calls)).toHaveLength(before);
    clock.now += 61_000;
    expect((await port(input(), bindings, signal)).ok).toBe(true);
  });

  it('treats a provider timeout as failed without a retry', async () => {
    vi.useFakeTimers();
    try {
      const { port, calls } = build((url, init) =>
        url.includes('/auth/v1/admin/')
          ? new Promise<Response>((_resolve, reject) => {
              init.signal?.addEventListener('abort', () =>
                reject(new DOMException('aborted', 'AbortError')),
              );
            })
          : url.endsWith('/rpc/admin_mfa_factor_reset_settle')
            ? json(
                resetResponse({ state: 'reconciling', removedFactorCount: 0 }),
              )
            : json(begun({ pendingProviderFactorIds: [FACTOR_A] })),
      );
      const pending = port(input(), bindings, signal);
      await vi.advanceTimersByTimeAsync(5_001);
      const result = await pending;
      expect(result).toMatchObject({
        ok: true,
        value: { state: 'reconciling' },
      });
      expect(providerCalls(calls)).toHaveLength(1);
      expect(rpc(calls, 'admin_mfa_factor_reset_settle')?.body).toMatchObject({
        p_request: { outcomes: [{ outcome: 'failed' }] },
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('CFG-05B-06 production composition', () => {
  it('is composed into the production platform configuration dependencies', async () => {
    const { createProductionPlatformConfigurationDependencies } =
      await import('./production');
    const dependencies = createProductionPlatformConfigurationDependencies({
      environment: bindings,
      fetchImpl: vi.fn() as never,
    });
    expect(typeof dependencies.resetMfaFactors).toBe('function');
  });
});
