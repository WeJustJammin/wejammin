import { describe, expect, it } from 'vitest';

import {
  ADMIN_WORKSPACE_ROUTE_CONTRACTS,
  AdminWorkspaceOperationIdSchema,
  adminWorkspaceRoutePolicies,
} from './admin-routes.ts';
import { Cfg05b07CapabilitySnapshotResponseSchema } from './admin-workspace.ts';
import { Cfg05b07CapabilitySnapshotResponseSchema as Direct } from './admin-capability-snapshot.ts';

describe('CFG-05B-07 capability snapshot contract', () => {
  it('accepts a bounded list of unique named capabilities', () => {
    expect(
      Cfg05b07CapabilitySnapshotResponseSchema.parse({
        capabilities: ['admin.identity.mfa_reset', 'admin.inbox.read'],
      }),
    ).toEqual({
      capabilities: ['admin.identity.mfa_reset', 'admin.inbox.read'],
    });
    expect(Direct.safeParse({ capabilities: [] }).success).toBe(true);
  });

  it('accepts the settings.* command namespace alongside admin.*', () => {
    expect(
      Cfg05b07CapabilitySnapshotResponseSchema.parse({
        capabilities: ['admin.inbox.read', 'settings.rollback'],
      }).capabilities,
    ).toEqual(['admin.inbox.read', 'settings.rollback']);
  });

  it.each([
    ['non-admin capability', { capabilities: ['cms.editor'] }],
    ['wildcard', { capabilities: ['admin.*'] }],
    ['settings wildcard', { capabilities: ['settings.*'] }],
    ['other namespace', { capabilities: ['configuration.editor'] }],
    ['duplicate', { capabilities: ['admin.inbox.read', 'admin.inbox.read'] }],
    ['not an array', { capabilities: 'admin.inbox.read' }],
    ['missing field', {}],
    ['extra identifier', { capabilities: [], actorId: 'x' }],
    [
      'over 32 entries',
      {
        capabilities: Array.from({ length: 33 }, (_, i) => `admin.cap${i}`),
      },
    ],
  ])('rejects %s', (_label, value) => {
    expect(
      Cfg05b07CapabilitySnapshotResponseSchema.safeParse(value).success,
    ).toBe(false);
  });

  it('registers a no-input protected GET route', () => {
    expect(
      AdminWorkspaceOperationIdSchema.safeParse('CFG-05B-07').success,
    ).toBe(true);
    expect(
      adminWorkspaceRoutePolicies.find(
        ({ operationId }) => operationId === 'CFG-05B-07',
      ),
    ).toMatchObject({
      active: true,
      method: 'GET',
      path: '/api/v1/admin/capability-snapshot',
      auth: 'session',
      cacheControl: 'no-store',
      idempotency: 'none',
      ifMatch: 'none',
      rateLimit: 120,
      rateWindowSeconds: 60,
      timeoutMs: 8_000,
    });
    const contract = ADMIN_WORKSPACE_ROUTE_CONTRACTS.find(
      ({ operationId }) => operationId === 'CFG-05B-07',
    );
    expect(contract?.request.safeParse({}).success).toBe(true);
    expect(contract?.request.safeParse({ actorId: 'x' }).success).toBe(false);
  });
});
