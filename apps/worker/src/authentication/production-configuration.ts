import { createCorrelationId, createRequestId } from '@wejammin/contracts';

import type { WorkerBindings } from '../worker-bindings';
import { authError } from './boundary';
import type { AuthenticationError } from './types';

export const MAX_RESPONSE_BYTES = 128 * 1024;
export const authEncoder = new TextEncoder();
export const authDecoder = new TextDecoder();

export type AuthProductionOptions = Readonly<{
  environment: WorkerBindings;
  fetchImpl?: typeof fetch;
  now?: () => number;
  randomBytes?: (length: number) => Uint8Array;
  /** Registered authenticator-app issuer label; defaults per environment. */
  mfaIssuer?: string;
}>;

export type AuthProductionConfiguration = Readonly<{
  baseUrl: string;
  secret: string;
  fetchImpl: typeof fetch;
  now: () => number;
  randomBytes: (length: number) => Uint8Array;
}>;

export type AuthFlowCookie = Readonly<{
  state: string;
  nonce: string;
  verifier: string;
  provider: string;
  intent: string;
  expiresAt: string;
  authUserId?: string;
  sessionId?: string;
  mergeId?: string;
}>;

export type VerifiedAuthToken = Readonly<{
  accessToken: string;
  refreshToken: string;
  authUserId: string;
  sessionId: string;
  expiresAt: string;
  stepUpAt: string | null;
  primaryAuthAt: string | null;
  aal: 'aal1' | 'aal2' | null;
  providerSubjectDigest: string | null;
}>;

const randomBytesDefault = (length: number): Uint8Array =>
  crypto.getRandomValues(new Uint8Array(length));

export const normalizeAuthProductionOptions = (
  options: AuthProductionOptions,
): AuthProductionConfiguration => {
  const { SUPABASE_SECRET_KEY: secret, SUPABASE_URL: url } =
    options.environment;
  const parsed = new URL(url);
  if (
    secret.length < 16 ||
    secret.length > 512 ||
    [...secret].some((character) => {
      const codePoint = character.charCodeAt(0);
      return codePoint <= 31 || codePoint === 127;
    }) ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    (parsed.protocol !== 'https:' &&
      !(
        parsed.protocol === 'http:' &&
        /^(?:127\.0\.0\.1|localhost)$/u.test(parsed.hostname)
      ))
  ) {
    throw new Error('Authentication production configuration is invalid.');
  }
  return {
    baseUrl: url.replace(/\/+$/u, ''),
    secret,
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
    now: options.now ?? Date.now,
    randomBytes: options.randomBytes ?? randomBytesDefault,
  };
};

export const base64UrlEncode = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');

export const base64UrlDecode = (value: string): Uint8Array => {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
};

export const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    authEncoder.encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const bytea = (hex: string): string => `\\x${hex}`;

export const asRecord = (
  value: unknown,
): Readonly<Record<string, unknown>> | null =>
  typeof value === 'object' && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : null;

export const traceFor = (request: Request) => {
  const requestId = createRequestId(
    request.headers.get('x-request-id') ?? undefined,
  );
  const correlationId = createCorrelationId(
    request.headers.get('x-correlation-id') ?? requestId,
    requestId,
  );
  return { requestId, correlationId } as const;
};

export const expectedVersionValue = (ifMatch: string): string =>
  ifMatch.slice(1, -1);

export const hashRequest = async (value: unknown): Promise<string> =>
  bytea(await sha256Hex(JSON.stringify(value)));

export const invalidPersistenceResponse = (): AuthenticationError =>
  authError(
    502,
    'DEPENDENCY_INVALID_RESPONSE',
    'Authentication persistence returned an invalid response.',
  );
