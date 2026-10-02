import { SESSION_SIGNING_SECRET } from './s09-session-authority';

/**
 * Signed local-only session cookies for the stateful lane. Runs in Node (the
 * Playwright side) and in workerd (the rotation port), so it uses only the
 * global Web Crypto API. The loopback harness is the only verifier.
 */

const SUPABASE_ORIGIN = 'http://127.0.0.1:8790';
const AUTH_SECRET = 'sb_secret_local_only';
const encoder = new TextEncoder();

const base64Url = (value: Uint8Array | string): string => {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
};

export const accessToken = async (input: {
  readonly userId: string;
  readonly sessionId: string;
  readonly expiresAt?: number;
}): Promise<string> => {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      aud: 'authenticated',
      exp: input.expiresAt ?? Math.floor(Date.now() / 1_000) + 3_600,
      iss: `${SUPABASE_ORIGIN}/auth/v1`,
      session_id: input.sessionId,
      sub: input.userId,
    }),
  );
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SESSION_SIGNING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${payload}`)),
  );
  return `${header}.${payload}.${base64Url(signature)}`;
};

export const sessionReference = async (input: {
  readonly userId: string;
  readonly sessionId: string;
}): Promise<string> => {
  const material = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(`wejammin-auth-flow-v1\u0000${AUTH_SECRET}`),
  );
  const key = await crypto.subtle.importKey('raw', material, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const flow = JSON.stringify({
    state: input.sessionId,
    nonce: input.userId,
    verifier: '',
    provider: 'session',
    intent: 'session',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000).toISOString(),
  });
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(flow)),
  );
  return `${base64Url(iv)}.${base64Url(ciphertext)}`;
};

const hex = (bytes: ArrayBuffer): string =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

/**
 * Double-submit CSRF token bound to the session reference cookie exactly as the
 * Worker verifies it (`<random>.<sha256(sessionRef NUL random)>`).
 */
export const csrfToken = async (sessionRef: string, random: string): Promise<string> =>
  `${random}.${hex(await crypto.subtle.digest('SHA-256', encoder.encode(`${sessionRef}\u0000${random}`)))}`;

export type LaneCookieSet = Readonly<{
  access: string;
  sessionRef: string;
  csrf: string;
}>;

export const laneCookieSet = async (input: {
  readonly userId: string;
  readonly sessionId: string;
  readonly csrfRandom: string;
  readonly expiresAt?: number;
}): Promise<LaneCookieSet> => {
  const sessionRef = await sessionReference(input);
  return {
    access: await accessToken(input),
    sessionRef,
    csrf: await csrfToken(sessionRef, input.csrfRandom),
  };
};

/** `Set-Cookie` header values the Worker returns when a step-up rotates the session. */
export const rotationCookies = async (input: {
  readonly userId: string;
  readonly sessionId: string;
  readonly csrfRandom: string;
}): Promise<readonly string[]> => {
  const set = await laneCookieSet(input);
  return [
    `wj_access=${set.access}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`,
    `wj_session_ref=${set.sessionRef}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
    `wj_csrf=${set.csrf}; Path=/; SameSite=Lax; Max-Age=2592000`,
  ];
};
