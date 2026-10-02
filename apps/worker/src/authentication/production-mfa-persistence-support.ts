import { MfaFactorsResourceSchema } from '@wejammin/contracts';

import {
  asRecord,
  invalidPersistenceResponse,
  traceFor,
  type AuthProductionConfiguration,
} from './production-configuration';
import { callRpc, mapProductionFailure } from './production-http';
import type { MfaRegistrySnapshot } from './mfa-types';
import type { AuthenticationResult } from './types';

/**
 * Protected `platform_api` RPCs behind `MfaPersistencePort` (BE01a DEC-111).
 * Each is one identity transaction; the Worker never reads or writes the
 * `identity` MFA tables directly. Provider factor and challenge ids travel
 * only through these calls and never reach a browser.
 */
export const MFA_PERSISTENCE_RPC = {
  readFactors: 'auth_mfa_factors_read',
  beginEnrollment: 'auth_mfa_enrollment_begin',
  finishEnrollment: 'auth_mfa_enrollment_finish',
  prepareEnrollmentVerify: 'auth_mfa_enrollment_verify_prepare',
  settleEnrollmentVerify: 'auth_mfa_enrollment_verify_settle',
  markFactorReconciling: 'auth_mfa_factor_mark_reconciling',
  beginRemoval: 'auth_mfa_removal_begin',
  finishRemoval: 'auth_mfa_removal_finish',
  beginChallenge: 'auth_step_up_challenge_begin',
  finishChallenge: 'auth_step_up_challenge_finish',
  prepareChallengeVerify: 'auth_step_up_challenge_verify_prepare',
  recordChallengeFailure: 'auth_step_up_challenge_failure_record',
  settleChallengeVerify: 'auth_step_up_challenge_verify_settle',
} as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const VERSION_PATTERN = /^[1-9][0-9]{0,17}$/u;

export type Fields = Readonly<Record<string, unknown>>;

export const uuid = (value: unknown): string | null =>
  typeof value === 'string' && UUID_PATTERN.test(value) ? value : null;

export const version = (value: unknown): string | null =>
  typeof value === 'string' && VERSION_PATTERN.test(value) ? value : null;

export const instant = (value: unknown): string | null =>
  typeof value === 'string' &&
  Number.isFinite(Date.parse(value)) &&
  /^\d{4}-\d{2}-\d{2}T/u.test(value)
    ? value
    : null;

export const text = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 && value.length <= 80
    ? value
    : null;

export const snapshotOf = (value: unknown): MfaRegistrySnapshot | null => {
  const record = asRecord(value);
  const factors = MfaFactorsResourceSchema.shape.factors.safeParse(
    record?.factors,
  );
  const current = version(record?.version);
  return factors.success && current !== null
    ? { factors: factors.data, version: current }
    : null;
};

export const present = <T>(value: T | null): AuthenticationResult<T> =>
  value === null ? invalidPersistenceResponse() : { ok: true, value };

export const nothing = (): AuthenticationResult<null> => ({
  ok: true,
  value: null,
});

export type Parse<T> = (value: unknown) => AuthenticationResult<T>;

export type Invoke = <T>(
  name: string,
  input: Readonly<{ authUserId: string; request: Request }>,
  params: Fields,
  signal: AbortSignal,
  parse: Parse<T>,
) => Promise<AuthenticationResult<T>>;

export const createInvoker =
  (config: AuthProductionConfiguration): Invoke =>
  async <T>(
    name: string,
    input: Readonly<{ authUserId: string; request: Request }>,
    params: Fields,
    signal: AbortSignal,
    parse: Parse<T>,
  ): Promise<AuthenticationResult<T>> => {
    try {
      const trace = traceFor(input.request);
      return parse(
        await callRpc(
          config,
          name,
          {
            p_auth_user_id: input.authUserId,
            ...params,
            p_request_id: trace.requestId,
            p_correlation_id: trace.correlationId,
          },
          signal,
        ),
      );
    } catch (error) {
      return mapProductionFailure(error);
    }
  };
