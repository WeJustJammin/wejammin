import { describe, expect, it } from 'vitest';

import { authError } from './boundary';
import {
  buildService,
  CHALLENGE_ID,
  env,
  fakePersistence,
  fakeProvider,
  fakeRotation,
  iso,
  OTHER_FACTOR_ID,
  ok,
  pendingRow,
  requestFor,
  sessionFor,
  signal,
  snapshotOf,
  verifiedRow,
} from './mfa-test-support';

const unavailable = () => authError(503, 'DEPENDENCY_UNAVAILABLE', 'down');

describe('MFA services: registry read failures and invalid projections', () => {
  it('startTotpEnrollment returns the registry read failure untouched', async () => {
    const persistence = fakePersistence({
      readFactors: async () => unavailable(),
    });
    const provider = fakeProvider();
    const { service } = buildService(persistence, provider);
    const result = await service.startTotpEnrollment(
      {
        session: sessionFor(),
        request: requestFor(),
        friendlyName: 'Phone authenticator',
        ifMatch: '"3"',
      },
      env,
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(provider.enroll).not.toHaveBeenCalled();
    expect(persistence.beginEnrollment).not.toHaveBeenCalled();
  });

  it('removeMfaFactor returns the registry read failure untouched', async () => {
    const persistence = fakePersistence({
      readFactors: async () => unavailable(),
    });
    const provider = fakeProvider();
    const { service } = buildService(persistence, provider);
    const result = await service.removeMfaFactor(
      {
        session: sessionFor(),
        request: requestFor('DELETE'),
        factorId: OTHER_FACTOR_ID,
        reason: 'user_request',
        ifMatch: '"3"',
        idempotencyKey: 'remove-factor-key-0001',
      },
      env,
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(persistence.beginRemoval).not.toHaveBeenCalled();
    expect(provider.unenroll).not.toHaveBeenCalled();
  });

  it('verifyTotpEnrollment answers 502 when the settled registry is not a valid resource', async () => {
    const eleven = Array.from({ length: 11 }, (_, index) =>
      verifiedRow({
        id: `5555555${index % 10}-5555-4555-8555-55555555555${index % 10}`,
      }),
    );
    const persistence = fakePersistence({
      settleEnrollmentVerify: async () => ok(snapshotOf(eleven, '6')),
      readFactors: async () =>
        ok(snapshotOf([verifiedRow(), pendingRow()], '5')),
    });
    const { service } = buildService(
      persistence,
      fakeProvider(),
      fakeRotation(iso(0)),
    );
    const result = await service.verifyTotpEnrollment(
      {
        session: sessionFor(),
        request: requestFor(),
        factorId: OTHER_FACTOR_ID,
        code: '123456',
        ifMatch: '"5"',
      },
      env,
      signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 502,
      code: 'DEPENDENCY_INVALID_RESPONSE',
    });
  });
});

describe('step-up challenge creation: expiry and projection edges', () => {
  const input = () => ({
    session: sessionFor({ stepUpAt: null }),
    request: requestFor(),
    method: 'totp' as const,
    factorId: null,
  });

  it('caps the challenge at the step-up freshness window when the provider expiry is unreadable', async () => {
    const persistence = fakePersistence();
    const provider = fakeProvider({
      challenge: async () =>
        ok({ providerChallengeId: CHALLENGE_ID, expiresAt: 'not-a-date' }),
    });
    const { service } = buildService(persistence, provider);
    const result = await service.createStepUpChallenge(input(), env, signal);
    expect(result.ok).toBe(true);
    expect(persistence.finishChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: iso(600) }),
      signal,
    );
  });

  it('answers 502 when the recorded challenge is not a valid StepUpChallenge', async () => {
    const persistence = fakePersistence({
      finishChallenge: async () =>
        ok({ challengeId: CHALLENGE_ID, expiresAt: 'garbage' }),
    });
    const { service } = buildService(persistence);
    const result = await service.createStepUpChallenge(input(), env, signal);
    expect(result).toMatchObject({
      ok: false,
      status: 502,
      code: 'DEPENDENCY_INVALID_RESPONSE',
    });
  });
});
