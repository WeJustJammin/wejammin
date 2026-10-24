import { vi } from 'vitest';

import type { AsyncWorkerBindings } from './async-entrypoint';

export const SECRET = 'sb_secret_governed_activation_sweep_test_only';
export const bindings = {
  APP_ENVIRONMENT: 'production',
  APP_RELEASE: 'test-release',
  SUPABASE_SECRET_KEY: SECRET,
  SUPABASE_URL: 'https://governed-sweep.example.supabase.co/',
} as unknown as AsyncWorkerBindings;

export const CLAIM_RPC = 'cms_claim_due_governed_activations';
export const EXECUTE_RPC = 'cms_execute_governed_activation';

/** CMS-03C-19 claim `index`: the schedule row version (advancing) differs from the review version (fixed). */
export const claimFor = (
  index: number,
  patch: Record<string, unknown> = {},
) => ({
  scheduleId: `123e4567-e89b-42d3-a456-42661417400${index}`,
  reviewId: `523e4567-e89b-42d3-a456-42661417400${index}`,
  subjectKind: 'template_version',
  subjectId: `623e4567-e89b-42d3-a456-42661417400${index}`,
  scheduleVersion: String(index + 10),
  expectedVersion: '3',
  leaseId: `223e4567-e89b-42d3-a456-42661417400${index}`,
  correlationId: `323e4567-e89b-42d3-a456-42661417400${index}`,
  ...patch,
});

export const completed = (claim: { scheduleId: string }) => ({
  scheduleId: claim.scheduleId,
  outcome: 'completed',
  reasonCode: null,
  actualUtc: '2026-11-01T14:30:03Z',
  deviationSeconds: 3,
});

type Handler = (body: Record<string, unknown>) => Response | Promise<Response>;

/** The edge: each RPC name answers through its handler; an unexpected name fails the test. */
export const stubEdge = (handlers: Readonly<Record<string, Handler>>) => {
  const calls: {
    name: string;
    body: Record<string, unknown>;
    headers: Record<string, string>;
  }[] = [];
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockImplementation(async (input, init) => {
      const name = String(input).split('/rpc/')[1] as string;
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.push({
        name,
        body,
        headers: init?.headers as Record<string, string>,
      });
      const handler = handlers[name];
      if (handler === undefined) throw new Error(`unexpected ${name}`);
      return handler(body);
    });
  vi.stubGlobal('fetch', fetchImpl);
  return { calls, fetchImpl };
};

/** Everything the sweep logged, as one string (info and error sinks). */
export const logs = () => {
  const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  return () =>
    JSON.stringify([
      ...info.mock.calls,
      ...warn.mock.calls,
      ...error.mock.calls,
    ]);
};
