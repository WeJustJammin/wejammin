import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PARTY_ID,
  REQUEST_ID,
  TARGET_ID,
  adminError,
  bindings,
  contextFor,
  expectApiError,
} from './phase-02-slice-08-worker.test-support';
import {
  makeResetHarness,
  resetBody,
  resetRequest,
  resetResponse,
  stepUpAgo,
} from './admin-mfa-reset.test-support';

afterEach(() => {
  vi.useRealTimers();
});

const send = (
  harness: ReturnType<typeof makeResetHarness>,
  request: Request = resetRequest(),
) => harness.app.fetch(request, bindings);

describe('CFG-05B-06 admin MFA factor reset route', () => {
  it('forwards only the validated target and reason, with server-derived authority', async () => {
    const harness = makeResetHarness();
    const response = await send(harness);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(resetResponse());
    expect(harness.port).toHaveBeenCalledTimes(1);
    const input = harness.port.mock.calls[0]?.[0];
    expect(input).toMatchObject({
      body: resetBody,
      idempotencyKey: 'mfa-reset-0123456789',
      session: { authUserId: harness.session.authUserId },
      requestContext: { actingPartyId: PARTY_ID },
    });
    expect(Object.keys(input?.body ?? {}).sort()).toEqual([
      'reason',
      'targetPersonId',
    ]);
  });

  it('answers 202 while any provider removal is still reconciling', async () => {
    const harness = makeResetHarness({
      port: async () => ({
        ok: true,
        value: resetResponse({ state: 'reconciling', removedFactorCount: 1 }),
      }),
    });
    const response = await send(harness);
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ state: 'reconciling' });
  });

  it('is 401 UNAUTHENTICATED without a session credential', async () => {
    const harness = makeResetHarness();
    const response = await send(
      harness,
      resetRequest(resetBody, { authorization: undefined }),
    );
    await expectApiError(response, 401, 'UNAUTHENTICATED');
    expect(harness.port).not.toHaveBeenCalled();
  });

  it('is 403 without the named capability, and that beats a stale step-up', async () => {
    const harness = makeResetHarness({
      context: contextFor(['admin.inbox.read']),
      session: stepUpAgo(9_999),
    });
    await expectApiError(await send(harness), 403, 'FORBIDDEN');
    expect(harness.port).not.toHaveBeenCalled();
  });

  it.each([
    ['absent', null],
    ['older than 600 s', 601],
    ['future-dated beyond 30 s', -31],
  ])('is 401 STEP_UP_REQUIRED when the proof is %s', async (_label, age) => {
    const base = stepUpAgo(0);
    const harness = makeResetHarness({
      session: age === null ? { ...base, stepUpAt: null } : stepUpAgo(age),
    });
    const body = await expectApiError(
      await send(harness),
      401,
      'STEP_UP_REQUIRED',
    );
    expect(body.details).toEqual({
      recoveryAction: 'step_up',
      allowedMethods: ['totp'],
    });
    expect(harness.port).not.toHaveBeenCalled();
    expect(harness.auth.rateLimit).not.toHaveBeenCalled();
  });

  it.each([599, 0, -29])('accepts a proof %s seconds old', async (age) => {
    const harness = makeResetHarness({ session: stepUpAgo(age) });
    expect((await send(harness)).status).toBe(200);
  });

  it('is 422 MFA_RESET_INVALID when the operator targets themselves', async () => {
    const harness = makeResetHarness();
    const response = await send(
      harness,
      resetRequest({ ...resetBody, targetPersonId: harness.session.personId }),
    );
    await expectApiError(response, 422, 'MFA_RESET_INVALID');
    expect(harness.port).not.toHaveBeenCalled();
  });

  it.each([
    ['an operator key', { ...resetBody, operatorPersonId: TARGET_ID }],
    ['an organization key', { ...resetBody, organizationId: PARTY_ID }],
    ['a factor list', { ...resetBody, factorIds: [TARGET_ID] }],
    ['a target list', { ...resetBody, targetPersonId: [TARGET_ID] }],
    ['a malformed target', { ...resetBody, targetPersonId: 'someone' }],
    ['no reason', { targetPersonId: TARGET_ID }],
    ['a blank reason', { ...resetBody, reason: '  ' }],
    ['an oversized reason', { ...resetBody, reason: 'r'.repeat(513) }],
  ])('is 400 INVALID_REQUEST for %s', async (_label, body) => {
    const harness = makeResetHarness();
    await expectApiError(
      await send(harness, resetRequest(body)),
      400,
      'INVALID_REQUEST',
    );
    expect(harness.port).not.toHaveBeenCalled();
  });

  it('requires an Idempotency-Key header', async () => {
    const harness = makeResetHarness();
    const response = await send(
      harness,
      resetRequest(resetBody, { 'idempotency-key': undefined }),
    );
    await expectApiError(response, 400, 'INVALID_REQUEST');
    expect(harness.port).not.toHaveBeenCalled();
  });

  it('rejects a foreign origin and a cookie session without CSRF', async () => {
    const foreign = makeResetHarness();
    expect(
      (
        await send(
          foreign,
          resetRequest(resetBody, { origin: 'https://evil.example' }),
        )
      ).status,
    ).toBe(403);
    const cookie = makeResetHarness();
    const response = await send(
      cookie,
      resetRequest(resetBody, {
        authorization: undefined,
        cookie: 'wj_session_ref=sealed-reference',
      }),
    );
    expect(response.status).toBe(403);
    expect(foreign.port).not.toHaveBeenCalled();
    expect(cookie.port).not.toHaveBeenCalled();
  });

  it('charges 5 per hour per user and 10 per hour per party', async () => {
    const harness = makeResetHarness();
    await send(harness);
    const [user, party] = harness.auth.rateLimit.mock.calls.map(
      ([input]) => input,
    );
    expect(user).toMatchObject({
      operationId: 'CFG-05B-06',
      authUserId: harness.session.authUserId,
      actingPartyId: PARTY_ID,
      limit: 5,
      windowSeconds: 3600,
    });
    expect(party).toMatchObject({
      operationId: 'CFG-05B-06',
      authUserId: null,
      actingPartyId: PARTY_ID,
      limit: 10,
      windowSeconds: 3600,
    });
  });

  it.each([
    ['user', 0],
    ['party', 1],
  ])('is 429 when the %s bucket is exhausted', async (_label, index) => {
    const denied = {
      ok: true as const,
      value: {
        allowed: false,
        limit: 5,
        remaining: 0,
        resetAt: Math.floor(Date.now() / 1000) + 120,
      },
    };
    const allow = {
      ok: true as const,
      value: {
        allowed: true,
        limit: 5,
        remaining: 4,
        resetAt: Math.floor(Date.now() / 1000) + 120,
      },
    };
    const harness = makeResetHarness({
      rateLimits: index === 0 ? [denied] : [allow, denied],
    });
    const response = await send(harness);
    await expectApiError(response, 429, 'RATE_LIMITED');
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(harness.port).not.toHaveBeenCalled();
  });

  it('passes a limiter refusal through before the port', async () => {
    const harness = makeResetHarness({
      rateLimits: [adminError(502, 'DEPENDENCY_INVALID_RESPONSE', 'Invalid.')],
    });
    await expectApiError(
      await send(harness),
      502,
      'DEPENDENCY_INVALID_RESPONSE',
    );
    expect(harness.port).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when the rate limiter throws', async () => {
    const harness = makeResetHarness();
    harness.auth.rateLimit.mockRejectedValueOnce(new Error('down'));
    await expectApiError(await send(harness), 503, 'DEPENDENCY_UNAVAILABLE');
    expect(harness.port).not.toHaveBeenCalled();
  });

  it.each([
    [404, 'TARGET_NOT_FOUND'],
    [409, 'MFA_RESET_IN_PROGRESS'],
    [409, 'IDEMPOTENCY_CONFLICT'],
    [503, 'IDENTITY_UNAVAILABLE'],
  ])('passes the %s %s outcome through', async (status, code) => {
    const harness = makeResetHarness({
      port: async () =>
        adminError(status as 404 | 409 | 503, code, 'The request failed.'),
    });
    await expectApiError(await send(harness), status, code);
  });

  it('is 502 when the port response is not the strict contract', async () => {
    const harness = makeResetHarness({
      port: async () => ({
        ok: true,
        value: resetResponse({ providerFactorIds: [TARGET_ID] }),
      }),
    });
    const body = await expectApiError(
      await send(harness),
      502,
      'UPSTREAM_FAILURE',
    );
    expect(JSON.stringify(body)).not.toContain(TARGET_ID);
  });

  it('fails closed with 503 when the recovery port is not composed', async () => {
    const harness = makeResetHarness({ port: null });
    await expectApiError(await send(harness), 503, 'DEPENDENCY_UNAVAILABLE');
  });

  it('answers 504 after the 15 second deadline', async () => {
    vi.useFakeTimers();
    const harness = makeResetHarness({
      port: () => new Promise(() => undefined),
    });
    const pending = send(harness);
    await vi.advanceTimersByTimeAsync(15_001);
    await expectApiError(await pending, 504, 'UPSTREAM_TIMEOUT');
  });

  it('logs one hashed security event without ids, reason or factor data', async () => {
    const harness = makeResetHarness();
    await send(harness);
    const events = harness.lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((event) => event.eventName === 'admin.mfa-factor.reset');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      operation: 'CFG-05B-06',
      outcome: 'success',
      requestId: REQUEST_ID,
    });
    const text = harness.lines.join('\n');
    expect(text).not.toContain(resetBody.reason);
    expect(text).not.toContain(TARGET_ID);
    expect(text).not.toContain(harness.session.authUserId);
  });

  it('does not log the success event for a rejected request', async () => {
    const harness = makeResetHarness({ context: contextFor([]) });
    await send(harness);
    const success = harness.lines.filter((line) =>
      line.includes('"outcome":"success"'),
    );
    expect(success).toEqual([]);
  });
});
