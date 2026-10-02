import { vi } from 'vitest';

import type { MfaFactorsResource } from '@wejammin/contracts';

import { createMfaService } from './mfa-service';

import type {
  MfaFactorRow,
  MfaPersistencePort,
  MfaProviderPort,
  MfaRegistrySnapshot,
  SessionRotationPort,
} from './mfa-types';
import type {
  AuthenticationResult,
  AuthenticationSession,
} from './result-types';

export const NOW = Date.parse('2026-10-02T14:00:00Z');
export const ORIGIN = 'https://api.example.test';
export const AUTH_USER_ID = '22222222-2222-4222-8222-222222222222';
export const SESSION_ID = '33333333-3333-4333-8333-333333333333';
export const NEW_SESSION_ID = '34343434-3434-4434-8434-343434343434';
export const PERSON_ID = '44444444-4444-4444-8444-444444444444';
export const FACTOR_ID = '55555555-5555-4555-8555-555555555555';
export const OTHER_FACTOR_ID = '56565656-5656-4656-8656-565656565656';
export const PROVIDER_FACTOR_ID = '66666666-6666-4666-8666-666666666666';
export const CHALLENGE_ID = '77777777-7777-4777-8777-777777777777';
export const PROVIDER_CHALLENGE_ID = '88888888-8888-4888-8888-888888888888';
export const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
export const ACCESS_TOKEN = 'caller-access-token-secret';
export const REFRESH_TOKEN = 'caller-refresh-token-secret';
export const OTPAUTH_URI =
  'otpauth://totp/WeJammin:rob?secret=JBSWY3DPEHPK3PXPJBSWY3DPEH&issuer=WeJammin';
export const MANUAL_KEY = 'JBSWY3DPEHPK3PXPJBSWY3DPEH';
export const CSRF =
  'dec111-csrf-random.1ee2dc5deb3a71512e7fbd07c44baabae2fcdf0b8e73262a0c4bf9e5aaef77f1';

export const iso = (offsetSeconds: number): string =>
  new Date(NOW + offsetSeconds * 1000).toISOString();

export const sessionFor = (
  overrides: Partial<AuthenticationSession> = {},
): AuthenticationSession => ({
  authUserId: AUTH_USER_ID,
  sessionId: SESSION_ID,
  accountState: 'active',
  personId: PERSON_ID,
  actingPartyId: PERSON_ID,
  expiresAt: iso(3600),
  stepUpAt: iso(-60),
  primaryAuthAt: iso(-120),
  ...overrides,
});

export const verifiedRow = (
  overrides: Partial<MfaFactorRow> = {},
): MfaFactorRow => ({
  id: FACTOR_ID,
  method: 'totp',
  friendlyName: 'Phone authenticator',
  state: 'verified',
  verifiedAt: iso(-86_400),
  lastUsedAt: iso(-3_600),
  pendingExpiresAt: null,
  ...overrides,
});

export const pendingRow = (
  overrides: Partial<MfaFactorRow> = {},
): MfaFactorRow =>
  verifiedRow({
    id: OTHER_FACTOR_ID,
    friendlyName: 'Spare authenticator',
    state: 'pending',
    verifiedAt: null,
    lastUsedAt: null,
    pendingExpiresAt: iso(480),
    ...overrides,
  });

export const snapshotOf = (
  factors: readonly MfaFactorRow[],
  version = '3',
): MfaRegistrySnapshot => ({ factors, version });

export const ok = <T>(value: T): AuthenticationResult<T> => ({
  ok: true,
  value,
});

export const requestFor = (
  method: 'DELETE' | 'GET' | 'POST' = 'POST',
  headers: Readonly<Record<string, string>> = {},
): Request =>
  new Request(`${ORIGIN}/api/v1/test`, {
    method,
    headers: {
      origin: ORIGIN,
      cookie: `wj_access=${ACCESS_TOKEN}; wj_refresh=${REFRESH_TOKEN}`,
      'x-request-id': REQUEST_ID,
      ...headers,
    },
  });

