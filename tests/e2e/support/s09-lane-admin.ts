import type { AdminMfaFactorResetPort } from '../../../apps/worker/src/platform-configuration/types';
import { authError } from '../../../apps/worker/src/authentication/boundary';

import { laneClaimOf, worldOfClaim } from './s09-lane-auth';
import {
  LANE_ACTING_PARTY_ID,
  lanePersonRole,
  laneRoleOfUser,
  laneUserId,
  type LaneRole,
} from './s09-lane-ids';
import { ID_KIND, nextId, worldAccount } from './s09-lane-world';

/** Admin capabilities by lane role (only `admin` holds the reset capability). */
const ADMIN_CAPABILITIES: Partial<Record<LaneRole, readonly string[]>> = {
  admin: ['admin.identity.mfa_reset'],
};

const uuidFrom = (header: string | null): string =>
  header !== null &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(header)
    ? header
    : crypto.randomUUID();

/**
 * Server-owned request context (never browser input): the user, acting party
 * and capability snapshot derive from the verified lane session. Other
 * sessions get an anonymous context, which admission refuses.
 */
export const laneRequestContext = (request: Request): unknown => {
  const claim = laneClaimOf(request);
  const requestId = uuidFrom(request.headers.get('x-request-id'));
  return {
    requestId,
    correlationId: uuidFrom(request.headers.get('x-correlation-id')),
    causationId: null,
    traceId: `lane-${requestId}`,
    userId: claim === null ? null : laneUserId(claim.role),
    actingPartyId: claim === null ? null : LANE_ACTING_PARTY_ID,
    capabilities: claim === null ? [] : [...(ADMIN_CAPABILITIES[claim.role] ?? [])],
    locale: 'en-US',
    clientVersion: 'lane',
  };
};

const refuse: AdminMfaFactorResetPort = async () =>
  authError(503, 'DEPENDENCY_UNAVAILABLE', 'Not part of the Slice 09 lane.', {
    dependencyClass: 'admin_workspace',
    retryable: false,
  });

/** CFG-05B-06: remove every authenticator of one lane person, once per key. */
const resetMfaFactors: AdminMfaFactorResetPort = async (input) => {
  const claim = laneClaimOf(input.request);
  const target = lanePersonRole(input.body.targetPersonId);
  if (claim === null || laneRoleOfUser(claim.userId) !== 'admin' || target === null)
    return authError(404, 'NOT_FOUND', 'The target person was not found.', {});
  const world = worldOfClaim(claim);
  const replay = world.idem.get(`mfa-reset:${input.idempotencyKey}`);
  if (replay !== undefined) return { ok: true, value: replay };
  const account = worldAccount(world, target);
  const removed = account.factors.length;
  account.factors = [];
  account.challenges = [];
  account.version += 1;
  delete world.stepUpAt[target];
  const value = {
    resetId: nextId(world, ID_KIND.reset),
    targetPersonId: input.body.targetPersonId,
    state: 'completed' as const,
    removedFactorCount: removed,
    mfaVersion: String(account.version),
    outboxEventId: nextId(world, ID_KIND.reset),
  };
  world.mfaResets.push({ id: value.resetId, target, removed });
  world.idem.set(`mfa-reset:${input.idempotencyKey}`, value);
  return { ok: true, value };
};

export const laneAdminWorkspace = {
  readInbox: refuse,
  capabilityAction: refuse,
  auditDiagnostic: refuse,
  resetMfaFactors,
};
