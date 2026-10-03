import { vi } from 'vitest';

import { normalizeAuthProductionOptions } from '../authentication/production-configuration';
import { createAdminMfaResetPort } from './admin-mfa-reset-port';
import {
  resetBody,
  resetResponse,
  stepUpAgo,
} from './admin-mfa-reset.test-support';
import { bindings, contextFor } from './phase-02-slice-08-worker.test-support';

export const TARGET_AUTH_ID = 'abababab-abab-4bab-8bab-abababababab';
export const FACTOR_A = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1';
export const FACTOR_B = 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2';
export const KEY = 'mfa-reset-0123456789';
export const NOW = Date.parse('2026-10-02T14:00:00Z');

export const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export type Reply = (
  url: string,
  init: RequestInit,
) => Response | Promise<Response>;

export const begun = (patch: Readonly<Record<string, unknown>> = {}) => ({
  ...resetResponse({ state: 'reconciling', removedFactorCount: 0 }),
  targetAuthUserId: TARGET_AUTH_ID,
  pendingProviderFactorIds: [FACTOR_A, FACTOR_B],
  ...patch,
});

export const build = (reply: Reply, clock = { now: NOW }) => {
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

export const input = () => ({
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

export const signal = new AbortController().signal;
export const rpc = (calls: ReturnType<typeof build>['calls'], name: string) =>
  calls.find((call) => call.url.endsWith(`/rpc/${name}`));
export const providerCalls = (calls: ReturnType<typeof build>['calls']) =>
  calls.filter((call) => call.url.includes('/auth/v1/admin/'));

export const standard: Reply = (url) => {
  if (url.endsWith('/rpc/admin_mfa_factor_reset')) return json(begun());
  if (url.endsWith('/rpc/admin_mfa_factor_reset_settle'))
    return json(resetResponse({ removedFactorCount: 2 }));
  return json({}, 200);
};
