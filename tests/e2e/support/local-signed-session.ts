import { webcrypto } from 'node:crypto';

import type { BrowserContext } from '@playwright/test';

const USER_ID = '10000000-0000-4000-8000-000000000001';
export const LOCAL_SESSION_ID = '80000000-0000-4000-8000-000000000008';
const SUPABASE_ORIGIN = 'http://127.0.0.1:8790';
const AUTH_SECRET = 'sb_secret_local_only';
const SESSION_SIGNING_SECRET = 's09-real-route-session-secret';

const base64Url = (value: Uint8Array | string): string =>
  Buffer.from(value).toString('base64url');

type SessionOptions = Readonly<{
  sessionId?: string;
  expiresAt?: number;
  forged?: boolean;
  /** The subject; the legacy fixture user when omitted. */
  userId?: string;
  /** Extra signed claims (the S10 real stack carries the acting party here). */
  claims?: Readonly<Record<string, unknown>>;
}>;

const accessToken = async ({
  sessionId = LOCAL_SESSION_ID,
  expiresAt = Math.floor(Date.now() / 1_000) + 3_600,
  forged = false,
  userId = USER_ID,
  claims = {},
}: SessionOptions = {}): Promise<string> => {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      ...claims,
      aud: 'authenticated',
      exp: expiresAt,
      iss: `${SUPABASE_ORIGIN}/auth/v1`,
      session_id: sessionId,
      sub: userId,
    }),
  );
  const signature = forged
    ? 'forged-signature'
    : base64Url(
        new Uint8Array(
          await webcrypto.subtle.sign(
            'HMAC',
            await webcrypto.subtle.importKey(
              'raw',
              new TextEncoder().encode(SESSION_SIGNING_SECRET),
              { name: 'HMAC', hash: 'SHA-256' },
              false,
              ['sign'],
            ),
            new TextEncoder().encode(`${header}.${payload}`),
          ),
        ),
      );
  return `${header}.${payload}.${signature}`;
};

const sessionReference = async (
  sessionId = LOCAL_SESSION_ID,
  userId = USER_ID,
): Promise<string> => {
  const keyMaterial = await webcrypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`wejammin-auth-flow-v1\u0000${AUTH_SECRET}`),
  );
  const key = await webcrypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const flow = JSON.stringify({
    state: sessionId,
    nonce: userId,
    verifier: '',
    provider: 'session',
    intent: 'session',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000).toISOString(),
  });
  const ciphertext = await webcrypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(flow),
  );
  return `${base64Url(iv)}.${base64Url(new Uint8Array(ciphertext))}`;
};

/** Only the loopback real-route harness accepts these test-owned credentials. */
export const authenticateLocalSession = async (
  context: BrowserContext,
  options: SessionOptions & Readonly<{ csrfToken?: string }> = {},
): Promise<void> => {
  const sessionId = options.sessionId ?? LOCAL_SESSION_ID;
  await context.addCookies([
    {
      name: 'wj_access',
      value: await accessToken(options),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
    {
      name: 'wj_session_ref',
      value: await sessionReference(sessionId, options.userId),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
    ...(options.csrfToken === undefined
      ? []
      : [
          {
            name: 'wj_csrf',
            value: options.csrfToken,
            domain: '127.0.0.1',
            path: '/',
            httpOnly: false,
            secure: false,
            sameSite: 'Lax' as const,
          },
        ]),
  ]);
};
