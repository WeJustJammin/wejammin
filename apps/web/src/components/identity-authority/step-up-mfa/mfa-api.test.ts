import { describe, expect, it } from 'vitest';

import {
  createStepUpChallenge,
  readMfaFactors,
  removeFactor,
  startTotpEnrollment,
  verifyEnrollment,
  verifyStepUp,
} from './mfa-api';
import {
  CHALLENGE_ID,
  CSRF,
  FACTOR_A,
  FACTOR_B,
  apiDeps,
  apiError,
  challenge,
  enrollment,
  factor,
  factorsResource,
  json,
  stepUpResult,
  stubFetch,
} from './step-up-mfa.test-support';

/** BE01a AUTH-API-16 to AUTH-API-21 as called from the browser (same-origin, CSRF, no tokens). */
describe('read factors (AUTH-API-16)', () => {
  it('GETs the same-origin collection without a body or mutation headers', async () => {
    const resource = factorsResource([factor(FACTOR_A)]);
    const fetchImpl = stubFetch(json(200, resource, { etag: '"4"' }));
    const outcome = await readMfaFactors(apiDeps(fetchImpl));
    expect(outcome).toEqual({ ok: true, data: resource, version: '4' });
    const [call] = fetchImpl.calls;
    expect(call?.url).toBe('/api/v1/account/mfa/factors');
    expect(call?.method).toBe('GET');
    expect(call?.body).toBeNull();
    expect(call?.headers.get('if-match')).toBeNull();
    expect(call?.headers.get('idempotency-key')).toBeNull();
  });

  it('uses same-origin credentials and bypasses caches', async () => {
    let init: RequestInit | undefined;
    const fetchImpl = ((
      _input: RequestInfo | URL,
      requestInit?: RequestInit,
    ) => {
      init = requestInit;
      return Promise.resolve(json(200, factorsResource([])));
    }) as typeof fetch;
    await readMfaFactors({ fetch: fetchImpl, csrfToken: () => CSRF });
    expect(init?.credentials).toBe('same-origin');
    expect(init?.cache).toBe('no-store');
  });

  it('rejects a response that fails the contract', async () => {
    const outcome = await readMfaFactors(
      apiDeps(stubFetch(json(200, { factors: 'nope' }))),
    );
    expect(outcome).toMatchObject({
      ok: false,
      failure: { code: 'INVALID_RESPONSE', status: 502 },
    });
  });
});

describe('start enrollment (AUTH-API-17)', () => {
  it('POSTs the strict body with the strong If-Match and CSRF and no client key', async () => {
    const fetchImpl = stubFetch(json(201, enrollment('5'), { etag: '"5"' }));
    const outcome = await startTotpEnrollment(
      { friendlyName: 'Laptop', version: '4' },
      apiDeps(fetchImpl),
    );
    expect(outcome).toMatchObject({ ok: true, version: '5' });
    const [call] = fetchImpl.calls;
    expect(call?.url).toBe('/api/v1/account/mfa/factors');
    expect(call?.method).toBe('POST');
    expect(call?.body).toEqual({ method: 'totp', friendlyName: 'Laptop' });
    expect(call?.headers.get('if-match')).toBe('"4"');
    expect(call?.headers.get('x-csrf-token')).toBe(CSRF);
    expect(call?.headers.get('content-type')).toBe('application/json');
    expect(call?.headers.get('idempotency-key')).toBeNull();
  });

  it('does not double-quote an ETag-shaped version', async () => {
    const fetchImpl = stubFetch(json(201, enrollment('5')));
    await startTotpEnrollment(
      { friendlyName: 'Laptop', version: '"4"' },
      apiDeps(fetchImpl),
    );
    expect(fetchImpl.calls[0]?.headers.get('if-match')).toBe('"4"');
  });

  it('turns a server refusal into a typed failure', async () => {
    const outcome = await startTotpEnrollment(
      { friendlyName: 'Laptop', version: '4' },
      apiDeps(
        stubFetch(
          apiError(401, 'UNAUTHENTICATED', {
            recoveryAction: 'reauthenticate',
          }),
        ),
      ),
    );
    expect(outcome).toMatchObject({
      ok: false,
      failure: {
        status: 401,
        code: 'UNAUTHENTICATED',
        recoveryAction: 'reauthenticate',
      },
    });
  });
});

