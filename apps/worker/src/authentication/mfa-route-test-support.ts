import { vi } from 'vitest';

import type {
  MfaFactorsResource,
  StepUpChallenge,
  StepUpResult,
  TotpEnrollmentStart,
} from '@wejammin/contracts';

import {
  CSRF,
  bindings,
  ORIGIN,
  REQUEST_ID,
} from './phase-02-slice-02.test-fixtures';
import { createApp, success } from './phase-02-slice-02.test-support';
import type { AuthenticationDependencies } from './types';
import {
  CHALLENGE_ID,
  FACTOR_ID,
  MANUAL_KEY,
  OTHER_FACTOR_ID,
  OTPAUTH_URI,
  ROTATED_COOKIES,
  factorsResource,
  iso,
  verifiedRow,
} from './mfa-test-support';

export { bindings, CSRF };

export const factorsBody: MfaFactorsResource = factorsResource(
  [verifiedRow()],
  '3',
  iso(-60),
);

export const enrollmentBody: TotpEnrollmentStart = {
  factorId: OTHER_FACTOR_ID,
  method: 'totp',
  friendlyName: 'Phone authenticator',
  otpauthUri: OTPAUTH_URI,
  manualEntryKey: MANUAL_KEY,
  expiresAt: '2026-10-02T14:10:00.000Z',
  version: '5',
};

export const challengeBody: StepUpChallenge = {
  challengeId: CHALLENGE_ID,
  method: 'totp',
  factorId: FACTOR_ID,
  friendlyName: 'Phone authenticator',
  expiresAt: '2026-10-02T14:05:00.000Z',
};

export const stepUpResultBody: StepUpResult = {
  verified: true,
  method: 'totp',
  stepUpAt: '2026-10-02T14:00:00.000Z',
  freshUntil: '2026-10-02T14:10:00.000Z',
};

export const createMfaMocks = () => ({
  readMfaFactors: vi.fn(async () => success(factorsBody)),
  startTotpEnrollment: vi.fn(async () => success(enrollmentBody)),
  verifyTotpEnrollment: vi.fn(async () =>
    success({ resource: factorsBody, cookies: [...ROTATED_COOKIES] }),
  ),
  removeMfaFactor: vi.fn(async () => success(factorsBody)),
  createStepUpChallenge: vi.fn(async () => success(challengeBody)),
  verifyStepUpChallenge: vi.fn(async () =>
    success({ resource: stepUpResultBody, cookies: [...ROTATED_COOKIES] }),
  ),
});

export type MfaMocks = ReturnType<typeof createMfaMocks>;

/** `absent` names MFA dependencies to remove, as a partial composition would. */
export const createMfaApp = (
  overrides: Partial<AuthenticationDependencies> = {},
  absent: readonly (keyof MfaMocks)[] = [],
) => {
  const mocks = createMfaMocks();
  const harness = createApp({ ...mocks, ...overrides });
  for (const name of absent) Object.assign(harness.auth, { [name]: undefined });
  return { ...harness, mocks };
};

type RequestOptions = Readonly<{
  body?: unknown;
  rawBody?: string;
  headers?: Readonly<Record<string, string | null>>;
}>;

/** Browser-shaped request: origin, CSRF pair and JSON body by default. */
export const mfaRequest = (
  method: 'DELETE' | 'GET' | 'POST',
  path: string,
  options: RequestOptions = {},
): Request => {
  const headers = new Headers({
    accept: 'application/json',
    origin: ORIGIN,
    cookie: `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`,
    'x-csrf-token': CSRF,
    'x-request-id': REQUEST_ID,
  });
  if (method !== 'GET') headers.set('content-type', 'application/json');
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    if (value === null) headers.delete(name);
    else headers.set(name, value);
  }
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    ...(method === 'GET'
      ? {}
      : { body: options.rawBody ?? JSON.stringify(options.body ?? {}) }),
  });
};
