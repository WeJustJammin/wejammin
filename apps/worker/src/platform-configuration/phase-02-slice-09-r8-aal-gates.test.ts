import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NOW,
  PERSON_ID,
  SHAPES,
  createWorld,
  expectApiError,
  iso,
  json,
  mintJar,
  rpcNames,
  send,
  type Send,
} from '../authentication/dec111-composition.test-support';
import { capabilityActionRequest } from './phase-02-slice-08-worker.fixtures';
import {
  BODY,
  CAPABILITY,
  KEY,
  PATH,
} from './phase-02-slice-09-cfg05b06-wire.test-support';

/**
 * R8 security remediation: every platform-configuration operation that demands
 * a recent step-up refuses a session whose token is not `aal2` with an MFA
 * `amr`, however fresh the session's sealed instant (BE01a "Consumption":
 * an aal1 proof is always 401 STEP_UP_REQUIRED). The requests run through the
 * real production composition; only PostgREST and Supabase Auth are faked, and
 * the access token is the only difference between refusal and control.
 */
const SECOND = Math.floor(NOW / 1000);
const FRESH = iso(-60);
const MFA_AMR = [{ method: 'totp', timestamp: SECOND - 60 }];
const HASH = 'a'.repeat(64);
const BASELINE_RPCS: readonly string[] = [
  'auth_session_read',
  'auth_rate_limit',
  'admin_context_capabilities',
];

const UNPROVEN_TOKENS = [
  ['aal1 with an MFA amr entry', { aal: 'aal1', amr: MFA_AMR }],
  [
    'aal2 without an MFA amr entry',
    { aal: 'aal2', amr: [{ method: 'password', timestamp: SECOND - 30 }] },
  ],
] as const;
const PROVEN_TOKEN = { aal: 'aal2', amr: MFA_AMR } as const;

type Operation = Readonly<{
  id: string;
  marker: string;
  capabilities: readonly string[];
  spec: Send;
}>;

const OPERATIONS: readonly Operation[] = [
  {
    id: 'CFG-05A-03',
    marker: '[P2-S09-AC-909]',
    capabilities: [],
    spec: {
      method: 'POST',
      path: `/api/v1/admin/settings/${PERSON_ID}/changes`,
      headers: { 'idempotency-key': 'r8-aal-proposal-001' },
      body: {
        scopeType: 'party',
        scopeId: PERSON_ID,
        environment: 'production',
        typedValue: true,
        interval: {
          effectiveFrom: '2026-09-02T03:00:00.000Z',
          effectiveTo: '2026-09-03T03:00:00.000Z',
        },
        expectedDefinitionVersion: '1',
        impactManifest: { consumers: ['web.profile'] },
        rollbackCandidate: false,
        reason: 'Enable the governed profile projection.',
        consumerKeys: ['web.profile'],
      },
    },
  },
  {
    id: 'CFG-05A-04',
    marker: '[P2-S09-AC-909]',
    capabilities: [],
    spec: {
      method: 'POST',
      path: `/api/v1/admin/settings/changes/${PERSON_ID}/actions`,
      headers: { 'idempotency-key': 'r8-aal-action-001', 'if-match': '"1"' },
      body: {
        action: 'approve',
        expectedReviewVersion: '1',
        candidateHash: HASH,
        approvalReason: 'Reviewed against the frozen impact manifest.',
      },
    },
  },
  {
    id: 'CFG-05B-04',
    marker: '[P2-S09-AC-909]',
    capabilities: ['admin.capability.grant'],
    spec: {
      method: 'POST',
      path: '/api/v1/admin/capability-grants/actions',
      headers: { 'idempotency-key': 'slice08-capability-action' },
      body: capabilityActionRequest,
    },
  },
  {
    id: 'CFG-05B-06',
    marker: '[P2-S09-AC-926]',
    capabilities: [CAPABILITY],
    spec: {
      method: 'POST',
      path: PATH,
      headers: { 'idempotency-key': KEY },
      body: BODY,
    },
  },
];

const worldFor = (operation: Operation) =>
  createWorld({
    handlers: {
      admin_context_capabilities: () => json(operation.capabilities),
    },
  });

const operationRpcs = (calls: Parameters<typeof rpcNames>[0]): string[] =>
  rpcNames(calls).filter((name) => !BASELINE_RPCS.includes(name));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe.each(OPERATIONS)(
  '$id requires an aal2 token with an MFA amr in addition to a fresh instant',
  (operation) => {
    it.each(UNPROVEN_TOKENS)(
      `${operation.marker} a fresh session whose token is %s is refused with 401 STEP_UP_REQUIRED and the exact step-up details`,
      async (_label, accessClaims) => {
        const world = worldFor(operation);
        const response = await send(world.app, {
          ...operation.spec,
          jar: await mintJar({ stepUpAt: FRESH, accessClaims }),
        });
        await expectApiError(response, {
          status: 401,
          code: 'STEP_UP_REQUIRED',
          shape: SHAPES.stepUp,
        });
      },
    );

    it.each(UNPROVEN_TOKENS)(
      `${operation.marker} a fresh session whose token is %s reaches no operation RPC`,
      async (_label, accessClaims) => {
        const world = worldFor(operation);
        await send(world.app, {
          ...operation.spec,
          jar: await mintJar({ stepUpAt: FRESH, accessClaims }),
        });
        expect(operationRpcs(world.calls)).toStrictEqual([]);
      },
    );

    it(`${operation.marker} the same fresh session with an aal2 token carrying an MFA amr passes the gate and reaches the operation RPC`, async () => {
      const world = worldFor(operation);
      await send(world.app, {
        ...operation.spec,
        jar: await mintJar({ stepUpAt: FRESH, accessClaims: PROVEN_TOKEN }),
      });
      expect(operationRpcs(world.calls).length).toBeGreaterThan(0);
    });
  },
);
