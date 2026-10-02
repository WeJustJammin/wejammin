import { AuthReturnTargetSchema, RequestIdSchema } from '@wejammin/contracts';

import { authError } from './boundary';
import {
  authDecoder,
  asRecord,
  base64UrlDecode,
  base64UrlEncode,
  bytea,
  sha256Hex,
  traceFor,
  type AuthFlowCookie,
  type AuthProductionConfiguration,
  type VerifiedAuthToken,
} from './production-configuration';
import { callAuthJson, callRpc, mapProductionFailure } from './production-http';
import { FLOW_COOKIE, sealFlowCookie, secureCookie } from './production-cookie';
import type { AuthenticationResult, AuthenticationSession } from './types';

const decodeJwtPayload = (
  token: string,
): Readonly<Record<string, unknown>> | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[1] === undefined) return null;
    const value = JSON.parse(
      authDecoder.decode(base64UrlDecode(parts[1])),
    ) as unknown;
    return typeof value === 'object' && value !== null
      ? (value as Readonly<Record<string, unknown>>)
      : null;
  } catch {
    return null;
  }
};

const MFA_AMR_METHODS: readonly string[] = ['mfa', 'totp', 'webauthn', 'phone'];

/**
 * Latest valid `amr` timestamp whose method satisfies `accepts`: positive
 * safe-integer Unix seconds, not more than 30 seconds ahead of the Worker
 * clock; anything else is ignored. JWT `iat` is never consulted.
 */
const amrTime = (
  claims: Readonly<Record<string, unknown>>,
  now: number,
  accepts: (method: string) => boolean,
): string | null => {
  if (!Array.isArray(claims.amr)) return null;
  const timestamps = claims.amr.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const method = (entry as Readonly<Record<string, unknown>>).method;
    const timestamp = (entry as Readonly<Record<string, unknown>>).timestamp;
    if (
      !accepts(String(method)) ||
      typeof timestamp !== 'number' ||
      !Number.isSafeInteger(timestamp) ||
      timestamp <= 0 ||
      timestamp * 1000 > now + 30_000
    )
      return [];
    return [timestamp];
  });
  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps) * 1000).toISOString();
};

const mfaVerificationTime = (
  claims: Readonly<Record<string, unknown>>,
  now: number,
): string | null =>
  amrTime(claims, now, (method) => MFA_AMR_METHODS.includes(method));

/** A primary sign-in method is any `amr` method that is not an MFA method. */
const primaryAuthenticationTime = (
  claims: Readonly<Record<string, unknown>>,
  now: number,
): string | null =>
  amrTime(claims, now, (method) => !MFA_AMR_METHODS.includes(method));

const providerSubject = (
  user: Readonly<Record<string, unknown>>,
  provider: string | undefined,
): string | null => {
  if (
    provider === undefined ||
    provider === 'email' ||
    !Array.isArray(user.identities)
  )
    return null;
  const identity = user.identities.find(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      (entry as Readonly<Record<string, unknown>>).provider === provider,
  ) as Readonly<Record<string, unknown>> | undefined;
  const value = identity?.identity_id ?? identity?.id;
  return typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 512 &&
    ![...value].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    })
    ? value
    : null;
};

export const createAuthFlow = async (
  input: Readonly<{
    provider: string;
    intent: string;
    returnTo: string;
    mergeId?: string | undefined;
  }>,
  request: Request,
  session: AuthenticationSession | null,
  config: AuthProductionConfiguration,
  signal: AbortSignal,
) => {
  const state = base64UrlEncode(config.randomBytes(32));
  const nonce = base64UrlEncode(config.randomBytes(32));
  const verifier = base64UrlEncode(config.randomBytes(64));
  const expiresAt = new Date(config.now() + 10 * 60 * 1000).toISOString();
  const trace = traceFor(request);
  const created = asRecord(
    await callRpc(
      config,
      'auth_intent_create',
      {
        p_state_digest: bytea(await sha256Hex(state)),
        p_intent: input.intent,
        p_provider: input.provider,
        p_auth_user_id: session?.authUserId ?? null,
        p_session_id: session?.sessionId ?? null,
        p_merge_id: input.mergeId ?? null,
        p_return_path: input.returnTo,
        p_nonce_digest: bytea(await sha256Hex(nonce)),
        p_pkce_verifier_digest: bytea(await sha256Hex(verifier)),
        p_expires_at: expiresAt,
        p_request_id: trace.requestId,
        p_correlation_id: trace.correlationId,
      },
      signal,
    ),
  );
  if (created === null || typeof created.intentId !== 'string') {
    throw authError(
      502,
      'DEPENDENCY_INVALID_RESPONSE',
      'Authentication persistence returned an invalid response.',
    );
  }
  const flow: AuthFlowCookie = {
    state,
    nonce,
    verifier,
    provider: input.provider,
    intent: input.intent,
    expiresAt,
  };
  return {
    state,
    nonce,
    verifier,
    challenge: base64UrlEncode(
      new Uint8Array(
        await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(verifier),
        ),
      ),
    ),
    expiresAt,
    intentId: created.intentId,
    cookie: secureCookie(FLOW_COOKIE, await sealFlowCookie(flow, config), 600),
  } as const;
};

