import { describe, expect, it } from 'vitest';

import {
  bindings,
  createMfaApp,
  enrollmentBody,
  factorsBody,
  mfaRequest,
} from './mfa-route-test-support';
import { failure, success } from './phase-02-slice-02.test-support';
import {
  FACTOR_ID,
  OTHER_FACTOR_ID,
  ROTATED_COOKIES,
} from './mfa-test-support';

const LIST = '/api/v1/account/mfa/factors';
const ENROLL_BODY = { method: 'totp', friendlyName: 'Phone authenticator' };

const send = (app: ReturnType<typeof createMfaApp>['app'], request: Request) =>
  app.request(request, undefined, bindings);

describe('AUTH-API-18 TOTP enrollment verify route', () => {
  const path = `${LIST}/${OTHER_FACTOR_ID}/verify`;
  const verify = (
    app: ReturnType<typeof createMfaApp>['app'],
    options: Parameters<typeof mfaRequest>[2] = {},
    target = path,
  ) =>
    send(
      app,
      mfaRequest('POST', target, {
        body: { code: '123456' },
        ...options,
        headers: { 'if-match': '"5"', ...options.headers },
      }),
    );

  it('returns 200 with the resource, ETag and every rotated cookie', async () => {
    const { app, mocks } = createMfaApp();
    const response = await verify(app);
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"3"');
    expect(response.headers.getSetCookie()).toEqual([...ROTATED_COOKIES]);
    await expect(response.json()).resolves.toEqual(factorsBody);
    expect(mocks.verifyTotpEnrollment).toHaveBeenCalledWith(
      expect.objectContaining({
        factorId: OTHER_FACTOR_ID,
        code: '123456',
        ifMatch: '"5"',
      }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('rejects a malformed factor id with 400 before the body is trusted', async () => {
    const { app, mocks } = createMfaApp();
    const response = await verify(app, {}, `${LIST}/not-a-uuid/verify`);
    expect(response.status).toBe(400);
    expect(mocks.verifyTotpEnrollment).not.toHaveBeenCalled();
  });

  it.each(['12345', '1234567', 'abcdef', ' 123456', '123 456', '123-456'])(
    'answers 422 code_invalid for %j without reaching the provider',
    async (code) => {
      const { app, mocks } = createMfaApp();
      const response = await verify(app, { body: { code } });
      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toMatchObject({
        details: { violations: [{ path: '/code', code: 'code_invalid' }] },
      });
      expect(mocks.verifyTotpEnrollment).not.toHaveBeenCalled();
    },
  );

  it('requires If-Match and CSRF', async () => {
    const { app } = createMfaApp();
    expect((await verify(app, { headers: { 'if-match': null } })).status).toBe(
      400,
    );
    expect(
      (await verify(app, { headers: { 'x-csrf-token': null } })).status,
    ).toBe(403);
  });

  it('uses the 10 per 15 minute verification bucket', async () => {
    const { app, auth } = createMfaApp();
    await verify(app);
    expect(auth.rateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'AUTH-API-18',
        limit: 10,
        windowSeconds: 900,
      }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('sets no cookie on a failed verification and keeps the 422 body', async () => {
    const { app } = createMfaApp({
      verifyTotpEnrollment: async () => ({
        ok: false as const,
        status: 422 as const,
        code: 'VALIDATION_FAILED',
        message: 'Check the highlighted fields.',
        details: {
          violations: [
            {
              path: '/code',
              code: 'code_incorrect',
              message: 'The value is invalid.',
            },
          ],
        },
      }),
    });
    const response = await verify(app);
    expect(response.status).toBe(422);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('never exposes provider material in the response', async () => {
    const { app } = createMfaApp();
    const text = await (await verify(app)).text();
    expect(text).not.toMatch(/access_token|refresh_token|providerFactor|amr/u);
  });
});

describe('AUTH-API-19 TOTP factor removal route', () => {
  const path = `${LIST}/${FACTOR_ID}`;
  const remove = (
    app: ReturnType<typeof createMfaApp>['app'],
    options: Parameters<typeof mfaRequest>[2] = {},
  ) =>
    send(
      app,
      mfaRequest('DELETE', path, {
        body: { reason: 'user_request' },
        ...options,
        headers: {
          'if-match': '"3"',
          'idempotency-key': 'remove-factor-0001',
          ...options.headers,
        },
      }),
    );

  it('returns 200 with the resource and forwards key, version and reason', async () => {
    const { app, mocks } = createMfaApp();
    const response = await remove(app);
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"3"');
    expect(mocks.removeMfaFactor).toHaveBeenCalledWith(
      expect.objectContaining({
        factorId: FACTOR_ID,
        reason: 'user_request',
        ifMatch: '"3"',
        idempotencyKey: 'remove-factor-0001',
      }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('requires Idempotency-Key, If-Match and CSRF', async () => {
    const { app, mocks } = createMfaApp();
    expect(
      (await remove(app, { headers: { 'idempotency-key': null } })).status,
    ).toBe(400);
    expect((await remove(app, { headers: { 'if-match': null } })).status).toBe(
      400,
    );
    expect(
      (await remove(app, { headers: { 'x-csrf-token': null } })).status,
    ).toBe(403);
    expect(mocks.removeMfaFactor).not.toHaveBeenCalled();
  });

  it('accepts only the closed reason enum', async () => {
    const { app, mocks } = createMfaApp();
    const response = await remove(app, { body: { reason: 'bored' } });
    expect(response.status).toBe(422);
    expect(mocks.removeMfaFactor).not.toHaveBeenCalled();
    const ok = await remove(app, { body: { reason: 'factor_compromise' } });
    expect(ok.status).toBe(200);
  });

  it('passes STEP_UP_REQUIRED and last_factor_required refusals through', async () => {
    const stale = createMfaApp({
      removeMfaFactor: async () => ({
        ok: false as const,
        status: 401 as const,
        code: 'STEP_UP_REQUIRED',
        message: 'Recent verification is required.',
        details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
      }),
    });
    expect((await remove(stale.app)).status).toBe(401);
    const last = createMfaApp({
      removeMfaFactor: async () => ({
        ok: false as const,
        status: 409 as const,
        code: 'CONFLICT',
        message: 'last',
        details: {
          conflict: 'INVALID_TRANSITION',
          reasonCode: 'last_factor_required',
          recoveryAction: 'enroll_factor',
        },
      }),
    });
    const response = await remove(last.app);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      details: {
        reasonCode: 'last_factor_required',
        recoveryAction: 'enroll_factor',
      },
    });
  });

  it('uses the 5 per hour policy and rejects a malformed factor id', async () => {
    const { app, auth } = createMfaApp();
    await remove(app);
    expect(auth.rateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'AUTH-API-19',
        limit: 5,
        windowSeconds: 3600,
      }),
      expect.anything(),
      expect.anything(),
    );
    const bad = await send(
      app,
      mfaRequest('DELETE', `${LIST}/nope`, {
        body: { reason: 'user_request' },
        headers: { 'if-match': '"3"', 'idempotency-key': 'remove-factor-0001' },
      }),
    );
    expect(bad.status).toBe(400);
  });
});
