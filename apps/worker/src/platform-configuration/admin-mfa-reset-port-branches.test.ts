import { describe, expect, it, vi } from 'vitest';

import {
  FACTOR_A,
  FACTOR_B,
  begun,
  build,
  input,
  json,
  providerCalls,
  rpc,
  signal,
  standard,
  type Reply,
} from './admin-mfa-reset-port.test-support';
import { resetResponse } from './admin-mfa-reset.test-support';
import { bindings } from './phase-02-slice-08-worker.test-support';

const abortable = (init: RequestInit): Promise<Response> =>
  new Promise<Response>((_resolve, reject) => {
    const abort = (): void => reject(new DOMException('aborted', 'AbortError'));
    if (init.signal?.aborted === true) abort();
    else init.signal?.addEventListener('abort', abort);
  });

const hangOnFirstFactor: Reply = (url, init) =>
  url.includes(FACTOR_A)
    ? abortable(init)
    : url.endsWith('/rpc/admin_mfa_factor_reset_settle')
      ? json(resetResponse({ state: 'reconciling', removedFactorCount: 1 }))
      : standard(url, init);

describe('CFG-05B-06 reservation and provider abort edges', () => {
  it('accepts a reservation with nothing pending and no Auth user id', async () => {
    const { port, calls } = build((url) =>
      url.endsWith('/rpc/admin_mfa_factor_reset')
        ? json({
            ...begun({ pendingProviderFactorIds: [] }),
            targetAuthUserId: undefined,
          })
        : json({}),
    );
    const result = await port(input(), bindings, signal);
    expect(result.ok).toBe(true);
    expect(providerCalls(calls)).toEqual([]);
  });

  it('settles a factor as failed when the caller signal is already aborted', async () => {
    const caller = new AbortController();
    caller.abort();
    const { port, calls } = build(hangOnFirstFactor);
    const result = await port(input(), bindings, caller.signal);
    expect(result.ok).toBe(true);
    expect(rpc(calls, 'admin_mfa_factor_reset_settle')?.body).toMatchObject({
      p_request: {
        outcomes: [
          { providerFactorId: FACTOR_A, outcome: 'failed' },
          { providerFactorId: FACTOR_B, outcome: 'removed' },
        ],
      },
    });
  });

  it('relays a caller abort that arrives while a provider removal is in flight', async () => {
    const caller = new AbortController();
    const { port, calls } = build(hangOnFirstFactor);
    const pending = port(input(), bindings, caller.signal);
    await vi.waitFor(() => expect(providerCalls(calls)).toHaveLength(1));
    caller.abort();
    const result = await pending;
    expect(result.ok).toBe(true);
    expect(rpc(calls, 'admin_mfa_factor_reset_settle')?.body).toMatchObject({
      p_request: {
        outcomes: [
          { providerFactorId: FACTOR_A, outcome: 'failed' },
          { providerFactorId: FACTOR_B, outcome: 'removed' },
        ],
      },
    });
  });
});
