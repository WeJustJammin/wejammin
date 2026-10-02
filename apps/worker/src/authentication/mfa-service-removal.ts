import {
  bareVersion,
  buildFactorsResource,
  notFoundError,
  requireEligibleAccount,
  transitionConflict,
} from './mfa-service-support';
import type {
  MfaAuthenticationMethods,
  MfaServiceDependencies,
} from './mfa-types';
import { isFreshProof, stepUpRequiredError } from './step-up';

type RemovalMethods = Required<
  Pick<MfaAuthenticationMethods, 'removeMfaFactor'>
>;

export const createRemovalService = (
  dependencies: MfaServiceDependencies,
): RemovalMethods => {
  const { persistence, provider, now } = dependencies;

  const removeMfaFactor: RemovalMethods['removeMfaFactor'] = async (
    input,
    _env,
    signal,
  ) => {
    const { session, request } = input;
    const ineligible = requireEligibleAccount(session);
    if (ineligible !== null) return ineligible;
    const caller = { authUserId: session.authUserId, request };
    const current = await persistence.readFactors(caller, signal);
    if (!current.ok) return current;
    const target = current.value.factors.find(
      (factor) => factor.id === input.factorId,
    );
    if (target === undefined) return notFoundError();
    if (target.state === 'reconciling')
      return transitionConflict(
        'factor_state_conflict',
        'refetch',
        'The authenticator is changing; reload and try again.',
      );
    if (target.state === 'verified' && !isFreshProof(session.stepUpAt, now()))
      return stepUpRequiredError();
    const begun = await persistence.beginRemoval(
      {
        ...caller,
        factorId: input.factorId,
        reason: input.reason,
        expectedVersion: bareVersion(input.ifMatch),
        idempotencyKey: input.idempotencyKey,
        sessionId: session.sessionId,
      },
      signal,
    );
    if (!begun.ok) return begun;
    if (begun.value.replay !== null)
      return buildFactorsResource(begun.value.replay, session.stepUpAt, now());
    const removed = await provider.unenroll(
      { request, providerFactorId: begun.value.providerFactorId },
      signal,
    );
    if (!removed.ok) return removed;
    const finished = await persistence.finishRemoval(
      {
        ...caller,
        factorId: input.factorId,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        sessionId: session.sessionId,
      },
      signal,
    );
    return finished.ok
      ? buildFactorsResource(finished.value, session.stepUpAt, now())
      : finished;
  };

  return { removeMfaFactor };
};
