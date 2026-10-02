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
  REQUEST_ID,
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

const build = (userId = AUTH_USER_ID) => {
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
    randomBytes: (length: number) => new Uint8Array(length).fill(7),
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

  it('touches the index row and replaces all four cookies when the session id is unchanged', async () => {
    const { result, calls } = validate({});
    const validated = await result;
    if (!validated.ok) throw new Error('expected validation to pass');
    const committed = await validated.value.commit(signal);
    expect(committed).toMatchObject({ ok: true });
    if (!committed.ok) throw new Error('expected commit to pass');
    const rpc = rpcCalls(calls);
    expect(rpc).toHaveLength(1);
    expect(rpc[0]?.url).toMatch(/rpc\/auth_session_register$/u);
    expect(rpc[0]?.body).toMatchObject({
      p_auth_user_id: AUTH_USER_ID,
      p_session_id: SESSION_ID,
      p_request_id: REQUEST_ID,
    });
    const names = committed.value.cookies.map((cookie) => cookie.split('=')[0]);
    expect(names).toEqual(
      expect.arrayContaining(['wj_access', 'wj_refresh', 'wj_session_ref']),
    );
    expect(names.some((name) => name?.includes('csrf'))).toBe(true);
    expect(committed.value.cookies.every((c) => c.includes('Secure'))).toBe(
      true,
    );
  });

  it('registers the new session and revokes the initiating one in one RPC when the id changes', async () => {
    const { result, calls } = validate({ session_id: NEW_SESSION_ID });
    const validated = await result;
    if (!validated.ok) throw new Error('expected validation to pass');
    const committed = await validated.value.commit(signal);
    expect(committed).toMatchObject({ ok: true });
    const rpc = rpcCalls(calls);
    expect(rpc).toHaveLength(1);
    expect(rpc[0]?.url).toMatch(/rpc\/auth_session_rotate$/u);
    expect(rpc[0]?.body).toMatchObject({
      p_auth_user_id: AUTH_USER_ID,
      p_previous_session_id: SESSION_ID,
      p_session_id: NEW_SESSION_ID,
    });
  });

  it('returns no cookies when the local transaction fails', async () => {
    const harness = build();
    const failing = normalizeAuthProductionOptions({
      environment,
      fetchImpl: (async (url: string) =>
        url.includes('/auth/v1/user')
          ? json({ id: AUTH_USER_ID })
          : json({ message: 'down' }, 500)) as unknown as typeof fetch,
      now: () => NOW,
    });
    const rotation = createSessionRotation(failing);
    const validated = await rotation.validate(
      {
        session: sessionFor(),
        request: requestFor(),
        payload: payloadFor(),
      },
      signal,
    );
    if (!validated.ok) throw new Error('expected validation to pass');
    expect(await validated.value.commit(signal)).toMatchObject({
      ok: false,
      status: 503,
    });
    expect(harness.calls).toEqual([]);
  });
});
