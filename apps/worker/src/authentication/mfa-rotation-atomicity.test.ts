import { describe, expect, it, vi } from 'vitest';

import type { WorkerBindings } from '../index';
import { createMfaService } from './mfa-service';
import { createMfaPersistence } from './production-mfa-persistence';
import { createSessionRotation } from './production-session-rotation';
import {
  base64UrlEncode,
  normalizeAuthProductionOptions,
} from './production-support';
import {
  AUTH_USER_ID,
  CHALLENGE_ID,
  env,
  FACTOR_ID,
  fakeProvider,
  iso,
  NEW_SESSION_ID,
  NOW,
  OTHER_FACTOR_ID,
  PROVIDER_CHALLENGE_ID,
  PROVIDER_FACTOR_ID,
  requestFor,
  SESSION_ID,
  sessionFor,
  signal,
} from './mfa-test-support';

/**
 * DEC-111 atomicity: these tests compose the REAL service, the REAL
 * persistence adapter and the REAL rotation adapter over a stateful fake of
 * the protected `platform_api` database. The fake models the contract the DB
 * must honour: a settle RPC that carries the rotation (`p_new_session_id`)
 * commits settlement and session rotation in ONE transaction, so a rotation
 * failure rolls the settlement back.
 */
const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'dec-111-test',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://staging.example.supabase.co',
};

const second = (offset: number): number => Math.floor(NOW / 1000) + offset;
const encode = (value: unknown): string =>
  base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
const providerSession = (): unknown => ({
  access_token: `${encode({ alg: 'RS256' })}.${encode({
    sub: AUTH_USER_ID,
    session_id: NEW_SESSION_ID,
    iss: `${environment.SUPABASE_URL}/auth/v1`,
    aud: 'authenticated',
    exp: second(3600),
    aal: 'aal2',
    amr: [{ method: 'totp', timestamp: second(-5) }],
  })}.signature`,
  refresh_token: 'rotated-refresh-token',
});

const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

type FakeDatabase = {
  challenge: 'pending' | 'consumed' | 'failed';
  factor: 'pending' | 'verified' | 'reconciling';
  activeSessions: Set<string>;
  rotationWriteFails: boolean;
  rpcs: string[];
};

const ROTATION_RPCS = ['auth_session_register', 'auth_session_rotate'];

const rotate = (db: FakeDatabase, body: Record<string, unknown>): void => {
  if (db.rotationWriteFails) throw new Error('rotation write failed');
  const next = String(body.p_new_session_id ?? body.p_session_id);
  const previous = String(body.p_previous_session_id ?? body.p_session_id);
  if (next !== previous) db.activeSessions.delete(previous);
  db.activeSessions.add(next);
};

const handleRpc = (
  db: FakeDatabase,
  name: string,
  body: Record<string, unknown>,
): Response => {
  db.rpcs.push(name);
  try {
    if (ROTATION_RPCS.includes(name)) {
      rotate(db, body);
      return json({});
    }
    if (name === 'auth_step_up_challenge_verify_prepare')
      return json({
        factorId: FACTOR_ID,
        providerFactorId: PROVIDER_FACTOR_ID,
        providerChallengeId: PROVIDER_CHALLENGE_ID,
        expiresAt: iso(300),
      });
    if (name === 'auth_step_up_challenge_verify_settle') {
      // Single transaction: a rotation failure rolls the consume back.
      if (body.p_new_session_id !== undefined) rotate(db, body);
      db.challenge = 'consumed';
      return json({});
    }
    if (name === 'auth_mfa_enrollment_verify_prepare')
      return json({ providerFactorId: PROVIDER_FACTOR_ID });
    if (name === 'auth_mfa_enrollment_verify_settle') {
      if (body.p_new_session_id !== undefined) rotate(db, body);
      db.factor = 'verified';
      return json({
        factors: [
          {
            id: OTHER_FACTOR_ID,
            method: 'totp',
            friendlyName: 'Spare authenticator',
            state: 'verified',
            verifiedAt: iso(0),
            lastUsedAt: null,
            pendingExpiresAt: null,
          },
        ],
        version: '6',
      });
    }
    if (name === 'auth_mfa_factor_mark_reconciling') {
      db.factor = 'reconciling';
      return json({});
    }
    return json({ message: `unexpected ${name}` }, 500);
  } catch {
    return json({ message: 'down' }, 500);
  }
};

