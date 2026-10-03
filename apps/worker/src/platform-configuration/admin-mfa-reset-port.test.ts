import { describe, expect, it, vi } from 'vitest';

import {
  FACTOR_A,
  FACTOR_B,
  KEY,
  NOW,
  TARGET_AUTH_ID,
  begun,
  build,
  input,
  json,
  providerCalls,
  rpc,
  signal,
  standard,
} from './admin-mfa-reset-port.test-support';
import {
  RESET_ID,
  resetBody,
  resetResponse,
} from './admin-mfa-reset.test-support';
import { TARGET_ID, bindings } from './phase-02-slice-08-worker.test-support';

describe('CFG-05B-06 production port', () => {
  it('[P2-S09-AC-894] reserves the reset, removes each provider factor with the operator credential, then settles', async () => {
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

  it('forwards CFG-05B-06 as the X-Operation-Id on both the reservation and the settlement', async () => {
    const { port, fetchImpl } = build(standard);
    await port(input(), bindings, signal);
    const operations = fetchImpl.mock.calls
      .filter(([url]) => String(url).includes('/rpc/'))
      .map(([url, init]) => ({
        rpc: String(url).split('/rpc/')[1],
        operation: new Headers(init?.headers).get('x-operation-id'),
      }));
    expect(operations).toEqual([
      { rpc: 'admin_mfa_factor_reset', operation: 'CFG-05B-06' },
      { rpc: 'admin_mfa_factor_reset_settle', operation: 'CFG-05B-06' },
    ]);
  });

  it('forwards CFG-05B-06 when the reservation has nothing to remove', async () => {
    const { port, fetchImpl } = build((url) =>
      url.endsWith('/rpc/admin_mfa_factor_reset')
        ? json(begun({ pendingProviderFactorIds: [] }))
        : json({}),
    );
    await port(input(), bindings, signal);
    expect(
      new Headers(fetchImpl.mock.calls[0]?.[1]?.headers).get('x-operation-id'),
    ).toBe('CFG-05B-06');
  });

  it('[P2-S09-AC-915] uses only the service credential at the provider, never the caller token', async () => {
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

  it('[P2-S09-AC-894] counts an already absent provider factor as removed', async () => {
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

  it('[P2-S09-AC-894][P2-S09-AC-933] settles a failed or ambiguous removal as failed and never resends', async () => {
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

  it('[P2-S09-AC-932] opens the breaker after five provider failures in a minute and leaves rows reconciling', async () => {
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

  it('[P2-S09-AC-932] treats a provider timeout as failed without a retry', async () => {
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
