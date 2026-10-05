import { describe, expect, it } from 'vitest';

import { authError } from './boundary';
import {
  AUTH_USER_ID,
  buildService,
  CHALLENGE_ID,
  env,
  FACTOR_ID,
  fakePersistence,
  fakeProvider,
  fakeRotation,
  iso,
  NEW_SESSION_ID,
  ok,
  OTHER_FACTOR_ID,
  pendingRow,
  PROVIDER_FACTOR_ID,
  requestFor,
  ROTATED_COOKIES,
  SESSION_ID,
  sessionFor,
  signal,
  snapshotOf,
  verifiedRow,
} from './mfa-test-support';

const build = buildService;

describe('TOTP enrollment verify (AUTH-API-18)', () => {
  const verifyInput = (
    overrides: Partial<{ code: string; ifMatch: string }> = {},
  ) => ({
    session: sessionFor(),
    request: requestFor(),
    factorId: OTHER_FACTOR_ID,
    code: '123456',
    ifMatch: '"5"',
    ...overrides,
  });

  it('validates, then settles factor and rotation in one transaction and returns a fresh proof', async () => {
    const order: string[] = [];
    const persistence = fakePersistence();
    const provider = fakeProvider();
    const rotation = fakeRotation(iso(0));
    persistence.prepareEnrollmentVerify.mockImplementation(async () => {
      order.push('prepare');
      return ok({ providerFactorId: PROVIDER_FACTOR_ID });
    });
    provider.challenge.mockImplementation(async () => {
      order.push('challenge');
      return ok({ providerChallengeId: CHALLENGE_ID, expiresAt: iso(300) });
    });
    provider.verify.mockImplementation(async () => {
      order.push('verify');
      return ok({ access_token: 'rotated-access', refresh_token: 'r' });
    });
    rotation.validate.mockImplementation(async () => {
      order.push('validate');
      return ok({
        stepUpAt: iso(0),
        freshUntil: iso(600),
        rotation: { sessionId: NEW_SESSION_ID, issuedAt: iso(0) },
        cookies: [...ROTATED_COOKIES],
      });
    });
    persistence.settleEnrollmentVerify.mockImplementation(async () => {
      order.push('settle');
      return ok(
        snapshotOf([verifiedRow(), pendingRow({ state: 'verified' })], '6'),
      );
    });
    const { service } = build(persistence, provider, rotation);
    const result = await service.verifyTotpEnrollment(
      verifyInput(),
      env,
      signal,
    );
    expect(order).toEqual([
      'prepare',
      'challenge',
      'verify',
      'validate',
      'settle',
    ]);
    expect(result).toEqual(
      ok({
        resource: {
          factors: [verifiedRow(), pendingRow({ state: 'verified' })],
          allowedMethods: ['totp'],
          stepUp: { fresh: true, freshUntil: iso(600) },
          version: '6',
        },
        cookies: [...ROTATED_COOKIES],
      }),
    );
    expect(provider.verify).toHaveBeenCalledWith(
      expect.objectContaining({
        providerFactorId: PROVIDER_FACTOR_ID,
        providerChallengeId: CHALLENGE_ID,
        code: '123456',
      }),
      signal,
    );
    expect(persistence.prepareEnrollmentVerify).toHaveBeenCalledWith(
      expect.objectContaining({
        factorId: OTHER_FACTOR_ID,
        expectedVersion: '5',
      }),
      signal,
    );
    expect(persistence.settleEnrollmentVerify).toHaveBeenCalledWith(
      expect.objectContaining({
        factorId: OTHER_FACTOR_ID,
        expectedVersion: '5',
        sessionId: SESSION_ID,
      }),
      signal,
    );
  });

  it.each([
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
  ] as const)(
    'passes a %i refusal from the registry through before any provider call',
    async (status, code) => {
      const persistence = fakePersistence({
        prepareEnrollmentVerify: async () => authError(status, code, 'no'),
      });
      const { service, provider } = build(persistence);
      const result = await service.verifyTotpEnrollment(
        verifyInput(),
        env,
        signal,
      );
      expect(result).toMatchObject({ ok: false, status, code });
      expect(provider.challenge).not.toHaveBeenCalled();
      expect(provider.verify).not.toHaveBeenCalled();
    },
  );

  it('returns a provider challenge failure without any state change', async () => {
    const provider = fakeProvider({
      challenge: async () => authError(503, 'DEPENDENCY_UNAVAILABLE', 'down'),
    });
    const { service, persistence } = build(fakePersistence(), provider);
    const result = await service.verifyTotpEnrollment(
      verifyInput(),
      env,
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(persistence.markFactorReconciling).not.toHaveBeenCalled();
    expect(persistence.settleEnrollmentVerify).not.toHaveBeenCalled();
  });

  it.each([
    ['wrong code (422)', 422],
    ['provider rate refusal (429)', 429],
    ['session rejected (401)', 401],
  ] as const)('keeps the factor pending on %s', async (_name, status) => {
    const provider = fakeProvider({
      verify: async () => authError(status, 'PROVIDER_REFUSAL', 'no'),
    });
    const { service, persistence } = build(fakePersistence(), provider);
    const result = await service.verifyTotpEnrollment(
      verifyInput(),
      env,
      signal,
    );
    expect(result).toMatchObject({ ok: false, status });
    expect(persistence.markFactorReconciling).not.toHaveBeenCalled();
    expect(persistence.settleEnrollmentVerify).not.toHaveBeenCalled();
  });

  it.each([
    ['timeout', 504],
    ['invalid 2xx', 502],
  ] as const)(
    'marks the factor reconciling and sets no cookie on provider %s',
    async (_name, status) => {
      const provider = fakeProvider({
        verify: async () => authError(status, 'PROVIDER_AMBIGUOUS', 'unknown'),
      });
      const { service, persistence } = build(fakePersistence(), provider);
      const result = await service.verifyTotpEnrollment(
        verifyInput(),
        env,
        signal,
      );
      expect(result).toMatchObject({ ok: false, status });
      expect(persistence.markFactorReconciling).toHaveBeenCalledWith(
        expect.objectContaining({ factorId: OTHER_FACTOR_ID }),
        expect.anything(),
      );
    },
  );

  it.each([
    ['wrong code', 422, 'incorrect'],
    ['provider timeout', 504, 'ambiguous'],
    ['provider invalid 2xx', 502, 'ambiguous'],
  ] as const)(
    'charges the shared account verification budget on a %s',
    async (_name, status, outcome) => {
      const provider = fakeProvider({
        verify: async () => authError(status, 'PROVIDER_REFUSAL', 'no'),
      });
      const { service, persistence } = build(fakePersistence(), provider);
      const result = await service.verifyTotpEnrollment(
        verifyInput(),
        env,
        signal,
      );
      expect(result).toMatchObject({ ok: false, status });
      expect(persistence.recordVerificationFailure).toHaveBeenCalledTimes(1);
      expect(persistence.recordVerificationFailure).toHaveBeenCalledWith(
        expect.objectContaining({ authUserId: AUTH_USER_ID, outcome }),
        expect.anything(),
      );
    },
  );

  it.each([
    ['provider rate refusal (429)', 429],
    ['session rejected (401)', 401],
  ] as const)('does not charge the budget on %s', async (_name, status) => {
    const provider = fakeProvider({
      verify: async () => authError(status, 'PROVIDER_REFUSAL', 'no'),
    });
    const { service, persistence } = build(fakePersistence(), provider);
    await service.verifyTotpEnrollment(verifyInput(), env, signal);
    expect(persistence.recordVerificationFailure).not.toHaveBeenCalled();
  });

  it('fails closed with the persistence error when a wrong code cannot be durably counted', async () => {
    const provider = fakeProvider({
      verify: async () => authError(422, 'VALIDATION_FAILED', 'wrong'),
    });
    const persistence = fakePersistence({
      recordVerificationFailure: async () =>
        authError(503, 'DEPENDENCY_UNAVAILABLE', 'down'),
    });
    const { service } = build(persistence, provider);
    const result = await service.verifyTotpEnrollment(
      verifyInput(),
      env,
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 503 });
  });

  it('refuses a locked account at prepare, before any provider call, and charges nothing', async () => {
    const persistence = fakePersistence({
      prepareEnrollmentVerify: async () =>
        authError(429, 'RATE_LIMITED', 'locked', { retryAfterSeconds: 600 }),
    });
    const { service, provider } = build(persistence);
    const result = await service.verifyTotpEnrollment(
      verifyInput(),
      env,
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 429 });
    expect(provider.challenge).not.toHaveBeenCalled();
    expect(provider.verify).not.toHaveBeenCalled();
    expect(persistence.recordVerificationFailure).not.toHaveBeenCalled();
  });

  it('marks the factor reconciling and changes nothing when the returned session is invalid', async () => {
    const rotation = fakeRotation();
    rotation.validate.mockResolvedValue(
      authError(502, 'PROVIDER_INVALID_RESPONSE', 'bad token'),
    );
    const { service, persistence } = build(
      fakePersistence(),
      fakeProvider(),
      rotation,
    );
    const result = await service.verifyTotpEnrollment(
      verifyInput(),
      env,
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 502 });
    expect(persistence.markFactorReconciling).toHaveBeenCalled();
    expect(persistence.settleEnrollmentVerify).not.toHaveBeenCalled();
  });

  it('answers 500 and marks reconciling when local finalization fails, with no cookie', async () => {
    const persistence = fakePersistence({
      settleEnrollmentVerify: async () =>
        authError(503, 'DEPENDENCY_UNAVAILABLE', 'down'),
    });
    const { service } = build(persistence);
    const result = await service.verifyTotpEnrollment(
      verifyInput(),
      env,
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 500 });
    expect(persistence.markFactorReconciling).toHaveBeenCalled();
  });

  it('hands the settle transaction the rotation target so rotation is atomic with verification', async () => {
    const { service, persistence } = build();
    await service.verifyTotpEnrollment(verifyInput(), env, signal);
    expect(persistence.settleEnrollmentVerify).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        rotation: { sessionId: NEW_SESSION_ID, issuedAt: iso(0) },
      }),
      signal,
    );
  });

  it('uses the factor identity from the path, never from the body or session', async () => {
    const { service, persistence } = build();
    await service.verifyTotpEnrollment(verifyInput({}), env, signal);
    expect(persistence.prepareEnrollmentVerify).toHaveBeenCalledWith(
      expect.objectContaining({
        authUserId: AUTH_USER_ID,
        factorId: OTHER_FACTOR_ID,
      }),
      signal,
    );
    expect(FACTOR_ID).not.toBe(OTHER_FACTOR_ID);
  });
});