const harness = (rotationWriteFails: boolean) => {
  const db: FakeDatabase = {
    challenge: 'pending',
    factor: 'pending',
    activeSessions: new Set([SESSION_ID]),
    rotationWriteFails,
    rpcs: [],
  };
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('/auth/v1/user')) return json({ id: AUTH_USER_ID });
    const name = url.split('/rpc/')[1] ?? '';
    return handleRpc(
      db,
      name,
      init?.body === undefined ? {} : JSON.parse(String(init.body)),
    );
  });
  const config = normalizeAuthProductionOptions({
    environment,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    now: () => NOW,
    randomBytes: (length: number) => new Uint8Array(length).fill(7),
  });
  const provider = fakeProvider({
    verify: async () => ({ ok: true, value: providerSession() }),
  });
  const service = createMfaService({
    persistence: createMfaPersistence(config),
    provider,
    rotation: createSessionRotation(config),
    now: () => NOW,
  });
  return { db, service };
};

const stepUpInput = () => ({
  session: sessionFor({ stepUpAt: null }),
  request: requestFor(),
  challengeId: CHALLENGE_ID,
  code: '123456',
});

const enrollInput = () => ({
  session: sessionFor(),
  request: requestFor(),
  factorId: OTHER_FACTOR_ID,
  code: '123456',
  ifMatch: '"5"',
});

describe('aal2 rotation is atomic with settlement (real adapters)', () => {
  it('step-up: a rotation failure leaves the challenge pending, the old session active and no cookies', async () => {
    const { db, service } = harness(true);
    const result = await service.verifyStepUpChallenge(
      stepUpInput(),
      env,
      signal,
    );
    expect(result).toMatchObject({ ok: false });
    expect(JSON.stringify(result)).not.toContain('wj_access');
    expect(db.challenge).toBe('pending');
    expect([...db.activeSessions]).toEqual([SESSION_ID]);
  });

  it('step-up: success consumes the challenge and rotates in the single settle transaction', async () => {
    const { db, service } = harness(false);
    const result = await service.verifyStepUpChallenge(
      stepUpInput(),
      env,
      signal,
    );
    expect(result).toMatchObject({
      ok: true,
      value: { resource: { verified: true, method: 'totp' } },
    });
    if (!result.ok) throw new Error('expected success');
    expect(result.value.cookies.some((c) => c.startsWith('wj_access='))).toBe(
      true,
    );
    expect(db.challenge).toBe('consumed');
    expect([...db.activeSessions]).toEqual([NEW_SESSION_ID]);
    expect(db.rpcs.filter((rpc) => ROTATION_RPCS.includes(rpc))).toEqual([]);
    expect(
      db.rpcs.filter((rpc) => rpc === 'auth_step_up_challenge_verify_settle'),
    ).toHaveLength(1);
  });

  it('enrollment: a rotation failure never leaves a verified factor behind an aal1 session', async () => {
    const { db, service } = harness(true);
    const result = await service.verifyTotpEnrollment(
      enrollInput(),
      env,
      signal,
    );
    expect(result).toMatchObject({ ok: false });
    expect(db.factor).not.toBe('verified');
    expect([...db.activeSessions]).toEqual([SESSION_ID]);
  });

  it('enrollment: success verifies the factor and rotates in the single settle transaction', async () => {
    const { db, service } = harness(false);
    const result = await service.verifyTotpEnrollment(
      enrollInput(),
      env,
      signal,
    );
    expect(result).toMatchObject({ ok: true });
    expect(db.factor).toBe('verified');
    expect([...db.activeSessions]).toEqual([NEW_SESSION_ID]);
    expect(db.rpcs.filter((rpc) => ROTATION_RPCS.includes(rpc))).toEqual([]);
  });

  it('a same-session aal2 token settles with the unchanged session id', async () => {
    const { db, service } = harness(false);
    const sameSession = {
      ...stepUpInput(),
      session: sessionFor({ stepUpAt: null, sessionId: NEW_SESSION_ID }),
    };
    const result = await service.verifyStepUpChallenge(
      sameSession,
      env,
      signal,
    );
    expect(result).toMatchObject({ ok: true });
    expect(db.challenge).toBe('consumed');
  });

  it('maps a failed settle transaction to a 503 without cookies', async () => {
    const { service } = harness(true);
    const result = await service.verifyStepUpChallenge(
      stepUpInput(),
      env,
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 503 });
  });
});
