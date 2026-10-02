import { describe, expect, it } from 'vitest';

import {
  bindings,
  createMfaApp,
  enrollmentBody,
  factorsBody,
  mfaRequest,
} from './mfa-route-test-support';
import { failure, success } from './phase-02-slice-02.test-support';

const LIST = '/api/v1/account/mfa/factors';
const ENROLL_BODY = { method: 'totp', friendlyName: 'Phone authenticator' };

const send = (app: ReturnType<typeof createMfaApp>['app'], request: Request) =>
  app.request(request, undefined, bindings);

describe('AUTH-API-16 MFA factor list route', () => {
  it('returns the resource with a strong ETag, no-store and Vary Origin', async () => {
    const { app, mocks } = createMfaApp();
    const response = await send(app, mfaRequest('GET', LIST));
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"3"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('vary')).toContain('Origin');
    await expect(response.json()).resolves.toEqual(factorsBody);
    expect(mocks.readMfaFactors).toHaveBeenCalledOnce();
  });

  it('rejects any query string with 400 before the dependency', async () => {
    const { app, mocks } = createMfaApp();
    const response = await send(app, mfaRequest('GET', `${LIST}?factorId=x`));
    expect(response.status).toBe(400);
    expect(mocks.readMfaFactors).not.toHaveBeenCalled();
  });

  it('answers 401 reauthenticate without a session', async () => {
    const { app, mocks } = createMfaApp({
      resolveSession: async () => failure(401, 'UNAUTHENTICATED', 'no'),
    });
    const response = await send(app, mfaRequest('GET', LIST));
    expect(response.status).toBe(401);
    expect(mocks.readMfaFactors).not.toHaveBeenCalled();
  });

  it('rate limits per user at 300 per 60 s and stops with full 429 details', async () => {
    const { app, auth, mocks } = createMfaApp();
    Object.assign(auth, {
      rateLimit: async () =>
        success({
          allowed: false,
          limit: 300,
          remaining: 0,
          resetAt: 4_102_444_800,
        }),
    });
    const response = await send(app, mfaRequest('GET', LIST));
    expect(response.status).toBe(429);
    expect(response.headers.get('ratelimit-limit')).toBe('300');
    const body = (await response.json()) as { code: string; details: object };
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.details).toEqual({
      retryAfterSeconds: expect.any(Number),
      limit: 300,
      resetAt: 4_102_444_800,
    });
    expect(mocks.readMfaFactors).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when the dependency is absent', async () => {
    const { app } = createMfaApp({}, ['readMfaFactors']);
    const response = await send(app, mfaRequest('GET', LIST));
    expect(response.status).toBe(503);
  });

  it('answers 502 for an invalid projection', async () => {
    const { app } = createMfaApp({
      readMfaFactors: async () => success({} as never),
    });
    expect((await send(app, mfaRequest('GET', LIST))).status).toBe(502);
  });

  it('hands the dependency only the server-resolved session and request', async () => {
    const { app, mocks } = createMfaApp();
    await send(app, mfaRequest('GET', LIST));
    const input = (
      mocks.readMfaFactors.mock.calls as unknown as [Record<string, unknown>][]
    )[0]![0];
    expect(Object.keys(input).sort()).toEqual(['request', 'session']);
  });
});

