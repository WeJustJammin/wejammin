import {
  MfaFactorsResourceSchema,
  StepUpChallengeSchema,
  StepUpResultSchema,
  TotpEnrollmentStartSchema,
  type MfaFactorsResource,
  type StepUpChallenge,
  type StepUpResult,
  type TotpEnrollmentStart,
} from '@wejammin/contracts';
import { z } from 'zod';

import {
  networkFailure,
  parseMfaFailure,
  type MfaFailure,
} from './mfa-failure';

export type MfaApiDeps = Readonly<{
  fetch?: typeof fetch;
  csrfToken?: () => string | null;
  idempotencyKey?: () => string;
}>;

export type ApiOutcome<T> =
  | Readonly<{ ok: true; data: T; version: string | null }>
  | Readonly<{ ok: false; failure: MfaFailure }>;

export type RemovalReason = 'factor_compromise' | 'user_request';

const FACTORS_PATH = '/api/v1/account/mfa/factors';
const CHALLENGES_PATH = '/api/v1/auth/step-up/challenges';

const readCsrfCookie = (): string | null => {
  if (typeof document === 'undefined') return null;
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('wj_csrf='));
  const value = entry?.slice('wj_csrf='.length);
  return value === undefined || value === '' ? null : value;
};

const newIdempotencyKey = (): string => `mfa-${crypto.randomUUID()}`;

/** The strong `If-Match` form of a decimal version or an ETag. */
const ifMatch = (version: string): string =>
  version.startsWith('"') ? version : `"${version}"`;

const versionFromEtag = (etag: string | null): string | null => {
  const match = etag === null ? null : /^(?:W\/)?"([1-9][0-9]{0,18})"$/u.exec(etag);
  return match?.[1] ?? null;
};

const invalid = (code: string, status: number): ApiOutcome<never> => ({
  ok: false,
  failure: { ...networkFailure(), status, code },
});

type CallInput = Readonly<{
  method: 'DELETE' | 'GET' | 'POST';
  path: string;
  body?: unknown;
  ifMatchVersion?: string;
  idempotencyKey?: string;
}>;

const call = async <T>(
  input: CallInput,
  schema: z.ZodType<T>,
  deps: MfaApiDeps,
): Promise<ApiOutcome<T>> => {
  const headers = new Headers({ accept: 'application/json' });
  if (input.body !== undefined) headers.set('content-type', 'application/json');
  if (input.ifMatchVersion !== undefined)
    headers.set('if-match', ifMatch(input.ifMatchVersion));
  if (input.idempotencyKey !== undefined)
    headers.set('idempotency-key', input.idempotencyKey);
  if (input.method !== 'GET') {
    const token = (deps.csrfToken ?? readCsrfCookie)();
    if (token !== null) headers.set('x-csrf-token', token);
  }
  let response: Response;
  try {
    response = await (deps.fetch ?? fetch)(input.path, {
      method: input.method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
      ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
    });
  } catch {
    return { ok: false, failure: networkFailure() };
  }
  if (!response.ok)
    return { ok: false, failure: await parseMfaFailure(response) };
  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) return invalid('INVALID_RESPONSE', 502);
  const data = parsed.data;
  const resourceVersion =
    typeof data === 'object' && data !== null && 'version' in data
      ? String((data as { version: unknown }).version)
      : null;
  return {
    ok: true,
    data,
    version: resourceVersion ?? versionFromEtag(response.headers.get('etag')),
  };
};

const uuid = z.uuid();

export const readMfaFactors = (
  deps: MfaApiDeps = {},
): Promise<ApiOutcome<MfaFactorsResource>> =>
  call({ method: 'GET', path: FACTORS_PATH }, MfaFactorsResourceSchema, deps);

export const startTotpEnrollment = (
  input: Readonly<{ friendlyName: string; version: string }>,
  deps: MfaApiDeps = {},
): Promise<ApiOutcome<TotpEnrollmentStart>> =>
  call(
    {
      method: 'POST',
      path: FACTORS_PATH,
      body: { method: 'totp', friendlyName: input.friendlyName },
      ifMatchVersion: input.version,
    },
    TotpEnrollmentStartSchema,
    deps,
  );

export const verifyEnrollment = async (
  input: Readonly<{ factorId: string; code: string; version: string }>,
  deps: MfaApiDeps = {},
): Promise<ApiOutcome<MfaFactorsResource>> =>
  uuid.safeParse(input.factorId).success
    ? call(
        {
          method: 'POST',
          path: `${FACTORS_PATH}/${input.factorId}/verify`,
          body: { code: input.code },
          ifMatchVersion: input.version,
        },
        MfaFactorsResourceSchema,
        deps,
      )
    : invalid('INVALID_REQUEST', 400);

export const removeFactor = async (
  input: Readonly<{
    factorId: string;
    reason: RemovalReason;
    version: string;
    idempotencyKey?: string;
  }>,
  deps: MfaApiDeps = {},
): Promise<ApiOutcome<MfaFactorsResource>> =>
  uuid.safeParse(input.factorId).success
    ? call(
        {
          method: 'DELETE',
          path: `${FACTORS_PATH}/${input.factorId}`,
          body: { reason: input.reason },
          ifMatchVersion: input.version,
          idempotencyKey:
            input.idempotencyKey ??
            (deps.idempotencyKey ?? newIdempotencyKey)(),
        },
        MfaFactorsResourceSchema,
        deps,
      )
    : invalid('INVALID_REQUEST', 400);

export const createStepUpChallenge = (
  input: Readonly<{ factorId?: string }>,
  deps: MfaApiDeps = {},
): Promise<ApiOutcome<StepUpChallenge>> =>
  call(
    {
      method: 'POST',
      path: CHALLENGES_PATH,
      body:
        input.factorId === undefined
          ? { method: 'totp' }
          : { method: 'totp', factorId: input.factorId },
    },
    StepUpChallengeSchema,
    deps,
  );

export const verifyStepUp = async (
  input: Readonly<{ challengeId: string; code: string }>,
  deps: MfaApiDeps = {},
): Promise<ApiOutcome<StepUpResult>> =>
  uuid.safeParse(input.challengeId).success
    ? call(
        {
          method: 'POST',
          path: `${CHALLENGES_PATH}/${input.challengeId}/verify`,
          body: { code: input.code },
        },
        StepUpResultSchema,
        deps,
      )
    : invalid('INVALID_REQUEST', 400);
