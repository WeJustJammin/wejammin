import { authError } from './boundary';
import {
  authEncoder,
  MAX_RESPONSE_BYTES,
  type AuthProductionConfiguration,
} from './production-configuration';
import {
  mfaRpcFailures,
  verificationLockFailure,
  type RpcFailure,
} from './production-mfa-failures';
import { MFA_METHOD_REGISTRY } from './step-up';
import type { AuthenticationError } from './types';
import { supabaseRpcHeaders } from '../supabase-rpc-headers';

const readBoundedJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (authEncoder.encode(text).byteLength > MAX_RESPONSE_BYTES) {
    throw authError(
      502,
      'PROVIDER_INVALID_RESPONSE',
      'The authentication provider returned an invalid response.',
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw authError(
      502,
      'PROVIDER_INVALID_RESPONSE',
      'The authentication provider returned an invalid response.',
    );
  }
};

const isAuthenticationError = (value: unknown): value is AuthenticationError =>
  typeof value === 'object' &&
  value !== null &&
  'ok' in value &&
  value.ok === false;

export const mapProductionFailure = (error: unknown): AuthenticationError => {
  if (isAuthenticationError(error)) return error;
  if (error instanceof DOMException && error.name === 'AbortError') {
    return authError(
      504,
      'DEPENDENCY_TIMEOUT',
      'The authentication provider timed out.',
    );
  }
  return authError(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Authentication is temporarily unavailable.',
  );
};

