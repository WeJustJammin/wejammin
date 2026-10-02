import { authError } from '../../../apps/worker/src/authentication/boundary';
import { createMfaService } from '../../../apps/worker/src/authentication/mfa-service';
import type {
  MfaFactorRow,
  MfaPersistencePort,
  MfaProviderPort,
  MfaRegistrySnapshot,
  SessionRotationPort,
} from '../../../apps/worker/src/authentication/mfa-types';
import type { AuthenticationResult } from '../../../apps/worker/src/authentication/result-types';

import { laneClaimOf, revokeLaneSession, worldOfClaim } from './s09-lane-auth';
import { rotationCookies } from './s09-lane-cookies';
import {
  laneRoleOfUser,
  laneSessionId,
  laneUserId,
  parseLaneSessionId,
} from './s09-lane-ids';
import { randomBase32Secret, totpMatches } from './s09-lane-totp';
import {
  ID_KIND,
  iso,
  nextId,
  worldAccount,
  type MfaAccount,
  type MfaFactorRecord,
  type World,
} from './s09-lane-world';

/**
 * The lane's MFA seam: the REAL `createMfaService` (ordering, recency and
 * outcome rules) over in-memory persistence, a test-only provider that
 * verifies genuine RFC 6238 codes, and a rotation port that mints replacement
 * cookies. Nothing contacts a provider; no real credential exists.
 */

const ENROLLMENT_MS = 600_000;
const CHALLENGE_MS = 300_000;
const providerSecrets = new Map<string, string>();

const ok = <T>(value: T): AuthenticationResult<T> => ({ ok: true, value });
const conflict = (reasonCode: string, recoveryAction: string) =>
  authError(409, 'CONFLICT', 'The request conflicts with current state.', {
    conflict: 'INVALID_TRANSITION',
    reasonCode,
    recoveryAction,
  });
const stale = () =>
  authError(409, 'CONFLICT', 'The authenticator list changed; reload and try again.', {
    conflict: 'VERSION_MISMATCH',
    recoveryAction: 'refetch',
  });
const notFound = () => authError(404, 'NOT_FOUND', 'The requested resource was not found.', {});

type Caller = Readonly<{ authUserId: string; request: Request }>;

const accountOf = (caller: Caller): { world: World; account: MfaAccount; role: NonNullable<ReturnType<typeof laneRoleOfUser>> } => {
  const claim = laneClaimOf(caller.request);
  const role = laneRoleOfUser(caller.authUserId);
  if (claim === null || role === null) throw new Error('lane MFA caller is not a lane session');
  const world = worldOfClaim(claim);
  return { world, account: worldAccount(world, role), role };
};

const rowOf = (factor: MfaFactorRecord): MfaFactorRow => ({
  id: factor.id,
  method: 'totp',
  friendlyName: factor.friendlyName,
  state: factor.state,
  verifiedAt: factor.verifiedAt,
  lastUsedAt: factor.lastUsedAt,
  pendingExpiresAt: factor.pendingExpiresAt,
}) as MfaFactorRow;

const snapshot = (account: MfaAccount): MfaRegistrySnapshot => ({
  factors: account.factors.map(rowOf),
  version: String(account.version),
});

const guardVersion = (account: MfaAccount, expected: string) =>
  expected === String(account.version) ? null : stale();

