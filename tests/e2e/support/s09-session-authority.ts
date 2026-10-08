export const SESSION_SIGNING_SECRET = 's09-real-route-session-secret';

export const isLocalSessionId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^80000000-0000-4000-8000-[0-9a-f]{12}$/u.test(value);

const cookieValue = (request: Request, name: string): string | null => {
  const cookie = request.headers.get('cookie') ?? '';
  for (const part of cookie.split(';')) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf('=');
    if (separator > 0 && trimmed.slice(0, separator) === name)
      return trimmed.slice(separator + 1);
  }
  return null;
};

const decodeBase64Url = (value: string): Uint8Array | null => {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  try {
    const padded =
      value.replace(/-/gu, '+').replace(/_/gu, '/') +
      '='.repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
};

export type LocalSessionClaim = Readonly<{
  userId: string;
  sessionId: string;
}>;

/** A verified local session together with every claim its signed token carries. */
export type LocalSessionPayload = LocalSessionClaim &
  Readonly<{ claims: Readonly<Record<string, unknown>> }>;

/**
 * Verify a signed local-only session request for ANY subject and return the
 * claim with the full signed payload, or null. The reference cookie, HS256
 * signature, expiry, session-ID shape, and revocation checks are the ones every
 * local verifier needs; callers decide which subjects they accept.
 */
export const verifyLocalSessionPayload = async (
  revokedSessionIds: ReadonlySet<string>,
  request: Request,
): Promise<LocalSessionPayload | null> => {
  const signingKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SESSION_SIGNING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  if (cookieValue(request, 'wj_session_ref') === null) return null;
  const token = cookieValue(request, 'wj_access');
  if (token === null) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] === undefined || parts[1] === undefined)
    return null;
  const encodedHeader = decodeBase64Url(parts[0]);
  const encodedPayload = decodeBase64Url(parts[1]);
  const encodedSignature = decodeBase64Url(parts[2] ?? '');
  if (
    encodedHeader === null ||
    encodedPayload === null ||
    encodedSignature === null
  )
    return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(encodedHeader)) as {
      alg?: unknown;
      typ?: unknown;
    };
    const payload = JSON.parse(new TextDecoder().decode(encodedPayload)) as {
      exp?: unknown;
      session_id?: unknown;
      sub?: unknown;
    } & Record<string, unknown>;
    if (header.alg !== 'HS256' || header.typ !== 'JWT') return null;
    if (
      typeof payload.sub !== 'string' ||
      !isLocalSessionId(payload.session_id) ||
      typeof payload.exp !== 'number' ||
      !Number.isSafeInteger(payload.exp) ||
      payload.exp <= Math.floor(Date.now() / 1_000) ||
      revokedSessionIds.has(payload.session_id)
    )
      return null;
    const signatureValid = await crypto.subtle.verify(
      'HMAC',
      signingKey,
      encodedSignature,
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!signatureValid) return null;
    return {
      userId: payload.sub,
      sessionId: payload.session_id,
      claims: payload,
    };
  } catch {
    return null;
  }
};

/**
 * Verify a signed local-only session request for one expected subject and
 * return the claim, or null. Identical to the boolean verifier; only a
 * post-verification profile lookup is added by callers that need the identity.
 */
export const verifyLocalSessionRequest = async (
  expectedUserId: string,
  revokedSessionIds: ReadonlySet<string>,
  request: Request,
): Promise<LocalSessionClaim | null> => {
  const verified = await verifyLocalSessionPayload(revokedSessionIds, request);
  return verified !== null && verified.userId === expectedUserId
    ? { userId: verified.userId, sessionId: verified.sessionId }
    : null;
};

/** Create a local-only authority verifier for the production-route harness. */
export const createSessionVerifier =
  (
    expectedUserId: string,
    revokedSessionIds: ReadonlySet<string>,
  ): ((request: Request) => Promise<boolean>) =>
  async (request: Request): Promise<boolean> =>
    (await verifyLocalSessionRequest(
      expectedUserId,
      revokedSessionIds,
      request,
    )) !== null;
