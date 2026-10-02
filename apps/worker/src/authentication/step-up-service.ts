import { StepUpChallengeSchema } from '@wejammin/contracts';

import {
  invalidProviderOrPersistence,
  isAmbiguousProviderOutcome,
  requireEligibleAccount,
  transitionConflict,
} from './mfa-service-support';
import type {
  MfaAuthenticationMethods,
  MfaServiceDependencies,
} from './mfa-types';
import { STEP_UP_FRESHNESS_SECONDS } from './step-up';

type StepUpMethods = Required<
  Pick<
    MfaAuthenticationMethods,
    'createStepUpChallenge' | 'verifyStepUpChallenge'
  >
>;

export const createStepUpService = (
  dependencies: MfaServiceDependencies,
): StepUpMethods => {
  const { persistence, provider, rotation, now } = dependencies;

  const createStepUpChallenge: StepUpMethods['createStepUpChallenge'] = async (
    input,
    _env,
    signal,
  ) => {
    const { session, request } = input;
    const ineligible = requireEligibleAccount(session);
    if (ineligible !== null) return ineligible;
    const caller = { authUserId: session.authUserId, request };
    const begun = await persistence.beginChallenge(
      {
        ...caller,
        sessionId: session.sessionId,
        method: input.method,
        factorId: input.factorId,
      },
      signal,
    );
    if (!begun.ok) return begun;
    const created = await provider.challenge(
      { request, providerFactorId: begun.value.providerFactorId },
      signal,
    );
    if (!created.ok) return created;
    const cap = now() + STEP_UP_FRESHNESS_SECONDS * 1000;
    const providerExpiry = Date.parse(created.value.expiresAt);
    const expiresAt = new Date(
      Number.isFinite(providerExpiry) ? Math.min(providerExpiry, cap) : cap,
    ).toISOString();
    const recorded = await persistence.finishChallenge(
      {
        ...caller,
        sessionId: session.sessionId,
        factorId: begun.value.factorId,
        providerChallengeId: created.value.providerChallengeId,
        expiresAt,
      },
      signal,
    );
    if (!recorded.ok) return recorded;
    const parsed = StepUpChallengeSchema.safeParse({
      challengeId: recorded.value.challengeId,
      method: input.method,
      factorId: begun.value.factorId,
      friendlyName: begun.value.friendlyName,
      expiresAt: recorded.value.expiresAt,
    });
    return parsed.success
      ? { ok: true, value: parsed.data }
      : invalidProviderOrPersistence();
  };

  const verifyStepUpChallenge: StepUpMethods['verifyStepUpChallenge'] = async (
    input,
    _env,
    signal,
  ) => {
    const { session, request } = input;
    const ineligible = requireEligibleAccount(session);
    if (ineligible !== null) return ineligible;
    const caller = { authUserId: session.authUserId, request };
    const bound = {
      ...caller,
      sessionId: session.sessionId,
      challengeId: input.challengeId,
    };
    const prepared = await persistence.prepareChallengeVerify(bound, signal);
    if (!prepared.ok) return prepared;
    if (Date.parse(prepared.value.expiresAt) <= now())
      return transitionConflict(
        'challenge_expired',
        'new_challenge',
        'The verification challenge expired; start a new one.',
      );
    const verified = await provider.verify(
      {
        request,
        providerFactorId: prepared.value.providerFactorId,
        providerChallengeId: prepared.value.providerChallengeId,
        code: input.code,
      },
      signal,
    );
    if (!verified.ok) {
      if (verified.status === 422)
        await persistence.recordChallengeFailure(
          { ...bound, outcome: 'incorrect' },
          signal,
        );
      else if (isAmbiguousProviderOutcome(verified))
        await persistence.recordChallengeFailure(
          { ...bound, outcome: 'ambiguous' },
          signal,
        );
      return verified;
    }
    const validated = await rotation.validate(
      { session, request, payload: verified.value },
      signal,
    );
    if (!validated.ok) {
      await persistence.recordChallengeFailure(
        { ...bound, outcome: 'ambiguous' },
        signal,
      );
      return validated;
    }
    const settled = await persistence.settleChallengeVerify(bound, signal);
    if (!settled.ok) return settled;
    const committed = await validated.value.commit(signal);
    if (!committed.ok) return committed;
    return {
      ok: true,
      value: {
        resource: {
          verified: true,
          method: 'totp',
          stepUpAt: validated.value.stepUpAt,
          freshUntil: validated.value.freshUntil,
        },
        cookies: committed.value.cookies,
      },
    };
  };

  return { createStepUpChallenge, verifyStepUpChallenge };
};