export const verifyTokenResponse = async (
  payload: unknown,
  config: AuthProductionConfiguration,
  signal: AbortSignal,
  expectedNonce?: string,
  expectedProvider?: string,
): Promise<AuthenticationResult<VerifiedAuthToken>> => {
  if (typeof payload !== 'object' || payload === null) {
    return authError(
      502,
      'PROVIDER_INVALID_RESPONSE',
      'The authentication provider returned an invalid response.',
    );
  }
  const candidate = payload as Readonly<Record<string, unknown>>;
  const hasIdentityToken = Object.prototype.hasOwnProperty.call(
    candidate,
    'id_token',
  );
  if (
    typeof candidate.access_token !== 'string' ||
    typeof candidate.refresh_token !== 'string' ||
    (hasIdentityToken && typeof candidate.id_token !== 'string')
  ) {
    return authError(
      502,
      'PROVIDER_INVALID_RESPONSE',
      'The authentication provider returned an invalid response.',
    );
  }
  let userPayload: unknown;
  try {
    userPayload = await callAuthJson(config, '/auth/v1/user', {
      method: 'GET',
      signal,
      headers: { authorization: `Bearer ${candidate.access_token}` },
    });
  } catch (error) {
    return mapProductionFailure(error);
  }
  const claims = decodeJwtPayload(candidate.access_token);
  const identityClaims =
    typeof candidate.id_token === 'string'
      ? decodeJwtPayload(candidate.id_token)
      : null;
  const user =
    typeof userPayload === 'object' && userPayload !== null
      ? (userPayload as Readonly<Record<string, unknown>>)
      : null;
  const authUserId = user?.id;
  const sessionId = claims?.session_id ?? claims?.sid;
  const expires = claims?.exp;
  const issuer = claims?.iss;
  const audience = claims?.aud;
  const subject =
    user === null ? null : providerSubject(user, expectedProvider);
  const requiresProviderSubject =
    expectedProvider !== undefined && expectedProvider !== 'email';
  const verifiesReturnedOidcNonce =
    requiresProviderSubject &&
    expectedNonce !== undefined &&
    typeof candidate.id_token === 'string';
  if (
    typeof authUserId !== 'string' ||
    !RequestIdSchema.safeParse(authUserId).success ||
    claims?.sub !== authUserId ||
    typeof sessionId !== 'string' ||
    !RequestIdSchema.safeParse(sessionId).success ||
    typeof expires !== 'number' ||
    expires * 1000 <= config.now() ||
    issuer !== `${config.baseUrl}/auth/v1` ||
    !(
      audience === 'authenticated' ||
      (Array.isArray(audience) && audience.includes('authenticated'))
    ) ||
    (hasIdentityToken && identityClaims === null) ||
    (verifiesReturnedOidcNonce &&
      (identityClaims === null || identityClaims.nonce !== expectedNonce)) ||
    (requiresProviderSubject && subject === null)
  ) {
    return authError(
      502,
      'PROVIDER_INVALID_RESPONSE',
      'The authentication provider returned an invalid response.',
    );
  }
  return {
    ok: true,
    value: {
      accessToken: candidate.access_token,
      refreshToken: candidate.refresh_token,
      authUserId,
      sessionId,
      expiresAt: new Date(expires * 1000).toISOString(),
      stepUpAt: mfaVerificationTime(claims, config.now()),
      primaryAuthAt: primaryAuthenticationTime(claims, config.now()),
      aal: claims.aal === 'aal1' || claims.aal === 'aal2' ? claims.aal : null,
      providerSubjectDigest:
        subject === null || expectedProvider === undefined
          ? null
          : bytea(await sha256Hex(`${expectedProvider}\u0000${subject}`)),
    },
  };
};

export const validateReturnPath = (value: unknown): string | null => {
  const parsed = AuthReturnTargetSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};
