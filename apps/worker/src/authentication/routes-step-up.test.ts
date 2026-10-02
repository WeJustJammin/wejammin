import { describe, expect, it } from 'vitest';

import {
  bindings,
  challengeBody,
  createMfaApp,
  mfaRequest,
  stepUpResultBody,
} from './mfa-route-test-support';
import { failure, success } from './phase-02-slice-02.test-support';
import { CHALLENGE_ID, FACTOR_ID, ROTATED_COOKIES } from './mfa-test-support';

const CHALLENGES = '/api/v1/auth/step-up/challenges';

const send = (app: ReturnType<typeof createMfaApp>['app'], request: Request) =>
  app.request(request, undefined, bindings);

describe('AUTH-API-20 step-up challenge route', () => {
  const create = (
    app: ReturnType<typeof createMfaApp>['app'],
    options: Parameters<typeof mfaRequest>[2] = {},
  ) =>
    send(
      app,
      mfaRequest('POST', CHALLENGES, { body: { method: 'totp' }, ...options }),
    );

  it('returns 201 with the challenge and forwards a null factor by default', async () => {
    const { app, mocks } = createMfaApp();
    const response = await create(app);
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toBeNull();
    await expect(response.json()).resolves.toEqual(challengeBody);
    expect(mocks.createStepUpChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'totp', factorId: null }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('forwards an explicit factor id and needs no key or If-Match', async () => {
    const { app, mocks } = createMfaApp();
    const response = await create(app, {
      body: { method: 'totp', factorId: FACTOR_ID },
    });
    expect(response.status).toBe(201);
    expect(mocks.createStepUpChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ factorId: FACTOR_ID }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('answers 422 with spec codes for a bad method or factor id', async () => {
    const { app, mocks } = createMfaApp();
    const method = await create(app, { body: { method: 'sms' } });
    expect(method.status).toBe(422);
    await expect(method.json()).resolves.toMatchObject({
      details: {
        violations: [{ path: '/method', code: 'method_not_available' }],
      },
    });
    const factor = await create(app, {
      body: { method: 'totp', factorId: 'x' },
    });
    expect(factor.status).toBe(422);
    await expect(factor.json()).resolves.toMatchObject({
      details: {
        violations: [{ path: '/factorId', code: 'factor_id_invalid' }],
      },
    });
    expect(mocks.createStepUpChallenge).not.toHaveBeenCalled();
  });

  it('enforces CSRF, origin and content type', async () => {
    const { app } = createMfaApp();
    expect(
      (await create(app, { headers: { 'x-csrf-token': null } })).status,
    ).toBe(403);
    expect(
      (await create(app, { headers: { origin: 'https://evil.example' } }))
        .status,
    ).toBe(403);
    expect(
      (await create(app, { headers: { 'content-type': 'text/plain' } })).status,
    ).toBe(415);
  });

  it('needs a session and applies the 10 per 15 minute bucket', async () => {
    const anonymous = createMfaApp({
      resolveSession: async () => failure(401, 'UNAUTHENTICATED', 'no'),
    });
    expect((await create(anonymous.app)).status).toBe(401);
    const { app, auth } = createMfaApp();
    await create(app);
    expect(auth.rateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'AUTH-API-20',
        limit: 10,
        windowSeconds: 900,
      }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('passes database refusals through', async () => {
    const { app } = createMfaApp({
      createStepUpChallenge: async () => ({
        ok: false as const,
        status: 409 as const,
        code: 'CONFLICT',
        message: 'none',
        details: {
          conflict: 'INVALID_TRANSITION',
          reasonCode: 'no_verified_factor',
          recoveryAction: 'enroll_factor',
        },
      }),
    });
    const response = await create(app);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      details: { recoveryAction: 'enroll_factor' },
    });
  });

  it('fails closed when absent and rejects an invalid payload', async () => {
    expect(
      (await create(createMfaApp({}, ['createStepUpChallenge']).app)).status,
    ).toBe(503);
    const bad = createMfaApp({
      createStepUpChallenge: async () => success({} as never),
    });
    expect((await create(bad.app)).status).toBe(502);
  });
});

describe('AUTH-API-21 step-up verify route', () => {
  const path = `${CHALLENGES}/${CHALLENGE_ID}/verify`;
  const verify = (
    app: ReturnType<typeof createMfaApp>['app'],
    options: Parameters<typeof mfaRequest>[2] = {},
    target = path,
  ) =>
    send(
      app,
      mfaRequest('POST', target, { body: { code: '123456' }, ...options }),
    );

  it('returns 200 with the result, rotated cookies and no token', async () => {
    const { app, mocks } = createMfaApp();
    const response = await verify(app);
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie()).toEqual([...ROTATED_COOKIES]);
    expect(response.headers.get('etag')).toBeNull();
    const text = await response.text();
    expect(JSON.parse(text)).toEqual(stepUpResultBody);
    expect(text).not.toMatch(/access_token|refresh_token|token/u);
    expect(mocks.verifyStepUpChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ challengeId: CHALLENGE_ID, code: '123456' }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('rejects a malformed challenge id with 400', async () => {
    const { app, mocks } = createMfaApp();
    expect((await verify(app, {}, `${CHALLENGES}/nope/verify`)).status).toBe(
      400,
    );
    expect(mocks.verifyStepUpChallenge).not.toHaveBeenCalled();
  });

  it.each(['12345', 'abcdef', '123 456'])(
    'answers 422 code_invalid for %j',
    async (code) => {
      const { app, mocks } = createMfaApp();
      const response = await verify(app, { body: { code } });
      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toMatchObject({
        details: { violations: [{ path: '/code', code: 'code_invalid' }] },
      });
      expect(mocks.verifyStepUpChallenge).not.toHaveBeenCalled();
    },
  );

  it('enforces CSRF and the failure bucket', async () => {
    const { app, auth } = createMfaApp();
    expect(
      (await verify(app, { headers: { 'x-csrf-token': null } })).status,
    ).toBe(403);
    await verify(app);
    expect(auth.rateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'AUTH-API-21',
        limit: 10,
        windowSeconds: 900,
      }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('stops with 429 before the provider when the bucket is spent', async () => {
    const { app, auth, mocks } = createMfaApp();
    Object.assign(auth, {
      rateLimit: async () =>
        success({
          allowed: false,
          limit: 10,
          remaining: 0,
          resetAt: 4_102_444_800,
        }),
    });
    expect((await verify(app)).status).toBe(429);
    expect(mocks.verifyStepUpChallenge).not.toHaveBeenCalled();
  });

  it('sets no cookie on failure and keeps 409 recovery details', async () => {
    const { app } = createMfaApp({
      verifyStepUpChallenge: async () => ({
        ok: false as const,
        status: 409 as const,
        code: 'CONFLICT',
        message: 'expired',
        details: {
          conflict: 'INVALID_TRANSITION',
          reasonCode: 'challenge_expired',
          recoveryAction: 'new_challenge',
        },
      }),
    });
    const response = await verify(app);
    expect(response.status).toBe(409);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('fails closed when absent and rejects an invalid payload', async () => {
    expect(
      (await verify(createMfaApp({}, ['verifyStepUpChallenge']).app)).status,
    ).toBe(503);
    const bad = createMfaApp({
      verifyStepUpChallenge: async () =>
        success({ resource: {} as never, cookies: [] }),
    });
    expect((await verify(bad.app)).status).toBe(502);
  });
});
