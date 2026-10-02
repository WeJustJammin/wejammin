import {
  authDecoder,
  MAX_RESPONSE_BYTES,
  type AuthProductionConfiguration,
} from './production-configuration';
import { ACCESS_COOKIE, readCookie } from './production-cookie';
import {
  classifyProviderFailure,
  invalidProviderResponse,
  timeoutError,
  unavailableError,
} from './production-mfa-provider-errors';
import {
  markMfaCircuitOpen,
  mfaProviderBreakerFor,
} from './mfa-provider-breaker';
import type { MfaProviderPort } from './mfa-types';
import { reauthenticateError } from './step-up';
import type { AuthenticationError, AuthenticationResult } from './types';

export type MfaProviderOptions = Readonly<{
  /** Registered issuer label shown in the authenticator app. */
  issuer: string;
  sleep?: (ms: number) => Promise<void>;
  /** Per-call deadline; BE01a fixes it at 5 seconds. */
  timeoutMs?: number;
}>;

const PRE_EFFECT_RETRY_DELAYS_MS = [250, 750] as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const recordOf = (value: unknown): Readonly<Record<string, unknown>> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;

const uuidOf = (value: unknown): string | null =>
  typeof value === 'string' && UUID_PATTERN.test(value) ? value : null;

type EnrollPayload = Readonly<{ id: string; secret: string; uri: string }>;

const readEnrollPayload = (value: unknown): EnrollPayload | null => {
  const record = recordOf(value);
  const totp = recordOf(record?.totp);
  const id = uuidOf(record?.id);
  const secret = totp?.secret;
  const uri = totp?.uri;
  return id !== null &&
    typeof secret === 'string' &&
    secret.length <= 256 &&
    typeof uri === 'string' &&
    uri.length <= 2048 &&
    uri.startsWith('otpauth://totp/')
    ? { id, secret, uri }
    : null;
};

const readChallengePayload = (
  value: unknown,
): Readonly<{ id: string; expiresAt: number }> | null => {
  const record = recordOf(value);
  const id = uuidOf(record?.id);
  const expires = record?.expires_at;
  return id !== null &&
    typeof expires === 'number' &&
    Number.isSafeInteger(expires) &&
    expires > 0
    ? { id, expiresAt: expires }
    : null;
};

const BASE32_SECRET = /^[A-Z2-7]{26,128}$/u;

type Call = Readonly<{
  request: Request;
  method: 'DELETE' | 'POST';
  path: string;
  body?: Readonly<Record<string, unknown>>;
  retryable: boolean;
  signal: AbortSignal;
}>;

type Reply = Readonly<{ status: number; body: unknown; headers: Headers }>;

const parseBounded = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES)
    return undefined;
  try {
    return JSON.parse(authDecoder.decode(new TextEncoder().encode(text)));
  } catch {
    return undefined;
  }
};

