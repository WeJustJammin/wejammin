import { asRecord } from './production-configuration';
import type { MfaPersistencePort } from './mfa-types';
import {
  MFA_PERSISTENCE_RPC,
  instant,
  nothing,
  present,
  text,
  uuid,
  type Invoke,
} from './production-mfa-persistence-support';

type StepUpMethods = Pick<
  MfaPersistencePort,
  | 'beginChallenge'
  | 'finishChallenge'
  | 'prepareChallengeVerify'
  | 'recordChallengeFailure'
  | 'settleChallengeVerify'
>;

/** Step-up challenge transactions (AUTH-API-20 and AUTH-API-21). */
export const createStepUpPersistence = (invoke: Invoke): StepUpMethods => ({
  beginChallenge: (input, signal) =>
    invoke(
      MFA_PERSISTENCE_RPC.beginChallenge,
      input,
      {
        p_session_id: input.sessionId,
        p_method: input.method,
        p_factor_id: input.factorId,
      },
      signal,
      (value) => {
        const record = asRecord(value);
        const factorId = uuid(record?.factorId);
        const providerFactorId = uuid(record?.providerFactorId);
        const friendlyName = text(record?.friendlyName);
        return present(
          factorId === null ||
            providerFactorId === null ||
            friendlyName === null
            ? null
            : { factorId, providerFactorId, friendlyName },
        );
      },
    ),

  finishChallenge: (input, signal) =>
    invoke(
      MFA_PERSISTENCE_RPC.finishChallenge,
      input,
      {
        p_session_id: input.sessionId,
        p_factor_id: input.factorId,
        p_provider_challenge_id: input.providerChallengeId,
        p_expires_at: input.expiresAt,
      },
      signal,
      (value) => {
        const record = asRecord(value);
        const challengeId = uuid(record?.challengeId);
        const expiresAt = instant(record?.expiresAt);
        return present(
          challengeId === null || expiresAt === null
            ? null
            : { challengeId, expiresAt },
        );
      },
    ),

  prepareChallengeVerify: (input, signal) =>
    invoke(
      MFA_PERSISTENCE_RPC.prepareChallengeVerify,
      input,
      { p_session_id: input.sessionId, p_challenge_id: input.challengeId },
      signal,
      (value) => {
        const record = asRecord(value);
        const factorId = uuid(record?.factorId);
        const providerFactorId = uuid(record?.providerFactorId);
        const providerChallengeId = uuid(record?.providerChallengeId);
        const expiresAt = instant(record?.expiresAt);
        return present(
          factorId === null ||
            providerFactorId === null ||
            providerChallengeId === null ||
            expiresAt === null
            ? null
            : { factorId, providerFactorId, providerChallengeId, expiresAt },
        );
      },
    ),

  recordChallengeFailure: (input, signal) =>
    invoke(
      MFA_PERSISTENCE_RPC.recordChallengeFailure,
      input,
      {
        p_session_id: input.sessionId,
        p_challenge_id: input.challengeId,
        p_outcome: input.outcome,
      },
      signal,
      nothing,
    ),

  settleChallengeVerify: (input, signal) =>
    invoke(
      MFA_PERSISTENCE_RPC.settleChallengeVerify,
      input,
      { p_session_id: input.sessionId, p_challenge_id: input.challengeId },
      signal,
      nothing,
    ),
});
