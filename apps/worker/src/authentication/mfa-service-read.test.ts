import { describe, expect, it } from 'vitest';

import { authError } from './boundary';
import {
  AUTH_USER_ID,
  buildService,
  env,
  fakePersistence,
  fakeProvider,
  iso,
  ok,
  requestFor,
  sessionFor,
  signal,
  snapshotOf,
  verifiedRow,
} from './mfa-test-support';

const build = buildService;

describe('MFA factor list (AUTH-API-16)', () => {
  it('returns the registry projection with the proof computed from the session only', async () => {
    const { service, persistence, provider } = build();
    const result = await service.readMfaFactors(
      {
        session: sessionFor({ stepUpAt: iso(-60) }),
        request: requestFor('GET'),
      },
      env,
      signal,
    );
    expect(result).toEqual(
      ok({
        factors: [verifiedRow()],
        allowedMethods: ['totp'],
        stepUp: { fresh: true, freshUntil: iso(540) },
        version: '3',
      }),
    );
    expect(persistence.readFactors).toHaveBeenCalledWith(
      expect.objectContaining({ authUserId: AUTH_USER_ID }),
      signal,
    );
    expect(provider.enroll).not.toHaveBeenCalled();
    expect(provider.challenge).not.toHaveBeenCalled();
  });

  it.each([
    ['absent', null],
    ['stale', iso(-601)],
    ['future dated beyond the bound', iso(31)],
  ] as const)('reports a %s proof as not fresh', async (_name, stepUpAt) => {
    const { service } = build();
    const result = await service.readMfaFactors(
      { session: sessionFor({ stepUpAt }), request: requestFor('GET') },
      env,
      signal,
    );
    expect(result).toMatchObject({
      ok: true,
      value: { stepUp: { fresh: false, freshUntil: null } },
    });
  });

  it.each(['suspended', 'memorialised', 'erasure_processing', null] as const)(
    'refuses an ineligible %s account with 403 account_not_eligible',
    async (accountState) => {
      const { service, persistence } = build();
      const result = await service.readMfaFactors(
        { session: sessionFor({ accountState }), request: requestFor('GET') },
        env,
        signal,
      );
      expect(result).toMatchObject({
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        details: { reasonCode: 'account_not_eligible' },
      });
      expect(persistence.readFactors).not.toHaveBeenCalled();
    },
  );

  it('accepts an eligible claimed account', async () => {
    const { service } = build();
    const result = await service.readMfaFactors(
      {
        session: sessionFor({ accountState: 'claimed' }),
        request: requestFor('GET'),
      },
      env,
      signal,
    );
    expect(result.ok).toBe(true);
  });

  it('passes persistence failures through and rejects an invalid projection with 502', async () => {
    const failing = fakePersistence({
      readFactors: async () => authError(503, 'DEPENDENCY_UNAVAILABLE', 'down'),
    });
    expect(
      await build(failing).service.readMfaFactors(
        { session: sessionFor(), request: requestFor('GET') },
        env,
        signal,
      ),
    ).toMatchObject({ ok: false, status: 503 });
    const eleven = fakePersistence({
      readFactors: async () =>
        ok(
          snapshotOf(
            Array.from({ length: 11 }, (_, index) =>
              verifiedRow({
                id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
                friendlyName: `Factor ${index}`,
              }),
            ),
          ),
        ),
    });
    expect(
      await build(eleven).service.readMfaFactors(
        { session: sessionFor(), request: requestFor('GET') },
        env,
        signal,
      ),
    ).toMatchObject({ ok: false, status: 502 });
  });
});
