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
    if (!created.ok) {
      // The registry holds a verified factor the provider no longer has (an
      // operator removed it in the dashboard, the sole-administrator runbook).
      // The registry must not keep asserting a factor nobody can use: mark it
      // reconciling, so the auth-state-reconciler settles it by provider
      // status and first-factor enrollment opens, and tell the caller to
      // enroll. A failed mark is surfaced rather than hidden behind that
      // instruction, because the instruction is only true once it is stored.
      if (created.status !== 404) return created;
      const marked = await persistence.markFactorReconciling(
        { ...caller, factorId: begun.value.factorId },
        signal,
      );
      return marked.ok
        ? transitionConflict(
            'no_verified_factor',
            'enroll_factor',
            'Add an authenticator before verifying.',
          )
        : marked;
    }
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
    // Fail closed: a failure that cannot be durably counted is never
    // reported as the provider result, or guesses would go uncounted.
    const charge = (outcome: 'ambiguous' | 'incorrect') =>
      persistence.recordChallengeFailure({ ...bound, outcome }, signal);
    if (!verified.ok) {
      const outcome =
        verified.status === 422
          ? 'incorrect'
          : isAmbiguousProviderOutcome(verified)
            ? 'ambiguous'
            : null;
      if (outcome === null) return verified;
      const recorded = await charge(outcome);
      return recorded.ok ? verified : recorded;
    }
    const validated = await rotation.validate(
      { session, request, payload: verified.value },
      signal,
    );
    if (!validated.ok) {
      const recorded = await charge('ambiguous');
      return recorded.ok ? validated : recorded;
    }
    // One transaction: consume the challenge AND rotate the session. A failure
    // rolls both back, leaving the challenge recoverable and no cookies sent.
    const settled = await persistence.settleChallengeVerify(
      { ...bound, rotation: validated.value.rotation },
      signal,
    );
    if (!settled.ok) return settled;
    return {
      ok: true,
      value: {
        resource: {
          verified: true,
          method: 'totp',
          stepUpAt: validated.value.stepUpAt,
          freshUntil: validated.value.freshUntil,
        },
        cookies: validated.value.cookies,
      },
    };
  };

  return { createStepUpChallenge, verifyStepUpChallenge };
};
