import { describe, expect, it, vi } from 'vitest';

import { authError } from './boundary';
import {
  AUTH_USER_ID,
  buildService,
  env,
  FACTOR_ID,
  fakePersistence,
  fakeProvider,
  iso,
  OTHER_FACTOR_ID,
  ok,
  PROVIDER_FACTOR_ID,
  pendingRow,
  requestFor,
  SESSION_ID,
  sessionFor,
  signal,
  snapshotOf,
  verifiedRow,
} from './mfa-test-support';

const removeInput = (
  overrides: Partial<{
    session: ReturnType<typeof sessionFor>;
    factorId: string;
    reason: 'factor_compromise' | 'user_request';
  }> = {},
) => ({
  session: sessionFor(),
  request: requestFor('DELETE'),
  factorId: FACTOR_ID,
  reason: 'user_request' as const,
  ifMatch: '"3"',
  idempotencyKey: 'remove-factor-key-0001',
  ...overrides,
});

describe('TOTP factor removal (AUTH-API-19)', () => {
  it('reserves locally, unenrolls at the provider, then confirms and returns the registry', async () => {
    const order: string[] = [];
    const persistence = fakePersistence();
    const provider = fakeProvider();
    persistence.beginRemoval.mockImplementation(async () => {
      order.push('begin');
      return ok({ providerFactorId: PROVIDER_FACTOR_ID, replay: null });
    });
    provider.unenroll.mockImplementation(async () => {
      order.push('unenroll');
      return ok(null);
    });
    persistence.finishRemoval.mockImplementation(async () => {
      order.push('finish');
      return ok(snapshotOf([pendingRow()], '7'));
    });
    const { service } = buildService(persistence, provider);
    const result = await service.removeMfaFactor(removeInput(), env, signal);
    expect(order).toEqual(['begin', 'unenroll', 'finish']);
    expect(result).toEqual(
      ok({
        factors: [pendingRow()],
        allowedMethods: ['totp'],
        stepUp: { fresh: true, freshUntil: iso(540) },
        version: '7',
      }),
    );
    expect(persistence.beginRemoval).toHaveBeenCalledWith(
      expect.objectContaining({
        authUserId: AUTH_USER_ID,
        factorId: FACTOR_ID,
        reason: 'user_request',
        expectedVersion: '3',
        idempotencyKey: 'remove-factor-key-0001',
        sessionId: SESSION_ID,
      }),
      signal,
    );
    expect(provider.unenroll).toHaveBeenCalledWith(
      expect.objectContaining({ providerFactorId: PROVIDER_FACTOR_ID }),
      signal,
    );
  });

  it('answers 404 with empty details for a factor the caller does not own', async () => {
    const { service, persistence, provider } = buildService();
    const result = await service.removeMfaFactor(
      removeInput({ factorId: '99999999-9999-4999-8999-999999999999' }),
      env,
      signal,
    );
    expect(result).toEqual(
      authError(404, 'NOT_FOUND', 'The requested resource was not found.', {}),
    );
    expect(persistence.beginRemoval).not.toHaveBeenCalled();
    expect(provider.unenroll).not.toHaveBeenCalled();
  });

  it('requires a fresh step-up proof to remove a verified factor', async () => {
    const { service, persistence, provider } = buildService();
    const result = await service.removeMfaFactor(
      removeInput({ session: sessionFor({ stepUpAt: iso(-601) }) }),
      env,
      signal,
    );
    expect(result).toEqual(
      authError(401, 'STEP_UP_REQUIRED', 'Recent verification is required.', {
        recoveryAction: 'step_up',
        allowedMethods: ['totp'],
      }),
    );
    expect(persistence.beginRemoval).not.toHaveBeenCalled();
    expect(provider.unenroll).not.toHaveBeenCalled();
  });

  it('lets an authenticated session cancel a pending factor without step-up', async () => {
    const persistence = fakePersistence({
      readFactors: async () =>
        ok(snapshotOf([verifiedRow(), pendingRow()], '3')),
    });
    const { service } = buildService(persistence);
    const result = await service.removeMfaFactor(
      removeInput({
        factorId: OTHER_FACTOR_ID,
        session: sessionFor({ stepUpAt: null }),
      }),
      env,
      signal,
    );
    expect(result.ok).toBe(true);
  });

  it('refuses a reconciling factor with 409 factor_state_conflict', async () => {
    const persistence = fakePersistence({
      readFactors: async () =>
        ok(snapshotOf([verifiedRow({ state: 'reconciling' })])),
    });
    const { service, provider } = buildService(persistence);
    const result = await service.removeMfaFactor(removeInput(), env, signal);
    expect(result).toMatchObject({
      ok: false,
      status: 409,
      code: 'CONFLICT',
      details: {
        conflict: 'INVALID_TRANSITION',
        reasonCode: 'factor_state_conflict',
        recoveryAction: 'refetch',
      },
    });
    expect(provider.unenroll).not.toHaveBeenCalled();
  });

  it('passes the last-factor refusal through without a provider call', async () => {
    const persistence = fakePersistence({
      beginRemoval: async () =>
        authError(409, 'CONFLICT', 'last', {
          conflict: 'INVALID_TRANSITION',
          reasonCode: 'last_factor_required',
          recoveryAction: 'enroll_factor',
        }),
    });
    const { service, provider } = buildService(persistence);
    const result = await service.removeMfaFactor(removeInput(), env, signal);
    expect(result).toMatchObject({
      ok: false,
      status: 409,
      details: { reasonCode: 'last_factor_required' },
    });
    expect(provider.unenroll).not.toHaveBeenCalled();
    expect(persistence.finishRemoval).not.toHaveBeenCalled();
  });

  it('replays a completed removal without touching the provider again', async () => {
    const persistence = fakePersistence({
      beginRemoval: async () =>
        ok({
          providerFactorId: PROVIDER_FACTOR_ID,
          replay: snapshotOf([], '7'),
        }),
    });
    const { service, provider } = buildService(persistence);
    const result = await service.removeMfaFactor(removeInput(), env, signal);
    expect(result).toMatchObject({
      ok: true,
      value: { factors: [], version: '7' },
    });
    expect(provider.unenroll).not.toHaveBeenCalled();
    expect(persistence.finishRemoval).not.toHaveBeenCalled();
  });

  it.each([502, 503, 504] as const)(
    'leaves the factor reconciling on provider failure %i, with no blind resend',
    async (status) => {
      const provider = fakeProvider({
        unenroll: vi.fn(async () =>
          authError(status, 'DEPENDENCY_UNAVAILABLE', 'x'),
        ),
      });
      const { service, persistence } = buildService(
        fakePersistence(),
        provider,
      );
      const result = await service.removeMfaFactor(removeInput(), env, signal);
      expect(result).toMatchObject({ ok: false, status });
      expect(provider.unenroll).toHaveBeenCalledTimes(1);
      expect(persistence.finishRemoval).not.toHaveBeenCalled();
    },
  );

  it('forwards the compromise reason so the database revokes the other sessions', async () => {
    const { service, persistence } = buildService();
    await service.removeMfaFactor(
      removeInput({ reason: 'factor_compromise' }),
      env,
      signal,
    );
    expect(persistence.beginRemoval).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'factor_compromise' }),
      signal,
    );
    expect(persistence.finishRemoval).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'factor_compromise',
        sessionId: SESSION_ID,
      }),
      signal,
    );
  });

  it('refuses an ineligible account before any read', async () => {
    const { service, persistence } = buildService();
    const result = await service.removeMfaFactor(
      removeInput({ session: sessionFor({ accountState: 'suspended' }) }),
      env,
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(persistence.readFactors).not.toHaveBeenCalled();
  });

  it('passes a confirmation failure through after the provider removal', async () => {
    const persistence = fakePersistence({
      finishRemoval: async () =>
        authError(503, 'DEPENDENCY_UNAVAILABLE', 'down'),
    });
    const { service } = buildService(persistence);
    expect(
      await service.removeMfaFactor(removeInput(), env, signal),
    ).toMatchObject({
      ok: false,
      status: 503,
    });
  });
});
