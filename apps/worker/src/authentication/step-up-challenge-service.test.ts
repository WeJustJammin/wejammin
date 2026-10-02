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

const challengeInput = (
  overrides: Partial<{
    factorId: string | null;
    session: ReturnType<typeof sessionFor>;
  }> = {},
) => ({
  session: sessionFor({ stepUpAt: null }),
  request: requestFor(),
  method: 'totp' as const,
  factorId: null,
  ...overrides,
});

describe('step-up challenge creation (AUTH-API-20)', () => {
  it('supersedes, creates the provider challenge, then records it bound to the session', async () => {
    const order: string[] = [];
    const persistence = fakePersistence();
    const provider = fakeProvider();
    persistence.beginChallenge.mockImplementation(async () => {
      order.push('begin');
      return ok({
        factorId: FACTOR_ID,
        providerFactorId: PROVIDER_FACTOR_ID,
        friendlyName: 'Phone authenticator',
      });
    });
    provider.challenge.mockImplementation(async () => {
      order.push('challenge');
      return ok({
        providerChallengeId: PROVIDER_CHALLENGE_ID,
        expiresAt: iso(300),
      });
    });
    persistence.finishChallenge.mockImplementation(async () => {
      order.push('finish');
      return ok({ challengeId: CHALLENGE_ID, expiresAt: iso(300) });
    });
    const { service } = buildService(persistence, provider);
    const result = await service.createStepUpChallenge(
      challengeInput(),
      env,
      signal,
    );
    expect(order).toEqual(['begin', 'challenge', 'finish']);
    expect(result).toEqual(
      ok({
        challengeId: CHALLENGE_ID,
        method: 'totp',
        factorId: FACTOR_ID,
        friendlyName: 'Phone authenticator',
        expiresAt: iso(300),
      }),
    );
    expect(persistence.beginChallenge).toHaveBeenCalledWith(
      expect.objectContaining({
        authUserId: AUTH_USER_ID,
        sessionId: SESSION_ID,
        method: 'totp',
        factorId: null,
      }),
      signal,
    );
    expect(persistence.finishChallenge).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        factorId: FACTOR_ID,
        providerChallengeId: PROVIDER_CHALLENGE_ID,
        expiresAt: iso(300),
      }),
      signal,
    );
    expect(JSON.stringify(result)).not.toContain(PROVIDER_CHALLENGE_ID);
    expect(JSON.stringify(result)).not.toContain(PROVIDER_FACTOR_ID);
  });

  it('caps the challenge at ten minutes when the provider expiry is later', async () => {
    const provider = fakeProvider({
      challenge: async () =>
        ok({
          providerChallengeId: PROVIDER_CHALLENGE_ID,
          expiresAt: iso(3600),
        }),
    });
    const { service, persistence } = buildService(fakePersistence(), provider);
    await service.createStepUpChallenge(challengeInput(), env, signal);
    expect(persistence.finishChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: iso(600) }),
      signal,
    );
  });

  it('forwards an explicit factor id for the database to validate', async () => {
    const { service, persistence } = buildService();
    await service.createStepUpChallenge(
      challengeInput({ factorId: FACTOR_ID }),
      env,
      signal,
    );
    expect(persistence.beginChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ factorId: FACTOR_ID }),
      signal,
    );
  });

  it('passes database refusals through before any provider call', async () => {
    const persistence = fakePersistence({
      beginChallenge: async () =>
        authError(409, 'CONFLICT', 'none', {
          conflict: 'INVALID_TRANSITION',
          reasonCode: 'no_verified_factor',
          recoveryAction: 'enroll_factor',
        }),
    });
    const { service, provider } = buildService(persistence);
    const result = await service.createStepUpChallenge(
      challengeInput(),
      env,
      signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 409,
      details: {
        reasonCode: 'no_verified_factor',
        recoveryAction: 'enroll_factor',
      },
    });
    expect(provider.challenge).not.toHaveBeenCalled();
  });

  it('returns a provider failure without recording a challenge', async () => {
    const provider = fakeProvider({
      challenge: async () => authError(504, 'DEPENDENCY_TIMEOUT', 'slow'),
    });
    const { service, persistence } = buildService(fakePersistence(), provider);
    const result = await service.createStepUpChallenge(
      challengeInput(),
      env,
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 504 });
    expect(persistence.finishChallenge).not.toHaveBeenCalled();
  });

  it('passes a record failure through', async () => {
    const persistence = fakePersistence({
      finishChallenge: async () =>
        authError(503, 'DEPENDENCY_UNAVAILABLE', 'down'),
    });
    const { service } = buildService(persistence);
    expect(
      await service.createStepUpChallenge(challengeInput(), env, signal),
    ).toMatchObject({ ok: false, status: 503 });
  });

  it('refuses an ineligible account before any state change', async () => {
    const { service, persistence } = buildService();
    const result = await service.createStepUpChallenge(
      challengeInput({ session: sessionFor({ accountState: 'suspended' }) }),
      env,
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(persistence.beginChallenge).not.toHaveBeenCalled();
  });
});