export const fakePersistence = (
  overrides: Partial<MfaPersistencePort> = {},
): {
  [K in keyof MfaPersistencePort]: ReturnType<typeof vi.fn>;
} & MfaPersistencePort => {
  const port = {
    readFactors: vi.fn(async () => ok(snapshotOf([verifiedRow()]))),
    beginEnrollment: vi.fn(async () =>
      ok({ supersededProviderFactorId: null, version: '4' }),
    ),
    finishEnrollment: vi.fn(async () =>
      ok({ factorId: OTHER_FACTOR_ID, expiresAt: iso(600), version: '5' }),
    ),
    prepareEnrollmentVerify: vi.fn(async () =>
      ok({ providerFactorId: PROVIDER_FACTOR_ID }),
    ),
    settleEnrollmentVerify: vi.fn(async () =>
      ok(snapshotOf([verifiedRow(), pendingRow({ state: 'verified' })], '6')),
    ),
    markFactorReconciling: vi.fn(async () => ok(null)),
    beginRemoval: vi.fn(async () =>
      ok({ providerFactorId: PROVIDER_FACTOR_ID, replay: null }),
    ),
    finishRemoval: vi.fn(async () => ok(snapshotOf([], '7'))),
    beginChallenge: vi.fn(async () =>
      ok({
        factorId: FACTOR_ID,
        providerFactorId: PROVIDER_FACTOR_ID,
        friendlyName: 'Phone authenticator',
      }),
    ),
    finishChallenge: vi.fn(async () =>
      ok({ challengeId: CHALLENGE_ID, expiresAt: iso(300) }),
    ),
    prepareChallengeVerify: vi.fn(async () =>
      ok({
        factorId: FACTOR_ID,
        providerFactorId: PROVIDER_FACTOR_ID,
        providerChallengeId: PROVIDER_CHALLENGE_ID,
        expiresAt: iso(300),
      }),
    ),
    recordChallengeFailure: vi.fn(async () => ok(null)),
    settleChallengeVerify: vi.fn(async () => ok(null)),
    ...overrides,
  };
  return port as never;
};

export const fakeProvider = (
  overrides: Partial<MfaProviderPort> = {},
): {
  [K in keyof MfaProviderPort]: ReturnType<typeof vi.fn>;
} & MfaProviderPort => {
  const port = {
    enroll: vi.fn(async () =>
      ok({
        providerFactorId: PROVIDER_FACTOR_ID,
        otpauthUri: OTPAUTH_URI,
        manualEntryKey: MANUAL_KEY,
      }),
    ),
    unenroll: vi.fn(async () => ok(null)),
    challenge: vi.fn(async () =>
      ok({ providerChallengeId: PROVIDER_CHALLENGE_ID, expiresAt: iso(300) }),
    ),
    verify: vi.fn(async () =>
      ok({ access_token: 'rotated-access', refresh_token: 'rotated-refresh' }),
    ),
    ...overrides,
  };
  return port as never;
};

export const ROTATED_COOKIES = [
  'wj_access=rotated; Path=/; HttpOnly',
  'wj_csrf=rotated-csrf; Path=/',
] as const;

export const fakeRotation = (
  stepUpAt = iso(0),
  commit?: ReturnType<typeof vi.fn>,
) => {
  const committer =
    commit ?? vi.fn(async () => ok({ cookies: [...ROTATED_COOKIES] }));
  const validate = vi.fn(async () =>
    ok({
      stepUpAt,
      freshUntil: new Date(Date.parse(stepUpAt) + 600_000).toISOString(),
      commit: committer,
    }),
  );
  return {
    port: { validate } as SessionRotationPort,
    validate,
    commit: committer,
  };
};

export const factorsResource = (
  factors: readonly MfaFactorRow[],
  version: string,
  stepUpAt: string | null,
): MfaFactorsResource => ({
  factors: [...factors],
  allowedMethods: ['totp'],
  stepUp:
    stepUpAt === null
      ? { fresh: false, freshUntil: null }
      : {
          fresh: true,
          freshUntil: new Date(Date.parse(stepUpAt) + 600_000).toISOString(),
        },
  version,
});

export const env = {} as never;
export const signal = new AbortController().signal;

/** Composes the real service over fake ports and the fixed test clock. */
export const buildService = (
  persistence = fakePersistence(),
  provider = fakeProvider(),
  rotation = fakeRotation(),
) => ({
  persistence,
  provider,
  rotation,
  service: createMfaService({
    persistence,
    provider,
    rotation: rotation.port,
    now: () => NOW,
  }),
});
