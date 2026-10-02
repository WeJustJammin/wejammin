import {
  Cfg05b06MfaFactorResetResponseSchema,
  type Cfg05b06MfaFactorResetResponse,
} from '@wejammin/contracts';

import { authError } from '../authentication/boundary';
import {
  asRecord,
  type AuthProductionConfiguration,
} from '../authentication/production-configuration';
import type { AuthenticationResult } from '../authentication/types';
import { supabaseRpcHeaders } from '../supabase-rpc-headers';
import {
  configurationDatabaseContext,
  configurationReadRpc,
} from './production-request';
import { createOperatorFactorRemover } from './admin-mfa-reset-provider';
import type { AdminMfaFactorResetPort } from './types';

/**
 * Protected `platform_api` RPCs for CFG-05B-06. `admin_mfa_factor_reset` is
 * the single reservation transaction (BE05b record, audit, outbox, grant and
 * membership predicate, then `identity.rpc_admin_reset_mfa_factors`);
 * `admin_mfa_factor_reset_settle` records each provider outcome.
 */
export const ADMIN_MFA_RESET_RPC = {
  reserve: 'admin_mfa_factor_reset',
  settle: 'admin_mfa_factor_reset_settle',
} as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

type Reservation = Readonly<{
  targetAuthUserId: string;
  pendingProviderFactorIds: readonly string[];
  response: Cfg05b06MfaFactorResetResponse;
}>;

const invalidResponse = () =>
  authError(
    502,
    'UPSTREAM_FAILURE',
    'The admin workspace dependency returned an invalid response.',
  );

/** Picks the public fields so internal identifiers can never be echoed. */
const publicResponse = (
  record: Readonly<Record<string, unknown>> | null,
): AuthenticationResult<Cfg05b06MfaFactorResetResponse> => {
  const parsed = Cfg05b06MfaFactorResetResponseSchema.safeParse({
    resetId: record?.resetId,
    targetPersonId: record?.targetPersonId,
    state: record?.state,
    removedFactorCount: record?.removedFactorCount,
    mfaVersion: record?.mfaVersion,
    outboxEventId: record?.outboxEventId,
  });
  return parsed.success ? { ok: true, value: parsed.data } : invalidResponse();
};

const readReservation = (value: unknown): AuthenticationResult<Reservation> => {
  const record = asRecord(value);
  const response = publicResponse(record);
  const pending = record?.pendingProviderFactorIds;
  const targetAuthUserId = record?.targetAuthUserId;
  if (
    !response.ok ||
    !Array.isArray(pending) ||
    pending.length > 10 ||
    !pending.every((id) => typeof id === 'string' && UUID_PATTERN.test(id)) ||
    (pending.length > 0 &&
      (typeof targetAuthUserId !== 'string' ||
        !UUID_PATTERN.test(targetAuthUserId)))
  )
    return invalidResponse();
  return {
    ok: true,
    value: {
      targetAuthUserId:
        typeof targetAuthUserId === 'string' ? targetAuthUserId : '',
      pendingProviderFactorIds: pending as string[],
      response: response.value,
    },
  };
};

const asIdentityOutage = <T>(
  outcome: AuthenticationResult<T>,
): AuthenticationResult<T> =>
  !outcome.ok && (outcome.status === 500 || outcome.status === 503)
    ? authError(
        503,
        'IDENTITY_UNAVAILABLE',
        'The identity service is temporarily unavailable.',
      )
    : outcome;

export const createAdminMfaResetPort = (
  config: AuthProductionConfiguration,
): AdminMfaFactorResetPort => {
  const remover = createOperatorFactorRemover(config, {
    headers: supabaseRpcHeaders(config.secret),
  });

  return async (input, _env, signal) => {
    const portInput = {
      operationId: 'CFG-05B-05' as const,
      request: input.request,
      session: input.session,
    };
    const context = configurationDatabaseContext(portInput);
    const call = <T>(
      rpc: string,
      body: Readonly<Record<string, unknown>>,
      parse: (value: unknown) => AuthenticationResult<T>,
    ) =>
      configurationReadRpc(
        config,
        portInput,
        signal,
        rpc,
        {
          safeParse: (value: unknown) => {
            const parsed = parse(value);
            return parsed.ok
              ? ({ success: true, data: parsed.value } as const)
              : ({ success: false } as const);
          },
        },
        { ...body, context },
      );
    const reserved = asIdentityOutage(
      await call(
        ADMIN_MFA_RESET_RPC.reserve,
        {
          targetPersonId: input.body.targetPersonId,
          reason: input.body.reason,
          idempotencyKey: input.idempotencyKey,
        },
        readReservation,
      ),
    );
    if (!reserved.ok) return reserved;
    const { pendingProviderFactorIds, response, targetAuthUserId } =
      reserved.value;
    if (pendingProviderFactorIds.length === 0)
      return { ok: true, value: response };
    const removal = await remover.removeAll(
      targetAuthUserId,
      pendingProviderFactorIds,
      signal,
    );
    if (!removal.ok) return removal;
    return asIdentityOutage(
      await call(
        ADMIN_MFA_RESET_RPC.settle,
        { resetId: response.resetId, outcomes: removal.value },
        (value) => publicResponse(asRecord(value)),
      ),
    );
  };
};
