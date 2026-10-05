import { describe, expect, it } from 'vitest';

import { platformRegistrySet } from '../platform-registries.ts';
import { authRoutePolicies } from './routes.ts';

/**
 * BE01a Route Registry, AUTH-API-16: "300/min/user, no-store, 8s, Tier 1". The
 * rate, cache and deadline columns are carried by the auth route policy; the
 * SLO tier is carried by the platform route registry row of the same
 * operation (BE01a: every operation is a compile-time route-registry entry
 * with an SLO tier).
 */
const row = (operationId: string) => {
  const found = platformRegistrySet.routes.find(
    (candidate) => candidate.operationId === operationId,
  );
  if (found === undefined)
    throw new Error(`missing registry row ${operationId}`);
  return found;
};

describe('AUTH-API-16 registry classification', () => {
  it('[P2-S09-AC-725] the platform registry classifies GET /api/v1/account/mfa/factors as tier_1', () => {
    expect(row('authMfaFactorsRead')).toMatchObject({
      method: 'GET',
      path: '/api/v1/account/mfa/factors',
      sloTier: 'tier_1',
    });
  });

  it('[P2-S09-AC-725] the same operation is registered with the 8 s deadline', () => {
    expect(row('authMfaFactorsRead').timeoutMs).toBe(8_000);
  });

  it('[P2-S09-AC-725] the auth route policy of AUTH-API-16 is 300 per 60 s per user, no-store, 8 s', () => {
    expect(
      authRoutePolicies.find(
        ({ operationId }) => operationId === 'AUTH-API-16',
      ),
    ).toMatchObject({
      method: 'GET',
      path: '/api/v1/account/mfa/factors',
      rateLimit: 300,
      rateWindowSeconds: 60,
      rateScope: 'user',
      cacheControl: 'no-store',
      timeoutMs: 8_000,
    });
  });

  it.each([
    ['authMfaEnrollmentStart', 'tier_2'],
    ['authMfaFactorVerify', 'tier_2'],
    ['authMfaFactorRemove', 'tier_2'],
    ['authStepUpChallengeCreate', 'tier_2'],
    ['authStepUpVerify', 'tier_2'],
  ] as const)(
    '[P2-S09-AC-725] %s keeps the tier_2 classification so only AUTH-API-16 is tier_1 among the MFA operations',
    (operationId, tier) => {
      expect(row(operationId).sloTier).toBe(tier);
    },
  );
});
