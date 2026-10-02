import { describe, expect, it } from 'vitest';

import { activeAdminWorkspaceRoutePolicies } from './admin-active-routes.ts';
import { ADMIN_WORKSPACE_ROUTE_CONTRACTS } from './admin-route-contracts.ts';
import {
  AdminWorkspaceOperationIdSchema,
  AdminWorkspaceRouteErrorCodeSchema,
  AdminWorkspaceRoutePolicySchema,
} from './admin-route-policy.ts';
import {
  AdminWorkspaceActiveRouteRegistrySchema,
  AdminWorkspaceRouteRegistrySchema,
  adminWorkspaceRoutePolicies,
} from './admin-route-registry.ts';
import {
  Cfg05b06MfaFactorResetRequestSchema,
  Cfg05b06MfaFactorResetResponseSchema,
} from './admin-mfa-reset.ts';

const find = (operationId: string) =>
  adminWorkspaceRoutePolicies.find(
    (route) => route.operationId === operationId,
  );

describe('CFG-05B-06 route policy registration', () => {
  it('accepts CFG-05B-06 as an admin workspace operation', () => {
    expect(
      AdminWorkspaceOperationIdSchema.safeParse('CFG-05B-06').success,
    ).toBe(true);
  });

  it('publishes the BE05b route with step-up, capability, rates and headers', () => {
    expect(find('CFG-05B-06')).toEqual({
      operationId: 'CFG-05B-06',
      active: true,
      method: 'POST',
      path: '/api/v1/admin/identity/mfa-factor-resets',
      requestSchema: 'Cfg05b06MfaFactorResetRequestSchema',
      successSchema: 'Cfg05b06MfaFactorResetResponseSchema',
      auth: 'session',
      stepUp: 'required',
      capability: 'admin.identity.mfa_reset',
      rateLimit: 5,
      partyRateLimit: 10,
      rateWindowSeconds: 3600,
      rateScope: 'actor',
      rateClass: 'admin_mfa_factor_reset',
      timeoutMs: 15_000,
      cacheControl: 'no-store',
      idempotency: 'required',
      ifMatch: 'none',
      sloTier: 'tier_2',
      errors: [
        'INVALID_REQUEST',
        'UNAUTHENTICATED',
        'STEP_UP_REQUIRED',
        'FORBIDDEN',
        'TARGET_NOT_FOUND',
        'IDEMPOTENCY_CONFLICT',
        'MFA_RESET_IN_PROGRESS',
        'MFA_RESET_INVALID',
        'RATE_LIMITED',
        'IDENTITY_UNAVAILABLE',
        'INTERNAL_ERROR',
      ],
    });
  });

  it('mounts CFG-05B-06 in the active registry after 01, 04 and 05, then 07', () => {
    expect(
      activeAdminWorkspaceRoutePolicies.map(({ operationId }) => operationId),
    ).toEqual([
      'CFG-05B-01',
      'CFG-05B-04',
      'CFG-05B-05',
      'CFG-05B-06',
      'CFG-05B-07',
    ]);
    expect(
      AdminWorkspaceActiveRouteRegistrySchema.safeParse(
        activeAdminWorkspaceRoutePolicies,
      ).success,
    ).toBe(true);
    expect(
      AdminWorkspaceRouteRegistrySchema.safeParse(adminWorkspaceRoutePolicies)
        .success,
    ).toBe(true);
    expect(adminWorkspaceRoutePolicies).toHaveLength(7);
  });

  it.each([
    'STEP_UP_REQUIRED',
    'IDEMPOTENCY_CONFLICT',
    'MFA_RESET_IN_PROGRESS',
    'MFA_RESET_INVALID',
    'IDENTITY_UNAVAILABLE',
  ])('knows the %s error code', (code) => {
    expect(AdminWorkspaceRouteErrorCodeSchema.safeParse(code).success).toBe(
      true,
    );
  });

  it('keeps the policy strict for the new fields', () => {
    const route = find('CFG-05B-06');
    expect(AdminWorkspaceRoutePolicySchema.safeParse(route).success).toBe(true);
    expect(
      AdminWorkspaceRoutePolicySchema.safeParse({ ...route, stepUp: 'maybe' })
        .success,
    ).toBe(false);
    expect(
      AdminWorkspaceRoutePolicySchema.safeParse({ ...route, partyRateLimit: 0 })
        .success,
    ).toBe(false);
    expect(
      AdminWorkspaceRoutePolicySchema.safeParse({
        ...route,
        capability: 'Not A Capability',
      }).success,
    ).toBe(false);
  });

  it('leaves the other routes without step-up, capability or party fields', () => {
    for (const route of adminWorkspaceRoutePolicies) {
      if (route.operationId === 'CFG-05B-06') continue;
      expect(route).not.toHaveProperty('stepUp');
      expect(route).not.toHaveProperty('capability');
      expect(route).not.toHaveProperty('partyRateLimit');
    }
  });

  it('exposes the request and response schemas through the route contract', () => {
    expect(
      ADMIN_WORKSPACE_ROUTE_CONTRACTS.find(
        ({ operationId }) => operationId === 'CFG-05B-06',
      ),
    ).toEqual({
      operationId: 'CFG-05B-06',
      method: 'POST',
      path: '/api/v1/admin/identity/mfa-factor-resets',
      request: Cfg05b06MfaFactorResetRequestSchema,
      response: Cfg05b06MfaFactorResetResponseSchema,
      successStatus: 200,
      active: true,
    });
  });
});