const persistence: MfaPersistencePort = {
  readFactors: async (caller) => ok(snapshot(accountOf(caller).account)),
  beginEnrollment: async (input) => {
    const { account } = accountOf(input);
    const mismatch = guardVersion(account, input.expectedVersion);
    if (mismatch !== null) return mismatch;
    const pending = account.factors.find((entry) => entry.state === 'pending');
    account.factors = account.factors.filter((entry) => entry.state !== 'pending');
    account.version += 1;
    return ok({
      supersededProviderFactorId: pending?.providerFactorId ?? null,
      version: String(account.version),
    });
  },
  finishEnrollment: async (input) => {
    const { world, account } = accountOf(input);
    const mismatch = guardVersion(account, input.expectedVersion);
    if (mismatch !== null) return mismatch;
    const factor: MfaFactorRecord = {
      id: nextId(world, ID_KIND.factor),
      providerFactorId: input.providerFactorId,
      friendlyName: input.friendlyName,
      secret: '',
      state: 'pending',
      verifiedAt: null,
      lastUsedAt: null,
      pendingExpiresAt: iso(Date.now() + ENROLLMENT_MS),
    };
    account.factors.push(factor);
    account.version += 1;
    return ok({
      factorId: factor.id,
      expiresAt: factor.pendingExpiresAt as string,
      version: String(account.version),
    });
  },
  prepareEnrollmentVerify: async (input) => {
    const { account } = accountOf(input);
    const mismatch = guardVersion(account, input.expectedVersion);
    if (mismatch !== null) return mismatch;
    const factor = account.factors.find((entry) => entry.id === input.factorId);
    if (factor === undefined) return notFound();
    if (factor.state !== 'pending') return conflict('factor_state_conflict', 'refetch');
    return ok({ providerFactorId: factor.providerFactorId });
  },
  recordVerificationFailure: async (input) => {
    accountOf(input).account.failures += 1;
    return ok(null);
  },
  settleEnrollmentVerify: async (input) => {
    const { world, account, role } = accountOf(input);
    const mismatch = guardVersion(account, input.expectedVersion);
    if (mismatch !== null) return mismatch;
    const factor = account.factors.find((entry) => entry.id === input.factorId);
    if (factor === undefined) return notFound();
    factor.state = 'verified';
    factor.verifiedAt = input.rotation.issuedAt;
    factor.pendingExpiresAt = null;
    account.version += 1;
    world.stepUpAt[role] = input.rotation.issuedAt;
    revokeLaneSession(input.sessionId);
    return ok(snapshot(account));
  },
  markFactorReconciling: async () => ok(null),
  beginRemoval: async (input) => {
    const { world, account } = accountOf(input);
    const replay = world.idem.get(`mfa-remove:${input.idempotencyKey}`) as
      | MfaRegistrySnapshot
      | undefined;
    if (replay !== undefined) {
      const factor = account.factors.find((entry) => entry.id === input.factorId);
      return ok({ providerFactorId: factor?.providerFactorId ?? input.factorId, replay });
    }
    const mismatch = guardVersion(account, input.expectedVersion);
    if (mismatch !== null) return mismatch;
    const factor = account.factors.find((entry) => entry.id === input.factorId);
    if (factor === undefined) return notFound();
    return ok({ providerFactorId: factor.providerFactorId, replay: null });
  },
  finishRemoval: async (input) => {
    const { world, account } = accountOf(input);
    account.factors = account.factors.filter((entry) => entry.id !== input.factorId);
    account.version += 1;
    const result = snapshot(account);
    world.idem.set(`mfa-remove:${input.idempotencyKey}`, result);
    return ok(result);
  },
  beginChallenge: async (input) => {
    const { account } = accountOf(input);
    const verified = account.factors.filter((entry) => entry.state === 'verified');
    const factor =
      input.factorId === null
        ? verified[0]
        : verified.find((entry) => entry.id === input.factorId);
    if (factor === undefined) return conflict('no_verified_factor', 'enroll_factor');
    return ok({
      factorId: factor.id,
      providerFactorId: factor.providerFactorId,
      friendlyName: factor.friendlyName,
    });
  },
  finishChallenge: async (input) => {
    const { world, account } = accountOf(input);
    const challenge = {
      id: nextId(world, ID_KIND.challenge),
      factorId: input.factorId,
      providerChallengeId: input.providerChallengeId,
      expiresAt: input.expiresAt,
      state: 'pending' as const,
    };
    account.challenges.push(challenge);
    return ok({ challengeId: challenge.id, expiresAt: challenge.expiresAt });
  },
  prepareChallengeVerify: async (input) => {
    const { account } = accountOf(input);
    const challenge = account.challenges.find((entry) => entry.id === input.challengeId);
    if (challenge === undefined || challenge.state !== 'pending') return notFound();
    const factor = account.factors.find((entry) => entry.id === challenge.factorId);
    if (factor === undefined) return notFound();
    return ok({
      factorId: factor.id,
      providerFactorId: factor.providerFactorId,
      providerChallengeId: challenge.providerChallengeId,
      expiresAt: challenge.expiresAt,
    });
  },
  recordChallengeFailure: async (input) => {
    const { account } = accountOf(input);
    account.failures += 1;
    if (input.outcome === 'ambiguous')
      account.challenges = account.challenges.filter((entry) => entry.id !== input.challengeId);
    return ok(null);
  },
  settleChallengeVerify: async (input) => {
    const { world, account, role } = accountOf(input);
    const challenge = account.challenges.find((entry) => entry.id === input.challengeId);
    if (challenge === undefined) return notFound();
    challenge.state = 'settled';
    const factor = account.factors.find((entry) => entry.id === challenge.factorId);
    if (factor !== undefined) factor.lastUsedAt = input.rotation.issuedAt;
    world.stepUpAt[role] = input.rotation.issuedAt;
    revokeLaneSession(input.sessionId);
    return ok(null);
  },
};

const provider: MfaProviderPort = {
  enroll: async (input) => {
    const providerFactorId = crypto.randomUUID();
    const secret = randomBase32Secret(32);
    providerSecrets.set(providerFactorId, secret);
    return ok({
      providerFactorId,
      otpauthUri: `otpauth://totp/WeJammin:${encodeURIComponent(input.friendlyName)}?secret=${secret}&issuer=WeJammin`,
      manualEntryKey: secret,
    });
  },
  unenroll: async (input) => {
    providerSecrets.delete(input.providerFactorId);
    return ok(null);
  },
  challenge: async () =>
    ok({
      providerChallengeId: crypto.randomUUID(),
      expiresAt: iso(Date.now() + CHALLENGE_MS),
    }),
  verify: async (input) => {
    const secret = providerSecrets.get(input.providerFactorId);
    return secret !== undefined && (await totpMatches(secret, input.code, Date.now()))
      ? ok({ aal: 'aal2' })
      : authError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
          violations: [
            { path: '/code', code: 'code_incorrect', message: 'The value is invalid.' },
          ],
        });
  },
};

const rotation: SessionRotationPort = {
  validate: async ({ session }) => {
    const parsed = parseLaneSessionId(session.sessionId);
    if (parsed === null)
      return authError(401, 'UNAUTHENTICATED', 'Sign in again to continue.', {});
    const now = Date.now();
    const sessionId = laneSessionId(parsed.role, parsed.testId, parsed.generation + 1);
    return ok({
      stepUpAt: iso(now),
      freshUntil: iso(now + 600_000),
      rotation: { sessionId, issuedAt: iso(now) },
      cookies: await rotationCookies({
        userId: laneUserId(parsed.role),
        sessionId,
        csrfRandom: crypto.randomUUID().replaceAll('-', ''),
      }),
    });
  },
};

export const laneMfaMethods = createMfaService({
  persistence,
  provider,
  rotation,
  now: Date.now,
});
