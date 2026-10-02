import { authRoutePolicies } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  AUTH_USER_ID,
  bindings,
  IDENTITY_ID,
  PERSON_ID,
  session,
} from './phase-02-slice-02.test-fixtures';
import {
  createApp,
  failure,
  operations,
  requestFor,
  success,
} from './phase-02-slice-02.test-support';

describe('Phase 2 Slice 02 login methods and account merge RED acceptance', () => {
  it.each(operations)(
    '$id completes its declared happy path',
    async (operation) => {
      const { app, slice } = createApp();
      const response = await app.request(
        requestFor(operation),
        undefined,
        bindings,
      );
      expect(response.status).toBe(operation.successStatus);
      expect(slice[operation.dependency]).toHaveBeenCalledOnce();
    },
  );

  it.each(operations)(
    '$id rejects malformed or unknown request input',
    async (operation) => {
      const { app, slice } = createApp();
      const response = await app.request(
        requestFor(operation, { invalid: true }),
        undefined,
        bindings,
      );
      expect([400, 422]).toContain(response.status);
      expect(slice[operation.dependency]).not.toHaveBeenCalled();
    },
  );

  it.each(operations)(
    '$id derives the authenticated self server-side',
    async (operation) => {
      const { app, slice } = createApp({
        resolveSession: vi.fn(async () =>
          failure(
            401,
            'UNAUTHENTICATED',
            'The authentication session is invalid.',
          ),
        ),
      });
      const response = await app.request(
        requestFor(operation),
        undefined,
        bindings,
      );
      expect(response.status).toBe(401);
      expect(slice[operation.dependency]).not.toHaveBeenCalled();
    },
  );

  it.each(operations)(
    '$id enforces cache, CAS, and replay boundaries',
    async (operation) => {
      const { app, slice } = createApp();
      const response = await app.request(
        requestFor(operation, { omitVersion: operation.mutation }),
        undefined,
        bindings,
      );
      if (operation.mutation) {
        expect(response.status).toBe(400);
        expect(slice[operation.dependency]).not.toHaveBeenCalled();
      } else {
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(response.headers.get('etag')).toMatch(/^"[1-9][0-9]*"$/u);
      }
    },
  );

  it.each(operations)(
    '$id maps dependency failures to typed safe errors',
    async (operation) => {
      const { app, slice } = createApp();
      const mock = slice[operation.dependency] as ReturnType<typeof vi.fn>;
      mock.mockResolvedValueOnce(
        failure(
          503,
          'DEPENDENCY_UNAVAILABLE',
          'Authentication is temporarily unavailable.',
        ),
      );
      const response = await app.request(
        requestFor(operation),
        undefined,
        bindings,
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual(
        expect.objectContaining({
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'Authentication is temporarily unavailable.',
        }),
      );
    },
  );

  it.each(operations)(
    '$id binds effects to server-derived authority',
    async (operation) => {
      const { app, slice } = createApp();
      await app.request(requestFor(operation), undefined, bindings);
      const mock = slice[operation.dependency] as ReturnType<typeof vi.fn>;
      expect(mock).toHaveBeenCalledOnce();
      const call = JSON.stringify(mock.mock.calls[0]);
      expect(call).toContain(AUTH_USER_ID);
      expect(call).toContain(PERSON_ID);
      expect(call).not.toContain('candidateAuthUserId');
      expect(call).not.toContain('actingRole');
    },
  );

  it('P2-S02-AC-001 exposes only the bounded login-method projection', async () => {
    const { app } = createApp();
    const response = await app.request(
      requestFor(operations[0]!),
      undefined,
      bindings,
    );
    const text = await response.text();
    expect(text).not.toMatch(
      /email|providerSubject|accessToken|refreshToken|ipAddress/u,
    );
  });

  it('P2-S02-AC-002 rejects provider-link CSRF before any intent effect', async () => {
    const { app, slice } = createApp();
    const response = await app.request(
      requestFor(operations[1]!, { omitCsrf: true }),
      undefined,
      bindings,
    );
    expect(response.status).toBe(403);
    expect(slice.startLoginMethodLink).not.toHaveBeenCalled();
  });

  it('P2-S02-AC-002 rejects stale step-up before destructive or merge effects', async () => {
    const { app, slice } = createApp({
      resolveSession: vi.fn(async () =>
        success({ ...session, stepUpAt: '2020-01-01T00:00:00Z' }),
      ),
    });
    const response = await app.request(
      requestFor(operations[2]!),
      undefined,
      bindings,
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: 'STEP_UP_REQUIRED',
      details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
    });
    expect(slice.unlinkLoginMethod).not.toHaveBeenCalled();
  });

  it('P2-S02-AC-002 preserves final-method and stale-plan conflicts without disclosure', async () => {
    const { app, slice } = createApp();
    slice.unlinkLoginMethod.mockResolvedValueOnce(
      failure(409, 'CONFLICT', 'The login method cannot be removed.'),
    );
    const response = await app.request(
      requestFor(operations[2]!),
      undefined,
      bindings,
    );
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain(IDENTITY_ID);
  });

  it('P2-S02-AC-003 keeps the complete AUTH-API-09 through AUTH-API-21 policy set locked', () => {
    expect(
      authRoutePolicies
        .filter(({ operationId }) => Number(operationId.slice(-2)) >= 9)
        .map(({ operationId, rateLimit, timeoutMs }) => ({
          operationId,
          rateLimit,
          timeoutMs,
        })),
    ).toEqual([
      { operationId: 'AUTH-API-09', rateLimit: 300, timeoutMs: 8_000 },
      { operationId: 'AUTH-API-10', rateLimit: 5, timeoutMs: 15_000 },
      { operationId: 'AUTH-API-11', rateLimit: 5, timeoutMs: 15_000 },
      { operationId: 'AUTH-API-12', rateLimit: 2, timeoutMs: 15_000 },
      { operationId: 'AUTH-API-13', rateLimit: 300, timeoutMs: 8_000 },
      { operationId: 'AUTH-API-14', rateLimit: 5, timeoutMs: 15_000 },
      { operationId: 'AUTH-API-15', rateLimit: 10, timeoutMs: 15_000 },
      { operationId: 'AUTH-API-16', rateLimit: 300, timeoutMs: 8_000 },
      { operationId: 'AUTH-API-17', rateLimit: 5, timeoutMs: 15_000 },
      { operationId: 'AUTH-API-18', rateLimit: 10, timeoutMs: 15_000 },
      { operationId: 'AUTH-API-19', rateLimit: 5, timeoutMs: 15_000 },
      { operationId: 'AUTH-API-20', rateLimit: 10, timeoutMs: 8_000 },
      { operationId: 'AUTH-API-21', rateLimit: 10, timeoutMs: 8_000 },
    ]);
  });
});