export const createSupabaseMfaProvider = (
  config: AuthProductionConfiguration,
  options: MfaProviderOptions,
): MfaProviderPort => {
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const timeoutMs = options.timeoutMs ?? 5_000;
  const breaker = mfaProviderBreakerFor(config.fetchImpl);
  const recordFailure = (): void => breaker.recordFailure(config.now());

  const attempt = async (
    call: Call,
    token: string,
  ): Promise<AuthenticationResult<Reply>> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const relay = (): void => controller.abort();
    if (call.signal.aborted) controller.abort();
    else call.signal.addEventListener('abort', relay, { once: true });
    try {
      const response = await config.fetchImpl(
        `${config.baseUrl}/auth/v1${call.path}`,
        {
          method: call.method,
          signal: controller.signal,
          headers: {
            accept: 'application/json',
            apikey: config.secret,
            authorization: `Bearer ${token}`,
            ...(call.body === undefined
              ? {}
              : { 'content-type': 'application/json' }),
          },
          ...(call.body === undefined
            ? {}
            : { body: JSON.stringify(call.body) }),
        },
      );
      return {
        ok: true,
        value: {
          status: response.status,
          headers: response.headers,
          body: await parseBounded(response),
        },
      };
    } catch (error) {
      recordFailure();
      return error instanceof DOMException && error.name === 'AbortError'
        ? timeoutError()
        : unavailableError();
    } finally {
      clearTimeout(timer);
      call.signal.removeEventListener('abort', relay);
    }
  };

  const send = async (call: Call): Promise<AuthenticationResult<Reply>> => {
    const token = readCookie(call.request, ACCESS_COOKIE);
    if (token === null) return reauthenticateError();
    const delays = call.retryable ? PRE_EFFECT_RETRY_DELAYS_MS : [];
    for (let index = 0; ; index += 1) {
      if (breaker.isOpen(config.now()))
        return markMfaCircuitOpen(unavailableError());
      const result = await attempt(call, token);
      if (!result.ok) return result;
      const { status } = result.value;
      if (status >= 500) recordFailure();
      const pending = delays[index];
      if ((status === 502 || status === 503) && pending !== undefined) {
        await sleep(pending);
        continue;
      }
      return result;
    }
  };

  const expect2xx = (
    reply: Reply,
    nowMs: number,
  ): AuthenticationError | unknown => {
    if (reply.status >= 200 && reply.status < 300)
      return reply.body === undefined ? invalidProviderResponse() : reply.body;
    return classifyProviderFailure(
      reply.status,
      typeof reply.body === 'object' && reply.body !== null
        ? (reply.body as Readonly<Record<string, unknown>>)
        : null,
      reply.headers,
      nowMs,
    );
  };

  const isFailure = (value: unknown): value is AuthenticationError =>
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    (value as { ok: unknown }).ok === false;

  const call = async (spec: Call): Promise<AuthenticationResult<unknown>> => {
    const result = await send(spec);
    if (!result.ok) return result;
    const payload = expect2xx(result.value, config.now());
    return isFailure(payload) ? payload : { ok: true, value: payload };
  };

  return {
    enroll: async (input, signal) => {
      const result = await call({
        request: input.request,
        method: 'POST',
        path: '/factors',
        body: {
          factor_type: 'totp',
          friendly_name: input.friendlyName,
          issuer: options.issuer,
        },
        retryable: true,
        signal,
      });
      if (!result.ok) return result;
      const payload = readEnrollPayload(result.value);
      const secret = payload?.secret.toUpperCase().replace(/=+$/u, '') ?? '';
      return payload !== null && BASE32_SECRET.test(secret)
        ? {
            ok: true,
            value: {
              providerFactorId: payload.id,
              otpauthUri: payload.uri,
              manualEntryKey: secret,
            },
          }
        : invalidProviderResponse();
    },

    unenroll: async (input, signal) => {
      const result = await send({
        request: input.request,
        method: 'DELETE',
        path: `/factors/${input.providerFactorId}`,
        retryable: false,
        signal,
      });
      if (!result.ok) return result;
      if (result.value.status === 404) return { ok: true, value: null };
      const payload = expect2xx(result.value, config.now());
      return isFailure(payload) ? payload : { ok: true, value: null };
    },

    challenge: async (input, signal) => {
      const result = await call({
        request: input.request,
        method: 'POST',
        path: `/factors/${input.providerFactorId}/challenge`,
        body: {},
        retryable: true,
        signal,
      });
      if (!result.ok) return result;
      const payload = readChallengePayload(result.value);
      return payload !== null
        ? {
            ok: true,
            value: {
              providerChallengeId: payload.id,
              expiresAt: new Date(payload.expiresAt * 1000).toISOString(),
            },
          }
        : invalidProviderResponse();
    },

    verify: (input, signal) =>
      call({
        request: input.request,
        method: 'POST',
        path: `/factors/${input.providerFactorId}/verify`,
        body: { challenge_id: input.providerChallengeId, code: input.code },
        retryable: false,
        signal,
      }),
  };
};