describe('AUTH-API-17 TOTP enrollment start route', () => {
  const start = (
    app: ReturnType<typeof createMfaApp>['app'],
    options: Parameters<typeof mfaRequest>[2] = {},
  ) =>
    send(
      app,
      mfaRequest('POST', LIST, {
        body: ENROLL_BODY,
        ...options,
        headers: { 'if-match': '"3"', ...options.headers },
      }),
    );

  it('returns 201 with the one-time secret, ETag of the new version and no-store', async () => {
    const { app, mocks } = createMfaApp();
    const response = await start(app);
    expect(response.status).toBe(201);
    expect(response.headers.get('etag')).toBe('"5"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual(enrollmentBody);
    expect(mocks.startTotpEnrollment).toHaveBeenCalledWith(
      expect.objectContaining({
        friendlyName: 'Phone authenticator',
        ifMatch: '"3"',
      }),
      expect.anything(),
      expect.anything(),
    );
  });

  it.each([
    ['missing', null],
    ['weak', 'W/"3"'],
    ['unquoted', '3'],
    ['zero', '"0"'],
  ] as const)('requires a strong If-Match (%s) with 400', async (_n, value) => {
    const { app, mocks } = createMfaApp();
    const response = await start(app, { headers: { 'if-match': value } });
    expect(response.status).toBe(400);
    expect(mocks.startTotpEnrollment).not.toHaveBeenCalled();
  });

  it('needs no client Idempotency-Key', async () => {
    const { app } = createMfaApp();
    const response = await start(app, {
      headers: { 'if-match': '"3"', 'idempotency-key': null },
    });
    expect(response.status).toBe(201);
  });

  it('rejects a non-JSON body with 415 and an oversized body with 413', async () => {
    const { app } = createMfaApp();
    expect(
      (await start(app, { headers: { 'content-type': 'text/plain' } })).status,
    ).toBe(415);
    expect(
      (
        await start(app, {
          headers: { 'content-length': String(300 * 1024) },
        })
      ).status,
    ).toBe(413);
  });

  it.each<readonly [string, object]>([
    ['unknown key', { ...ENROLL_BODY, extra: 1 }],
    ['bad method', { ...ENROLL_BODY, method: 'sms' }],
    ['empty name', { method: 'totp', friendlyName: '   ' }],
    ['control character', { method: 'totp', friendlyName: 'a\nb' }],
    ['name over 80', { method: 'totp', friendlyName: 'x'.repeat(81) }],
  ])('answers 422 for %s', async (_n, body) => {
    const { app, mocks } = createMfaApp();
    const response = await start(app, { body });
    expect(response.status).toBe(422);
    expect(mocks.startTotpEnrollment).not.toHaveBeenCalled();
  });

  it('names the spec violation codes for method and friendlyName', async () => {
    const { app } = createMfaApp();
    const method = await start(app, {
      body: { ...ENROLL_BODY, method: 'sms' },
    });
    await expect(method.json()).resolves.toMatchObject({
      details: {
        violations: [{ path: '/method', code: 'method_not_available' }],
      },
    });
    const name = await start(app, {
      body: { method: 'totp', friendlyName: '' },
    });
    await expect(name.json()).resolves.toMatchObject({
      details: {
        violations: [{ path: '/friendlyName', code: 'friendly_name_invalid' }],
      },
    });
  });

  it('enforces origin and CSRF before the dependency', async () => {
    const { app, mocks } = createMfaApp();
    expect(
      (await start(app, { headers: { 'x-csrf-token': null } })).status,
    ).toBe(403);
    expect(
      (await start(app, { headers: { origin: 'https://evil.example' } }))
        .status,
    ).toBe(403);
    expect(mocks.startTotpEnrollment).not.toHaveBeenCalled();
  });

  it('applies the 5 per hour per user policy', async () => {
    const { app, auth } = createMfaApp();
    await start(app);
    expect(auth.rateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'AUTH-API-17',
        limit: 5,
        windowSeconds: 3600,
      }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('passes the exact STEP_UP_REQUIRED and reauthenticate bodies through unchanged', async () => {
    const stepUp = createMfaApp({
      startTotpEnrollment: async () => ({
        ok: false as const,
        status: 401 as const,
        code: 'STEP_UP_REQUIRED',
        message: 'Recent verification is required.',
        details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
      }),
    });
    const response = await start(stepUp.app);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: 'STEP_UP_REQUIRED',
      details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
    });
  });

  it('answers 502 for an invalid enrollment payload and 503 when absent', async () => {
    const bad = createMfaApp({
      startTotpEnrollment: async () => success({} as never),
    });
    expect((await start(bad.app)).status).toBe(502);
    const absent = createMfaApp({}, ['startTotpEnrollment']);
    expect((await start(absent.app)).status).toBe(503);
  });
});
