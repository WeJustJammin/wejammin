import {
  asRecord,
  hashRequest,
  invalidPersistenceResponse,
} from './production-configuration';
import type { MfaPersistencePort, MfaRegistrySnapshot } from './mfa-types';
import {
  MFA_PERSISTENCE_RPC,
  instant,
  nothing,
  present,
  snapshotOf,
  uuid,
  version,
  type Invoke,
  type Parse,
} from './production-mfa-persistence-support';
import type { AuthenticationResult } from './types';

type RegistryMethods = Pick<
  MfaPersistencePort,
  | 'readFactors'
  | 'beginEnrollment'
  | 'finishEnrollment'
  | 'prepareEnrollmentVerify'
  | 'recordVerificationFailure'
  | 'settleEnrollmentVerify'
  | 'markFactorReconciling'
  | 'beginRemoval'
  | 'finishRemoval'
>;

/** Factor registry transactions: enrollment, verification and removal. */
export const createRegistryPersistence = (invoke: Invoke): RegistryMethods => {
  const snapshotReply: Parse<MfaRegistrySnapshot> = (value) =>
    present(snapshotOf(value));

  return {
    readFactors: (input, signal) =>
      invoke(MFA_PERSISTENCE_RPC.readFactors, input, {}, signal, snapshotReply),

    beginEnrollment: (input, signal) =>
      invoke(
        MFA_PERSISTENCE_RPC.beginEnrollment,
        input,
        {
          p_friendly_name: input.friendlyName,
          p_expected_version: input.expectedVersion,
        },
        signal,
        (value) => {
          const record = asRecord(value);
          const superseded =
            record?.supersededProviderFactorId === null
              ? null
              : uuid(record?.supersededProviderFactorId);
          const current = version(record?.version);
          return record !== null &&
            current !== null &&
            (superseded !== null || record.supersededProviderFactorId === null)
            ? {
                ok: true,
                value: {
                  supersededProviderFactorId: superseded,
                  version: current,
                },
              }
            : invalidPersistenceResponse();
        },
      ),

    finishEnrollment: (input, signal) =>
      invoke(
        MFA_PERSISTENCE_RPC.finishEnrollment,
        input,
        {
          p_provider_factor_id: input.providerFactorId,
          p_friendly_name: input.friendlyName,
          p_expected_version: input.expectedVersion,
          p_session_id: input.sessionId,
        },
        signal,
        (value) => {
          const record = asRecord(value);
          const factorId = uuid(record?.factorId);
          const expiresAt = instant(record?.expiresAt);
          const current = version(record?.version);
          return present(
            factorId === null || expiresAt === null || current === null
              ? null
              : { factorId, expiresAt, version: current },
          );
        },
      ),

    prepareEnrollmentVerify: (input, signal) =>
      invoke(
        MFA_PERSISTENCE_RPC.prepareEnrollmentVerify,
        input,
        {
          p_factor_id: input.factorId,
          p_expected_version: input.expectedVersion,
        },
        signal,
        (value) => {
          const providerFactorId = uuid(asRecord(value)?.providerFactorId);
          return present(
            providerFactorId === null ? null : { providerFactorId },
          );
        },
      ),

    settleEnrollmentVerify: (input, signal) =>
      invoke(
        MFA_PERSISTENCE_RPC.settleEnrollmentVerify,
        input,
        {
          p_factor_id: input.factorId,
          p_expected_version: input.expectedVersion,
          p_session_id: input.sessionId,
          p_new_session_id: input.rotation.sessionId,
          p_issued_at: input.rotation.issuedAt,
        },
        signal,
        snapshotReply,
      ),

    recordVerificationFailure: (input, signal) =>
      invoke(
        MFA_PERSISTENCE_RPC.recordVerificationFailure,
        input,
        { p_outcome: input.outcome },
        signal,
        nothing,
      ),

    markFactorReconciling: (input, signal) =>
      invoke(
        MFA_PERSISTENCE_RPC.markFactorReconciling,
        input,
        { p_factor_id: input.factorId },
        signal,
        nothing,
      ),

    beginRemoval: async (input, signal) => {
      const keyHash = await hashRequest(input.idempotencyKey);
      const requestHash = await hashRequest({
        factorId: input.factorId,
        reason: input.reason,
        expectedVersion: input.expectedVersion,
      });
      return invoke(
        MFA_PERSISTENCE_RPC.beginRemoval,
        input,
        {
          p_factor_id: input.factorId,
          p_reason: input.reason,
          p_expected_version: input.expectedVersion,
          p_session_id: input.sessionId,
          p_key_hash: keyHash,
          p_request_hash: requestHash,
        },
        signal,
        (
          value,
        ): AuthenticationResult<
          Readonly<{
            providerFactorId: string;
            replay: MfaRegistrySnapshot | null;
          }>
        > => {
          const record = asRecord(value);
          const providerFactorId = uuid(record?.providerFactorId);
          if (providerFactorId === null) return invalidPersistenceResponse();
          if (record?.replay === null || record?.replay === undefined)
            return { ok: true, value: { providerFactorId, replay: null } };
          const replay = snapshotOf(record.replay);
          return replay === null
            ? invalidPersistenceResponse()
            : { ok: true, value: { providerFactorId, replay } };
        },
      );
    },

    finishRemoval: async (input, signal) =>
      invoke(
        MFA_PERSISTENCE_RPC.finishRemoval,
        input,
        {
          p_factor_id: input.factorId,
          p_reason: input.reason,
          p_session_id: input.sessionId,
          p_key_hash: await hashRequest(input.idempotencyKey),
        },
        signal,
        snapshotReply,
      ),
  };
};
