import { STEP_UP_SCOPE_COOKIE } from '../components/identity-authority/step-up-mfa/step-up-binding';

/**
 * The step-up scope (review r14 finding 2, hardened by the F5 review). Tab-held
 * step-up drafts and pending-command envelopes are bound to a scope so a later
 * user in the same tab can never restore the previous person's interrupted
 * command.
 *
 * The browser cannot read its HttpOnly session cookies, and the FE03 island
 * invariant keeps actor, party and binding identifiers (raw, hashed or
 * truncated) away from page scripts. So the cookie a script CAN read,
 * `wj_step_up_scope`, holds only a RANDOM opaque nonce: nothing in it is derived
 * from the subject, and two sign-ins of the same person get different nonces.
 * Which subject a nonce belongs to is remembered in a separate HttpOnly cookie,
 * `wj_step_up_subject`, holding an UNKEYED SHA-256 digest of a fixed domain
 * string plus the access-token subject. There is no secret and so nothing to
 * deploy or rotate. The cookie is HttpOnly (never script-readable) and the
 * server already receives the subject in the HttpOnly `wj_access` token, so the
 * digest adds no exposure. Only the edge reads it, to notice a subject change (a
 * different user on the same browser) and rotate the nonce. The nonce follows
 * the subject, not the session id, because the step-up proof rotates the
 * session id mid-detour. Both cookies are expired when the page no longer
 * carries a session.
 *
 * The token is decoded, not verified: the scope is a hygiene key for storage the
 * same browser already owns, never an authorization input, and every protected
 * request is still verified by the Worker.
 */

export { STEP_UP_SCOPE_COOKIE };

/** The HttpOnly cookie that binds the nonce to the subject (unkeyed SHA-256 of the subject). */
export const STEP_UP_SUBJECT_COOKIE = 'wj_step_up_subject';

const SCOPE_DOMAIN = 'wj-step-up-subject-v3';
const NONCE_BYTES = 24;
const SESSION_COOKIES = ['wj_access', 'wj_refresh', 'wj_session_ref'] as const;

export type StepUpScopeDecision =
  | Readonly<{
      kind: 'issue';
      /** The random script-readable nonce to hold. */
      nonce: string;
      /** The HttpOnly binding to hold: the unkeyed SHA-256 digest of the subject. */
      subjectDigest: string;
    }>
  | Readonly<{ kind: 'clear' }>
  | Readonly<{ kind: 'keep' }>;

const cookieValue = (request: Request, name: string): string | null => {
  const jar = request.headers.get('cookie');
  if (jar === null) return null;
  for (const part of jar.split(';')) {
    const item = part.trim();
    if (item.startsWith(`${name}=`)) return item.slice(name.length + 1);
  }
  return null;
};

const base64UrlToBytes = (value: string): Uint8Array => {
  const padded = value
    .replace(/-/gu, '+')
    .replace(/_/gu, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_')
    .replace(/=+$/u, '');
};

const subjectOf = (accessToken: string): string | null => {
  try {
    const payload = accessToken.split('.')[1];
    if (payload === undefined) return null;
    const claims = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(payload)),
    ) as { sub?: unknown };
    return typeof claims.sub === 'string' &&
      claims.sub.length > 0 &&
      claims.sub.length <= 128
      ? claims.sub
      : null;
  } catch {
    return null;
  }
};

const NONCE_PATTERN = /^[A-Za-z0-9_-]{32}$/u;
const DIGEST_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

const freshNonce = (): string =>
  bytesToBase64Url(crypto.getRandomValues(new Uint8Array(NONCE_BYTES)));

const subjectDigestOf = async (subject: string): Promise<string> =>
  bytesToBase64Url(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(`${SCOPE_DOMAIN}\u0000${subject}`),
      ),
    ),
  );

const sameValue = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
};

export const decideStepUpScope = async (
  request: Request,
): Promise<StepUpScopeDecision> => {
  const signedIn = SESSION_COOKIES.some(
    (name) => cookieValue(request, name) !== null,
  );
  if (!signedIn) return { kind: 'clear' };
  const accessToken = cookieValue(request, 'wj_access');
  const subject = accessToken === null ? null : subjectOf(accessToken);
  if (subject === null) return { kind: 'keep' };
  const digest = await subjectDigestOf(subject);
  const heldDigest = cookieValue(request, STEP_UP_SUBJECT_COOKIE);
  const heldNonce = cookieValue(request, STEP_UP_SCOPE_COOKIE);
  const sameSubject =
    heldDigest !== null &&
    DIGEST_PATTERN.test(heldDigest) &&
    sameValue(heldDigest, digest);
  if (sameSubject && heldNonce !== null && NONCE_PATTERN.test(heldNonce))
    return { kind: 'keep' };
  return { kind: 'issue', nonce: freshNonce(), subjectDigest: digest };
};

const isDocument = (response: Response): boolean =>
  response.headers.get('content-type')?.toLowerCase().includes('text/html') ===
  true;

const attributes = (secure: boolean, httpOnly: boolean): string =>
  `Path=/${httpOnly ? '; HttpOnly' : ''}; SameSite=Lax${secure ? '; Secure' : ''}`;

/**
 * Adds the scope cookies to a signed-in HTML page response, or expires both on a
 * page that no longer carries a session. Other responses pass through.
 */
export const withStepUpScope = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  if (
    (request.method !== 'GET' && request.method !== 'HEAD') ||
    !isDocument(response)
  )
    return response;
  const decision = await decideStepUpScope(request);
  const secure = new URL(request.url).protocol === 'https:';
  const setCookies: string[] = [];
  if (decision.kind === 'issue') {
    setCookies.push(
      `${STEP_UP_SCOPE_COOKIE}=${decision.nonce}; ${attributes(secure, false)}`,
    );
    setCookies.push(
      `${STEP_UP_SUBJECT_COOKIE}=${decision.subjectDigest}; ${attributes(secure, true)}`,
    );
  } else if (
    decision.kind === 'clear' &&
    (cookieValue(request, STEP_UP_SCOPE_COOKIE) !== null ||
      cookieValue(request, STEP_UP_SUBJECT_COOKIE) !== null)
  ) {
    setCookies.push(
      `${STEP_UP_SCOPE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`,
      `${STEP_UP_SUBJECT_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
    );
  }
  if (setCookies.length === 0) return response;
  const headers = new Headers(response.headers);
  for (const cookie of setCookies) headers.append('set-cookie', cookie);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
