import {
  Cfg05b06MfaFactorResetResponseSchema,
  type Cfg05b06MfaFactorResetResponse,
} from '@wejammin/contracts';

import {
  mfaApiCall,
  type ApiOutcome,
  type MfaApiDeps,
} from '../../identity-authority/step-up-mfa/mfa-api';
import { networkFailure } from '../../identity-authority/step-up-mfa/mfa-failure';
import { buildResetRequest, type ResetValues } from './admin-mfa-reset-values';

export const ADMIN_RESET_PATH = '/api/v1/admin/identity/mfa-factor-resets';

/**
 * CFG-05B-06. The body is exactly `{ targetPersonId, reason }`; operator,
 * organization, capability and step-up time are server-derived. The caller
 * owns the `Idempotency-Key`, so a retry of an unknown outcome replays the
 * same request.
 */
export const submitMfaFactorReset = (
  values: ResetValues,
  idempotencyKey: string,
  deps: MfaApiDeps = {},
): Promise<ApiOutcome<Cfg05b06MfaFactorResetResponse>> => {
  const body = buildResetRequest(values);
  if (body === null)
    return Promise.resolve({
      ok: false,
      failure: { ...networkFailure(), status: 400, code: 'INVALID_REQUEST' },
    });
  return mfaApiCall(
    { method: 'POST', path: ADMIN_RESET_PATH, body, idempotencyKey },
    Cfg05b06MfaFactorResetResponseSchema,
    deps,
  );
};