describe('verify enrollment (AUTH-API-18)', () => {
  it('POSTs the six-digit code to the factor path with the returned version', async () => {
    const resource = factorsResource([factor(FACTOR_B)], '6', true);
    const fetchImpl = stubFetch(json(200, resource, { etag: '"6"' }));
    const outcome = await verifyEnrollment(
      { factorId: FACTOR_B, code: '123456', version: '5' },
      apiDeps(fetchImpl),
    );
    expect(outcome).toMatchObject({ ok: true, version: '6' });
    const [call] = fetchImpl.calls;
    expect(call?.url).toBe(`/api/v1/account/mfa/factors/${FACTOR_B}/verify`);
    expect(call?.body).toEqual({ code: '123456' });
    expect(call?.headers.get('if-match')).toBe('"5"');
    expect(call?.headers.get('x-csrf-token')).toBe(CSRF);
  });
});

describe('remove factor (AUTH-API-19)', () => {
  it('DELETEs with the reason body, a per-instance idempotency key and If-Match', async () => {
    const fetchImpl = stubFetch(
      json(200, factorsResource([], '7'), { etag: '"7"' }),
    );
    const outcome = await removeFactor(
      {
        factorId: FACTOR_A,
        reason: 'factor_compromise',
        version: '6',
        idempotencyKey: 'instance-key-0001',
      },
      apiDeps(fetchImpl),
    );
    expect(outcome).toMatchObject({ ok: true, version: '7' });
    const [call] = fetchImpl.calls;
    expect(call?.url).toBe(`/api/v1/account/mfa/factors/${FACTOR_A}`);
    expect(call?.method).toBe('DELETE');
    expect(call?.body).toEqual({ reason: 'factor_compromise' });
    expect(call?.headers.get('idempotency-key')).toBe('instance-key-0001');
    expect(call?.headers.get('if-match')).toBe('"6"');
    expect(call?.headers.get('x-csrf-token')).toBe(CSRF);
  });
});

describe('step-up challenge and verify (AUTH-API-20, AUTH-API-21)', () => {
  it('creates a challenge with only the method when no factor is chosen', async () => {
    const fetchImpl = stubFetch(json(201, challenge()));
    const outcome = await createStepUpChallenge({}, apiDeps(fetchImpl));
    expect(outcome).toMatchObject({
      ok: true,
      data: { challengeId: CHALLENGE_ID },
    });
    const [call] = fetchImpl.calls;
    expect(call?.url).toBe('/api/v1/auth/step-up/challenges');
    expect(call?.method).toBe('POST');
    expect(call?.body).toEqual({ method: 'totp' });
    expect(call?.headers.get('x-csrf-token')).toBe(CSRF);
    expect(call?.headers.get('if-match')).toBeNull();
    expect(call?.headers.get('idempotency-key')).toBeNull();
  });

  it('names the chosen factor', async () => {
    const fetchImpl = stubFetch(json(201, challenge(FACTOR_B)));
    await createStepUpChallenge({ factorId: FACTOR_B }, apiDeps(fetchImpl));
    expect(fetchImpl.calls[0]?.body).toEqual({
      method: 'totp',
      factorId: FACTOR_B,
    });
  });

  it('verifies a code against the challenge path and returns no token', async () => {
    const fetchImpl = stubFetch(json(200, stepUpResult));
    const outcome = await verifyStepUp(
      { challengeId: CHALLENGE_ID, code: '123456' },
      apiDeps(fetchImpl),
    );
    expect(outcome).toMatchObject({ ok: true, data: { verified: true } });
    const [call] = fetchImpl.calls;
    expect(call?.url).toBe(
      `/api/v1/auth/step-up/challenges/${CHALLENGE_ID}/verify`,
    );
    expect(call?.body).toEqual({ code: '123456' });
    expect(call?.headers.get('x-csrf-token')).toBe(CSRF);
  });

  it('reports a network error as a failure without a status', async () => {
    const outcome = await verifyStepUp(
      { challengeId: CHALLENGE_ID, code: '123456' },
      apiDeps(stubFetch(new Error('offline'))),
    );
    expect(outcome).toMatchObject({
      ok: false,
      failure: { status: 0, code: 'NETWORK_ERROR' },
    });
  });

  it('rejects a path id that is not a UUID before any request', async () => {
    const fetchImpl = stubFetch();
    const outcome = await verifyStepUp(
      { challengeId: '../admin', code: '123456' },
      apiDeps(fetchImpl),
    );
    expect(outcome).toMatchObject({
      ok: false,
      failure: { code: 'INVALID_REQUEST' },
    });
    expect(fetchImpl.calls).toHaveLength(0);
  });
});