export const callAuthJson = async (
  config: AuthProductionConfiguration,
  path: string,
  init: RequestInit,
): Promise<unknown> => {
  let response: Response;
  try {
    response = await config.fetchImpl(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        apikey: config.secret,
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    throw mapProductionFailure(error);
  }
  if (response.status < 200 || response.status >= 300) {
    if (response.status === 429)
      throw authError(429, 'RATE_LIMITED', 'Too many requests.');
    if (response.status >= 500)
      throw authError(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Authentication is temporarily unavailable.',
      );
    throw authError(
      401,
      'UNAUTHENTICATED',
      'The authentication session is invalid.',
    );
  }
  return response.status === 204 ? {} : readBoundedJson(response);
};

const knownRpcFailures: readonly RpcFailure[] = [
  ...mfaRpcFailures,
  {
    match: 'IDEMPOTENCY_MISMATCH',
    status: 409,
    code: 'IDEMPOTENCY_MISMATCH',
    message: 'The idempotency key was used for another request.',
  },
  {
    match: 'VERSION_MISMATCH',
    status: 409,
    code: 'VERSION_MISMATCH',
    message: 'The resource changed; reload and try again.',
  },
  {
    match: 'PROVIDER_ALREADY_LINKED',
    status: 409,
    code: 'PROVIDER_ALREADY_LINKED',
    message: 'The login method is already linked.',
  },
  {
    match: 'FINAL_LOGIN_METHOD',
    status: 409,
    code: 'FINAL_LOGIN_METHOD',
    message: 'A verified recovery method is required.',
  },
  {
    match: 'LOGIN_METHOD_RECONCILING',
    status: 409,
    code: 'LOGIN_METHOD_RECONCILING',
    message: 'The login method change is still being reconciled.',
  },
  {
    match: 'MERGE_ALREADY_ACTIVE',
    status: 409,
    code: 'MERGE_ALREADY_ACTIVE',
    message: 'An account merge is already in progress.',
  },
  {
    match: 'SAME_ACCOUNT',
    status: 409,
    code: 'SAME_ACCOUNT',
    message: 'The accounts cannot be merged.',
  },
  {
    match: 'MERGE_STATE_CONFLICT',
    status: 409,
    code: 'MERGE_STATE_CONFLICT',
    message: 'The merge is not in a mutable state.',
  },
  {
    match: 'MERGE_PLAN_STALE',
    status: 409,
    code: 'MERGE_PLAN_STALE',
    message: 'The merge plan is stale; reload and review it.',
  },
  {
    match: 'MERGE_CONFLICTS_UNRESOLVED',
    status: 409,
    code: 'MERGE_CONFLICTS_UNRESOLVED',
    message: 'All merge conflicts must be resolved first.',
  },
  {
    match: 'CONTEXT_NOT_FOUND',
    status: 404,
    code: 'CONTEXT_NOT_FOUND',
    message: 'The acting context was not found.',
  },
  {
    match: 'CONTEXT_REVOKED',
    status: 403,
    code: 'CONTEXT_REVOKED',
    message: 'The acting context is no longer available.',
  },
  {
    match: 'CONTEXT_RECONFIRM_REQUIRED',
    status: 403,
    code: 'CONTEXT_RECONFIRM_REQUIRED',
    message: 'Fresh confirmation is required.',
  },
  {
    match: 'NOT_FOUND',
    status: 404,
    code: 'NOT_FOUND',
    message: 'The requested resource was not found.',
  },
  {
    match: 'STEP_UP_REQUIRED',
    status: 401,
    code: 'STEP_UP_REQUIRED',
    message: 'Recent verification is required.',
    details: {
      recoveryAction: 'step_up',
      allowedMethods: [...MFA_METHOD_REGISTRY],
    },
  },
  {
    match: 'FORBIDDEN',
    status: 403,
    code: 'FORBIDDEN',
    message: 'The action is not allowed.',
  },
  {
    match: 'ACCOUNT_NOT_ELIGIBLE',
    status: 403,
    code: 'ACCOUNT_NOT_ELIGIBLE',
    message: 'The account is not eligible for this action.',
  },
  {
    match: 'PROVIDER_NOT_AVAILABLE',
    status: 422,
    code: 'PROVIDER_NOT_AVAILABLE',
    message: 'The selected provider is not available.',
  },
  {
    match: 'ACKNOWLEDGEMENT_UNKNOWN',
    status: 422,
    code: 'ACKNOWLEDGEMENT_UNKNOWN',
    message: 'The merge acknowledgement is not registered.',
  },
  {
    match: 'LOGIN_IDENTITY_CONFLICT',
    status: 409,
    code: 'LOGIN_IDENTITY_CONFLICT',
    message: 'The login identity cannot be used for this merge.',
  },
  {
    match: 'AUTH_CALLBACK_INVALID',
    status: 400,
    code: 'AUTH_CALLBACK_INVALID',
    message: 'The authentication callback is invalid.',
  },
  {
    match: 'INVALID_REQUEST',
    status: 400,
    code: 'INVALID_REQUEST',
    message: 'The authentication request is invalid.',
  },
  {
    match: 'UNAUTHENTICATED',
    status: 401,
    code: 'UNAUTHENTICATED',
    message: 'The authentication session is invalid.',
  },
];

export const callRpc = async (
  config: AuthProductionConfiguration,
  name: string,
  body: Readonly<Record<string, unknown>>,
  signal: AbortSignal,
  extraHeaders: Readonly<Record<string, string>> = {},
): Promise<unknown> => {
  let response: Response;
  try {
    response = await config.fetchImpl(`${config.baseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      signal,
      headers: {
        accept: 'application/json',
        ...supabaseRpcHeaders(config.secret),
        'accept-profile': 'platform_api',
        'content-profile': 'platform_api',
        'content-type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw mapProductionFailure(error);
  }
  if (response.status < 200 || response.status >= 300) {
    let code: unknown;
    try {
      const payload = (await readBoundedJson(response)) as {
        message?: unknown;
      };
      code = payload.message;
    } catch {
      code = null;
    }
    const rpcFailure = typeof code === 'string' ? code : '';
    const locked = verificationLockFailure(rpcFailure);
    if (locked !== null) throw locked;
    const mapped = knownRpcFailures.find(({ match }) =>
      rpcFailure.includes(match),
    );
    if (mapped !== undefined) {
      throw authError(
        mapped.status,
        mapped.code,
        mapped.message,
        mapped.details,
      );
    }
    throw authError(
      503,
      'DEPENDENCY_UNAVAILABLE',
      'Authentication persistence is unavailable.',
    );
  }
  return readBoundedJson(response);
};
