import {
  TotpEnrollmentStartSchema,
  type MfaFactorsResource,
  type TotpEnrollmentStart,
} from '@wejammin/contracts';

import {
  bareVersion,
  buildFactorsResource,
  finalizationFailed,
  invalidProviderOrPersistence,
  isAmbiguousProviderOutcome,
  requireEligibleAccount,
} from './mfa-service-support';
import type {
  MfaAuthenticationMethods,
  MfaCookieResult,
  MfaServiceDependencies,
} from './mfa-types';
import type { AuthenticationResult } from './result-types';
import {
  isFreshProof,
  reauthenticateError,
  stepUpRequiredError,
} from './step-up';

type EnrollmentMethods = Required<
  Pick<
    MfaAuthenticationMethods,
    'readMfaFactors' | 'startTotpEnrollment' | 'verifyTotpEnrollment'
  >
>;

export const createEnrollmentService = (
  dependencies: MfaServiceDependencies,
): EnrollmentMethods => {
  const { persistence, provider, rotation, now } = dependencies;

  const readMfaFactors: EnrollmentMethods['readMfaFactors'] = async (
    input,
    _env,
    signal,
  ) => {
    const ineligible = requireEligibleAccount(input.session);
    if (ineligible !== null) return ineligible;
    const snapshot = await persistence.readFactors(
      { authUserId: input.session.authUserId, request: input.request },
      signal,
    );
    return snapshot.ok
      ? buildFactorsResource(snapshot.value, input.session.stepUpAt, now())
      : snapshot;
  };

  const startTotpEnrollment: EnrollmentMethods['startTotpEnrollment'] = async (
    input,
    _env,
    signal,
  ): Promise<AuthenticationResult<TotpEnrollmentStart>> => {
    const { session, request } = input;
    const ineligible = requireEligibleAccount(session);
    if (ineligible !== null) return ineligible;
    const caller = { authUserId: session.authUserId, request };
    const current = await persistence.readFactors(caller, signal);
    if (!current.ok) return current;
    const hasVerifiedFactor = current.value.factors.some(
      (factor) => factor.state === 'verified',
    );
    if (hasVerifiedFactor) {
      if (!isFreshProof(session.stepUpAt, now())) return stepUpRequiredError();
    } else if (!isFreshProof(session.primaryAuthAt ?? null, now())) {
      return reauthenticateError();
    }
    const begun = await persistence.beginEnrollment(
      {
        ...caller,
        friendlyName: input.friendlyName,
        expectedVersion: bareVersion(input.ifMatch),
      },
      signal,
    );
    if (!begun.ok) return begun;
    if (begun.value.supersededProviderFactorId !== null) {
      const removed = await provider.unenroll(
        { request, providerFactorId: begun.value.supersededProviderFactorId },
        signal,
      );
      if (!removed.ok) return removed;
    }
    const enrolled = await provider.enroll(
      { request, friendlyName: input.friendlyName },
      signal,
    );
    if (!enrolled.ok) return enrolled;
    const recorded = await persistence.finishEnrollment(
      {
        ...caller,
        providerFactorId: enrolled.value.providerFactorId,
        friendlyName: input.friendlyName,
        expectedVersion: begun.value.version,
        sessionId: session.sessionId,
      },
      signal,
    );
    if (!recorded.ok) {
      await provider.unenroll(
        { request, providerFactorId: enrolled.value.providerFactorId },
        signal,
      );
      return recorded;
    }
    const parsed = TotpEnrollmentStartSchema.safeParse({
      factorId: recorded.value.factorId,
      method: 'totp',
      friendlyName: input.friendlyName,
      otpauthUri: enrolled.value.otpauthUri,
      manualEntryKey: enrolled.value.manualEntryKey,
      expiresAt: recorded.value.expiresAt,
      version: recorded.value.version,
    });
    return parsed.success
      ? { ok: true, value: parsed.data }
      : invalidProviderOrPersistence();
  };

  const verifyTotpEnrollment: EnrollmentMethods['verifyTotpEnrollment'] =
    async (
      input,
      _env,
      signal,
    ): Promise<AuthenticationResult<MfaCookieResult<MfaFactorsResource>>> => {
      const { session, request } = input;
      const ineligible = requireEligibleAccount(session);
      if (ineligible !== null) return ineligible;
      const caller = { authUserId: session.authUserId, request };
      const expectedVersion = bareVersion(input.ifMatch);
      const prepared = await persistence.prepareEnrollmentVerify(
        { ...caller, factorId: input.factorId, expectedVersion },
        signal,
      );
      if (!prepared.ok) return prepared;
      const { providerFactorId } = prepared.value;
      const reconcile = async <E extends { ok: false }>(
        failure: E,
      ): Promise<E> => {
        await persistence.markFactorReconciling(
          { ...caller, factorId: input.factorId },
          signal,
        );
        return failure;
      };
      const challenge = await provider.challenge(
        { request, providerFactorId },
        signal,
      );
      if (!challenge.ok) return challenge;
      const verified = await provider.verify(
        {
          request,
          providerFactorId,
          providerChallengeId: challenge.value.providerChallengeId,
          code: input.code,
        },
        signal,
      );
      if (!verified.ok)
        return isAmbiguousProviderOutcome(verified)
          ? reconcile(verified)
          : verified;
      const validated = await rotation.validate(
        { session, request, payload: verified.value },
        signal,
      );
      if (!validated.ok) return reconcile(validated);
      const settled = await persistence.settleEnrollmentVerify(
        {
          ...caller,
          factorId: input.factorId,
          expectedVersion,
          sessionId: session.sessionId,
        },
        signal,
      );
      if (!settled.ok) return reconcile(finalizationFailed());
      const committed = await validated.value.commit(signal);
      if (!committed.ok) return committed;
      const resource = buildFactorsResource(
        settled.value,
        validated.value.stepUpAt,
        now(),
      );
      return resource.ok
        ? {
            ok: true,
            value: {
              resource: resource.value,
              cookies: committed.value.cookies,
            },
          }
        : resource;
    };

  return { readMfaFactors, startTotpEnrollment, verifyTotpEnrollment };
};
