import { describe, expect, it } from 'vitest';

import { authError } from './boundary';
import {
  AUTH_USER_ID,
  buildService,
  env,
  fakePersistence,
  fakeProvider,
  iso,
  MANUAL_KEY,
  ok,
  OTHER_FACTOR_ID,
  OTPAUTH_URI,
  PROVIDER_FACTOR_ID,
  requestFor,
  SESSION_ID,
  sessionFor,
  signal,
  snapshotOf,
  verifiedRow,
} from './mfa-test-support';

const build = buildService;

const withoutPrimaryAuth = (
  session: ReturnType<typeof sessionFor>,
): ReturnType<typeof sessionFor> => {
  return { ...session, primaryAuthAt: null };
};

const startInput = (
  overrides: Partial<{
    session: ReturnType<typeof sessionFor>;
    friendlyName: string;
    ifMatch: string;
  }> = {},
) => ({
  session: sessionFor(),
  request: requestFor(),
  friendlyName: 'Phone authenticator',
  ifMatch: '"3"',
  ...overrides,
});

describe('TOTP enrollment start (AUTH-API-17)', () => {
  it('runs transaction A, provider enrollment, then transaction B and returns the one-time secret', async () => {
    const { service, persistence, provider } = build();
    const order: string[] = [];
    persistence.readFactors.mockImplementation(async () => {
      order.push('read');
      return ok(snapshotOf([verifiedRow()]));
    });
    persistence.beginEnrollment.mockImplementation(async () => {
      order.push('begin');
      return ok({ supersededProviderFactorId: null, version: '4' });
    });
    provider.enroll.mockImplementation(async () => {
      order.push('enroll');
      return ok({
        providerFactorId: PROVIDER_FACTOR_ID,
        otpauthUri: OTPAUTH_URI,
        manualEntryKey: MANUAL_KEY,
      });
    });
    persistence.finishEnrollment.mockImplementation(async () => {
      order.push('finish');
      return ok({
        factorId: OTHER_FACTOR_ID,
        expiresAt: iso(600),
        version: '5',
      });
    });
    const result = await service.startTotpEnrollment(startInput(), env, signal);
    expect(order).toEqual(['read', 'begin', 'enroll', 'finish']);
    expect(result).toEqual(
      ok({
        factorId: OTHER_FACTOR_ID,
        method: 'totp',
        friendlyName: 'Phone authenticator',
        otpauthUri: OTPAUTH_URI,
        manualEntryKey: MANUAL_KEY,
        expiresAt: iso(600),
        version: '5',
      }),
    );
    expect(persistence.beginEnrollment).toHaveBeenCalledWith(
      expect.objectContaining({
        authUserId: AUTH_USER_ID,
        friendlyName: 'Phone authenticator',
        expectedVersion: '3',
      }),
      signal,
    );
    expect(persistence.finishEnrollment).toHaveBeenCalledWith(
      expect.objectContaining({
        providerFactorId: PROVIDER_FACTOR_ID,
        friendlyName: 'Phone authenticator',
        expectedVersion: '4',
        sessionId: SESSION_ID,
      }),
      signal,
    );
  });

  it('never hands the secret, URI or code material to persistence', async () => {
    const { service, persistence } = build();
    await service.startTotpEnrollment(startInput(), env, signal);
    const persisted = JSON.stringify(
      Object.values(persistence)
        .flatMap((mock) =>
          'mock' in mock ? (mock.mock.calls as unknown[]) : [],
        )
        .map((call) =>
          (call as unknown[]).map((argument) =>
            argument instanceof AbortSignal
              ? null
              : JSON.parse(
                  JSON.stringify(argument, (key, value) =>
                    key === 'request' ? null : value,
                  ),
                ),
          ),
        ),
    );
    expect(persisted).not.toContain(MANUAL_KEY);
    expect(persisted).not.toContain('otpauth');
  });

  it('removes the superseded unverified provider factor before enrolling', async () => {
    const order: string[] = [];
    const persistence = fakePersistence({
      beginEnrollment: async () =>
        ok({
          supersededProviderFactorId: 'superseded-provider-factor',
          version: '4',
        }),
    });
    const provider = fakeProvider();
    provider.unenroll.mockImplementation(async () => {
      order.push('unenroll');
      return ok(null);
    });
    provider.enroll.mockImplementation(async () => {
      order.push('enroll');
      return ok({
        providerFactorId: PROVIDER_FACTOR_ID,
        otpauthUri: OTPAUTH_URI,
        manualEntryKey: MANUAL_KEY,
      });
    });
    const { service } = build(persistence, provider);
    const result = await service.startTotpEnrollment(startInput(), env, signal);
    expect(result.ok).toBe(true);
    expect(order).toEqual(['unenroll', 'enroll']);
    expect(provider.unenroll).toHaveBeenCalledWith(
      expect.objectContaining({
        providerFactorId: 'superseded-provider-factor',
      }),
      signal,
    );
  });

  it('stops without enrolling when the superseded provider factor cannot be removed', async () => {
    const persistence = fakePersistence({
      beginEnrollment: async () =>
        ok({
          supersededProviderFactorId: 'superseded-provider-factor',
          version: '4',
        }),
    });
    const provider = fakeProvider({
      unenroll: async () => authError(503, 'DEPENDENCY_UNAVAILABLE', 'down'),
    });
    const { service } = build(persistence, provider);
    const result = await service.startTotpEnrollment(startInput(), env, signal);
    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(provider.enroll).not.toHaveBeenCalled();
    expect(persistence.finishEnrollment).not.toHaveBeenCalled();
  });

  it('requires a fresh step-up proof when a verified factor already exists', async () => {
    const { service, persistence, provider } = build();
    const result = await service.startTotpEnrollment(
      startInput({ session: sessionFor({ stepUpAt: iso(-601) }) }),
      env,
      signal,
    );
    expect(result).toEqual(
      authError(401, 'STEP_UP_REQUIRED', 'Recent verification is required.', {
        recoveryAction: 'step_up',
        allowedMethods: ['totp'],
      }),
    );
    expect(persistence.beginEnrollment).not.toHaveBeenCalled();
    expect(provider.enroll).not.toHaveBeenCalled();
  });

  it('lets a fresh step-up proof add a second factor even if primary sign-in is old', async () => {
    const { service } = build();
    const result = await service.startTotpEnrollment(
      startInput({ session: sessionFor({ primaryAuthAt: iso(-86_400) }) }),
      env,
      signal,
    );
    expect(result.ok).toBe(true);
  });

  it.each([
    ['stale', iso(-601)],
    ['absent', null],
    ['undefined', undefined],
  ] as const)(
    'requires recent primary authentication for the first factor (%s primaryAuthAt)',
    async (_name, primaryAuthAt) => {
      const persistence = fakePersistence({
        readFactors: async () => ok(snapshotOf([], '1')),
      });
      const { service, provider } = build(persistence);
      const result = await service.startTotpEnrollment(
        startInput({
          session:
            primaryAuthAt === undefined
              ? withoutPrimaryAuth(sessionFor({ stepUpAt: null }))
              : sessionFor({ primaryAuthAt, stepUpAt: null }),
        }),
        env,
        signal,
      );
      expect(result).toEqual(
        authError(401, 'UNAUTHENTICATED', 'Sign in again to continue.', {
          recoveryAction: 'reauthenticate',
        }),
      );
      expect(persistence.beginEnrollment).not.toHaveBeenCalled();
      expect(provider.enroll).not.toHaveBeenCalled();
    },
  );

  it('allows the first factor with primary authentication exactly 600 s old', async () => {
    const persistence = fakePersistence({
      readFactors: async () => ok(snapshotOf([], '1')),
    });
    const { service } = build(persistence);
    const result = await service.startTotpEnrollment(
      startInput({
        ifMatch: '"1"',
        session: sessionFor({ primaryAuthAt: iso(-600), stepUpAt: null }),
      }),
      env,
      signal,
    );
    expect(result.ok).toBe(true);
  });

  it('does not count a reconciling factor as a verified factor', async () => {
    const persistence = fakePersistence({
      readFactors: async () =>
        ok(snapshotOf([verifiedRow({ state: 'reconciling' })])),
    });
    const { service } = build(persistence);
    const result = await service.startTotpEnrollment(
      startInput({
        session: sessionFor({ primaryAuthAt: iso(-700), stepUpAt: iso(0) }),
      }),
      env,
      signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 401,
      code: 'UNAUTHENTICATED',
    });
  });

  it('passes database refusals through before any provider call', async () => {
    const persistence = fakePersistence({
      beginEnrollment: async () =>
        authError(409, 'CONFLICT', 'limit', {
          conflict: 'INVALID_TRANSITION',
          reasonCode: 'mfa_factor_limit',
          recoveryAction: 'refetch',
        }),
    });
    const { service, provider } = build(persistence);
    const result = await service.startTotpEnrollment(startInput(), env, signal);
    expect(result).toMatchObject({
      ok: false,
      status: 409,
      details: { reasonCode: 'mfa_factor_limit' },
    });
    expect(provider.enroll).not.toHaveBeenCalled();
  });

  it.each([502, 503, 504] as const)(
    'returns provider failure %i without recording a pending row',
    async (status) => {
      const provider = fakeProvider({
        enroll: async () => authError(status, 'DEPENDENCY_UNAVAILABLE', 'x'),
      });
      const { service, persistence } = build(fakePersistence(), provider);
      const result = await service.startTotpEnrollment(
        startInput(),
        env,
        signal,
      );
      expect(result).toMatchObject({ ok: false, status });
      expect(persistence.finishEnrollment).not.toHaveBeenCalled();
    },
  );

  it('removes the new provider factor when the pending row cannot be recorded', async () => {
    const persistence = fakePersistence({
      finishEnrollment: async () =>
        authError(503, 'DEPENDENCY_UNAVAILABLE', 'down'),
    });
    const { service, provider } = build(persistence);
    const result = await service.startTotpEnrollment(startInput(), env, signal);
    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(provider.unenroll).toHaveBeenCalledWith(
      expect.objectContaining({ providerFactorId: PROVIDER_FACTOR_ID }),
      signal,
    );
  });

  it('refuses an ineligible account before any read', async () => {
    const { service, persistence } = build();
    const result = await service.startTotpEnrollment(
      startInput({ session: sessionFor({ accountState: 'suspended' }) }),
      env,
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(persistence.readFactors).not.toHaveBeenCalled();
  });

  it('answers 502 when the provider secret has an invalid shape', async () => {
    const provider = fakeProvider({
      enroll: async () =>
        ok({
          providerFactorId: PROVIDER_FACTOR_ID,
          otpauthUri: 'https://not-otpauth.example',
          manualEntryKey: 'short',
        }),
    });
    const { service } = build(fakePersistence(), provider);
    const result = await service.startTotpEnrollment(startInput(), env, signal);
    expect(result).toMatchObject({ ok: false, status: 502 });
  });
});
