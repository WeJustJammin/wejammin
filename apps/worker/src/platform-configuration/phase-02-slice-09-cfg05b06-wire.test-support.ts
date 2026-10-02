import {
  createWorld,
  json,
  mintJar,
  rpcNames,
  send,
  type Handler,
} from '../authentication/dec111-composition.test-support';
import { resetResponse } from './admin-mfa-reset.test-support';
import { TARGET_ID } from './phase-02-slice-08-worker.test-support';

/** Shared world for the CFG-05B-06 production-composition wire tests. */
export const PATH = '/api/v1/admin/identity/mfa-factor-resets';
export const CAPABILITY = 'admin.identity.mfa_reset';
export const TARGET_AUTH = 'abababab-abab-4bab-8bab-abababababab';
export const FACTOR_A = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1';
export const FACTOR_B = 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2';
export const REMOVE_A = `DELETE /auth/v1/admin/users/${TARGET_AUTH}/factors/${FACTOR_A}`;
export const REMOVE_B = `DELETE /auth/v1/admin/users/${TARGET_AUTH}/factors/${FACTOR_B}`;
export const BODY = {
  targetPersonId: TARGET_ID,
  reason: 'Lost every authenticator.',
};
export const KEY = 'mfa-reset-0123456789';

export const reservation = (patch: Record<string, unknown> = {}) => ({
  ...resetResponse({ state: 'reconciling', removedFactorCount: 0 }),
  targetAuthUserId: TARGET_AUTH,
  pendingProviderFactorIds: [FACTOR_A, FACTOR_B],
  ...patch,
});

export const handlers = (
  overrides: Readonly<Record<string, Handler>> = {},
  capabilities: readonly string[] = [CAPABILITY],
): Readonly<Record<string, Handler>> => ({
  admin_context_capabilities: () => json(capabilities),
  admin_mfa_factor_reset: () => json(reservation()),
  admin_mfa_factor_reset_settle: () => json(resetResponse()),
  [REMOVE_A]: () => json({}),
  [REMOVE_B]: () => json({}),
  ...overrides,
});

export const post = async (
  overrides: Readonly<Record<string, Handler>> = {},
  options: Readonly<{
    capabilities?: readonly string[];
    body?: unknown;
    stepUpAt?: string | null;
    headers?: Readonly<Record<string, string | null>>;
  }> = {},
) => {
  const world = createWorld({
    handlers: handlers(overrides, options.capabilities),
  });
  const jar = await mintJar(
    options.stepUpAt === undefined ? {} : { stepUpAt: options.stepUpAt },
  );
  const response = await send(world.app, {
    method: 'POST',
    path: PATH,
    body: options.body ?? BODY,
    jar,
    headers: { 'idempotency-key': KEY, ...(options.headers ?? {}) },
  });
  return { world, response };
};

export const names = (calls: Parameters<typeof rpcNames>[0]) => rpcNames(calls);
