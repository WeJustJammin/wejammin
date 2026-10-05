import { describe, expect, it, vi } from 'vitest';

import type { WorkerBindings } from '../index';
import {
  base64UrlEncode,
  normalizeAuthProductionOptions,
} from './production-support';
import { createSessionRotation } from './production-session-rotation';
import {
  AUTH_USER_ID,
  NEW_SESSION_ID,
  NOW,
  PERSON_ID,
  SESSION_ID,
  requestFor,
  sessionFor,
} from './mfa-test-support';

const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'dec-111-test',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://staging.example.supabase.co',
};

const OTHER_USER_ID = '99999999-9999-4999-8999-999999999999';
const second = (offset: number): number => Math.floor(NOW / 1000) + offset;

const encode = (value: unknown): string =>
  base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));

const jwt = (claims: Readonly<Record<string, unknown>> = {}): string =>
  `${encode({ alg: 'RS256' })}.${encode({
    sub: AUTH_USER_ID,
    session_id: SESSION_ID,
    iss: `${environment.SUPABASE_URL}/auth/v1`,
    aud: 'authenticated',
    exp: second(3600),
    aal: 'aal2',
    amr: [{ method: 'totp', timestamp: second(-5) }],
    ...claims,
  })}.signature`;

const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const fixedRandomBytes = (length: number): Uint8Array =>
  new Uint8Array(length).fill(7);

const build = (
  userId = AUTH_USER_ID,
  randomBytes: (length: number) => Uint8Array = fixedRandomBytes,
) => {
  const calls: Array<Readonly<{ url: string; body: unknown }>> = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      body: init?.body === undefined ? null : JSON.parse(String(init.body)),
    });
    return url.includes('/auth/v1/user') ? json({ id: userId }) : json({});
  });
  const config = normalizeAuthProductionOptions({
    environment,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    now: () => NOW,
    randomBytes,
  });
  return { calls, rotation: createSessionRotation(config) };
};

const signal = new AbortController().signal;
const payloadFor = (claims: Readonly<Record<string, unknown>> = {}) => ({
  access_token: jwt(claims),
  refresh_token: 'rotated-refresh-token',
});
const rpcCalls = (calls: ReturnType<typeof build>['calls']) =>
  calls.filter((call) => call.url.includes('/rest/v1/rpc/'));

const validate = (
  claims: Readonly<Record<string, unknown>>,
  userId = AUTH_USER_ID,
) => {
  const harness = build(userId);
  return {
    ...harness,
    result: harness.rotation.validate(
      {
        session: sessionFor({ personId: PERSON_ID }),
        request: requestFor(),
        payload: payloadFor(claims),
      },
      signal,
    ),
  };
};

describe('step-up session rotation', () => {
  it('validates an aal2 token for the initiating user and exposes only the proof times', async () => {
    const { result, calls } = validate({});
    const outcome = await result;
    expect(outcome).toMatchObject({
      ok: true,
      value: {
        stepUpAt: new Date(second(-5) * 1000).toISOString(),
        freshUntil: new Date(second(595) * 1000).toISOString(),
      },
    });
    expect(rpcCalls(calls)).toEqual([]);
  });

  it.each([
    ['a token for another user', { sub: OTHER_USER_ID }, OTHER_USER_ID],
    ['an aal1 token', { aal: 'aal1' }, AUTH_USER_ID],
    ['a token without an MFA amr entry', { amr: [] }, AUTH_USER_ID],
    [
      'a stale MFA proof',
      { amr: [{ method: 'totp', timestamp: second(-601) }] },
      AUTH_USER_ID,
    ],
    ['a missing aal claim', { aal: undefined }, AUTH_USER_ID],
  ])('returns 502 and changes nothing for %s', async (_label, claims, user) => {
    const { result, calls } = validate(claims, user);
    expect(await result).toMatchObject({
      ok: false,
      status: 502,
      code: 'PROVIDER_INVALID_RESPONSE',
    });
    expect(rpcCalls(calls)).toEqual([]);
  });

  it('maps a failure while sealing the replacement cookies to 503', async () => {
    const harness = build(AUTH_USER_ID, () => {
      throw new Error('entropy unavailable');
    });
    const outcome = await harness.rotation.validate(
      {
        session: sessionFor({ personId: PERSON_ID }),
        request: requestFor(),
        payload: payloadFor(),
      },
      signal,
    );
    expect(outcome).toMatchObject({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('rejects a payload that is not a verifiable provider session', async () => {
    const harness = build();
    const outcome = await harness.rotation.validate(
      {
        session: sessionFor(),
        request: requestFor(),
        payload: { access_token: 7 },
      },
      signal,
    );
    expect(outcome).toMatchObject({ ok: false, status: 502 });
  });

  it('seals all four replacement cookies and makes no RPC call itself', async () => {
    const { result, calls } = validate({});
    const validated = await result;
    if (!validated.ok) throw new Error('expected validation to pass');
    expect(rpcCalls(calls)).toEqual([]);
    const { cookies } = validated.value;
    const names = cookies.map((cookie) => cookie.split('=')[0]);
    expect(names).toEqual(
      expect.arrayContaining(['wj_access', 'wj_refresh', 'wj_session_ref']),
    );
    expect(names.some((name) => name?.includes('csrf'))).toBe(true);
    expect(cookies.every((c) => c.includes('Secure'))).toBe(true);
  });

  it('exposes the unchanged session id as the rotation target for a same-session token', async () => {
    const { result } = validate({});
    const validated = await result;
    if (!validated.ok) throw new Error('expected validation to pass');
    expect(validated.value.rotation).toEqual({
      sessionId: SESSION_ID,
      issuedAt: new Date(NOW).toISOString(),
    });
  });

  it('exposes the replacement session id as the rotation target when the id changes', async () => {
    const { result, calls } = validate({ session_id: NEW_SESSION_ID });
    const validated = await result;
    if (!validated.ok) throw new Error('expected validation to pass');
    expect(validated.value.rotation.sessionId).toBe(NEW_SESSION_ID);
    expect(rpcCalls(calls)).toEqual([]);
  });
});
