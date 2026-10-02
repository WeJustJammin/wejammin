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
  ok,
  PROVIDER_CHALLENGE_ID,
  PROVIDER_FACTOR_ID,
  requestFor,
  ROTATED_COOKIES,
  SESSION_ID,
  sessionFor,
  signal,
} from './mfa-test-support';

describe('step-up verification and rotation (AUTH-API-21)', () => {
  const verifyInput = () => ({
    session: sessionFor({ stepUpAt: null }),
    request: requestFor(),
    challengeId: CHALLENGE_ID,
    code: '123456',
  });

  it('verifies, validates, consumes, then commits cookies and returns no token', async () => {
    const order: string[] = [];
    const persistence = fakePersistence();
    const provider = fakeProvider();
    const rotation = fakeRotation(iso(0));
    persistence.prepareChallengeVerify.mockImplementation(async () => {
      order.push('prepare');
      return ok({
        factorId: FACTOR_ID,
        providerFactorId: PROVIDER_FACTOR_ID,
        providerChallengeId: PROVIDER_CHALLENGE_ID,
        expiresAt: iso(300),
      });
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
        commit: rotation.commit,
      });
    });
    persistence.settleChallengeVerify.mockImplementation(async () => {
      order.push('settle');
      return ok(null);
    });
    rotation.commit.mockImplementation(async () => {
      order.push('commit');
      return ok({ cookies: [...ROTATED_COOKIES] });
    });
    const { service } = buildService(persistence, provider, rotation);
    const result = await service.verifyStepUpChallenge(
      verifyInput(),
      env,
      signal,
    );
    expect(order).toEqual([
      'prepare',
      'verify',
      'validate',
      'settle',
      'commit',
    ]);
    expect(result).toEqual(
      ok({
        resource: {
          verified: true,
          method: 'totp',
          stepUpAt: iso(0),
          freshUntil: iso(600),
        },
        cookies: [...ROTATED_COOKIES],
      }),
    );
    expect(persistence.prepareChallengeVerify).toHaveBeenCalledWith(
      expect.objectContaining({
        authUserId: AUTH_USER_ID,
        sessionId: SESSION_ID,
        challengeId: CHALLENGE_ID,
      }),
      signal,
    );
    expect(provider.verify).toHaveBeenCalledWith(
      expect.objectContaining({
        providerFactorId: PROVIDER_FACTOR_ID,
        providerChallengeId: PROVIDER_CHALLENGE_ID,
        code: '123456',
      }),
      signal,
    );
    expect(JSON.stringify(result)).not.toContain('rotated-access');
  });

  it.each([
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
  ] as const)(
    'passes a %i challenge refusal through before the provider',
    async (status, code) => {
      const persistence = fakePersistence({
        prepareChallengeVerify: async () => authError(status, code, 'no'),
      });
      const { service, provider } = buildService(persistence);
      const result = await service.verifyStepUpChallenge(
        verifyInput(),
        env,
        signal,
      );
      expect(result).toMatchObject({ ok: false, status, code });
      expect(provider.verify).not.toHaveBeenCalled();
    },
  );

  it('refuses a challenge past its own expiry with challenge_expired and new_challenge', async () => {
    const persistence = fakePersistence({
      prepareChallengeVerify: async () =>
        ok({
          factorId: FACTOR_ID,
          providerFactorId: PROVIDER_FACTOR_ID,
          providerChallengeId: PROVIDER_CHALLENGE_ID,
          expiresAt: iso(-1),
        }),
    });
    const { service, provider } = buildService(persistence);
    const result = await service.verifyStepUpChallenge(
      verifyInput(),
      env,
      signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 409,
      code: 'CONFLICT',
      details: {
        reasonCode: 'challenge_expired',
        recoveryAction: 'new_challenge',
      },
    });
    expect(provider.verify).not.toHaveBeenCalled();
  });

  it('keeps the challenge pending and charges the failure on a wrong code', async () => {
    const provider = fakeProvider({
      verify: async () => authError(422, 'VALIDATION_FAILED', 'wrong'),
    });
    const { service, persistence, rotation } = buildService(
      fakePersistence(),
      provider,
    );
    const result = await service.verifyStepUpChallenge(
      verifyInput(),
      env,
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 422 });
    expect(persistence.recordChallengeFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        challengeId: CHALLENGE_ID,
        outcome: 'incorrect',
      }),
      expect.anything(),
    );
    expect(persistence.settleChallengeVerify).not.toHaveBeenCalled();
    expect(rotation.commit).not.toHaveBeenCalled();
  });

  it('returns a provider rate refusal without consuming or failing the challenge', async () => {
    const provider = fakeProvider({
      verify: async () => ({
        ...authError(429, 'RATE_LIMITED', 'slow down'),
        retryAfterSeconds: 900,
      }),
    });
    const { service, persistence } = buildService(fakePersistence(), provider);
    const result = await service.verifyStepUpChallenge(
      verifyInput(),
      env,
      signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 429,
      retryAfterSeconds: 900,
    });
    expect(persistence.recordChallengeFailure).not.toHaveBeenCalled();
  });

  it.each([
    ['post-send timeout', 504],
    ['invalid 2xx', 502],
  ] as const)(
    'fails the challenge and sets no cookie on provider %s',
    async (_name, status) => {
      const provider = fakeProvider({
        verify: async () => authError(status, 'PROVIDER_AMBIGUOUS', 'unknown'),
      });
      const { service, persistence, rotation } = buildService(
        fakePersistence(),
        provider,
      );
      const result = await service.verifyStepUpChallenge(
        verifyInput(),
        env,
        signal,
      );
      expect(result).toMatchObject({ ok: false, status });
      expect(persistence.recordChallengeFailure).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'ambiguous' }),
        expect.anything(),
      );
      expect(rotation.commit).not.toHaveBeenCalled();
    },
  );

  it('fails the challenge when the returned session does not validate', async () => {
    const rotation = fakeRotation();
    rotation.validate.mockResolvedValue(
      authError(502, 'PROVIDER_INVALID_RESPONSE', 'bad token'),
    );
    const { service, persistence } = buildService(
      fakePersistence(),
      fakeProvider(),
      rotation,
    );
    const result = await service.verifyStepUpChallenge(
      verifyInput(),
      env,
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 502 });
    expect(persistence.recordChallengeFailure).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'ambiguous' }),
      expect.anything(),
    );
    expect(persistence.settleChallengeVerify).not.toHaveBeenCalled();
  });

  it('does not commit cookies when consuming the challenge fails', async () => {
    const persistence = fakePersistence({
      settleChallengeVerify: async () =>
        authError(503, 'DEPENDENCY_UNAVAILABLE', 'down'),
    });
    const { service, rotation } = buildService(persistence);
    const result = await service.verifyStepUpChallenge(
      verifyInput(),
      env,
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(rotation.commit).not.toHaveBeenCalled();
  });

  it('returns a cookie commit failure', async () => {
    const rotation = fakeRotation();
    rotation.commit.mockResolvedValue(
      authError(503, 'DEPENDENCY_UNAVAILABLE', 'down'),
    );
    const { service } = buildService(
      fakePersistence(),
      fakeProvider(),
      rotation,
    );
    expect(
      await service.verifyStepUpChallenge(verifyInput(), env, signal),
    ).toMatchObject({ ok: false, status: 503 });
  });

  it('refuses an ineligible account before any state change', async () => {
    const { service, persistence } = buildService();
    const result = await service.verifyStepUpChallenge(
      { ...verifyInput(), session: sessionFor({ accountState: 'suspended' }) },
      env,
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(persistence.prepareChallengeVerify).not.toHaveBeenCalled();
  });
});
