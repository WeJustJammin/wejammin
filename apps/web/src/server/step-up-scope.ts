import { STEP_UP_SCOPE_COOKIE } from '../components/identity-authority/step-up-mfa/step-up-binding';

/**
 * The step-up scope cookie (review r14 finding 2). Tab-held step-up drafts and
 * pending-command envelopes are bound to the signed-in subject so a later user
 * in the same tab can never restore the previous person's interrupted command.
 *
 * The browser cannot read its HttpOnly session cookies, and the FE03 island
 * invariant keeps actor, party and binding identifiers (raw, hashed or
 * truncated) out of island props, URLs and logs. The edge therefore derives
 * the scope from the access token it already receives and hands it to the tab
 * as one opaque, script-readable cookie, the same way the session-bound CSRF
 * cookie reaches it. The scope follows the subject, not the session id,
 * because the step-up proof rotates the session id mid-detour.
 *
 * The token is decoded, not verified: the scope is a hygiene key for storage the
 * same browser already owns, never an authorization input, and every protected
 * request is still verified by the Worker.
 */

export { STEP_UP_SCOPE_COOKIE };

const SCOPE_DOMAIN = 'wj-step-up-scope-v1';
const SCOPE_LENGTH = 32;
const SESSION_COOKIES = ['wj_access', 'wj_refresh', 'wj_session_ref'] as const;

export type StepUpScopeDecision =
  | Readonly<{ kind: 'set'; value: string }>
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
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${SCOPE_DOMAIN}\u0000${subject}`),
  );
  return {
    kind: 'set',
    value: bytesToBase64Url(new Uint8Array(digest)).slice(0, SCOPE_LENGTH),
  };
};

const isDocument = (response: Response): boolean =>
  response.headers.get('content-type')?.toLowerCase().includes('text/html') ===
  true;

/**
 * Adds the scope cookie to a signed-in HTML page response, or expires it on a
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
  const held = cookieValue(request, STEP_UP_SCOPE_COOKIE);
  let setCookie: string | null = null;
  if (decision.kind === 'set' && decision.value !== held) {
    const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
    setCookie = `${STEP_UP_SCOPE_COOKIE}=${decision.value}; Path=/; SameSite=Lax${secure}`;
  } else if (decision.kind === 'clear' && held !== null) {
    setCookie = `${STEP_UP_SCOPE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
  if (setCookie === null) return response;
  const headers = new Headers(response.headers);
  headers.append('set-cookie', setCookie);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
