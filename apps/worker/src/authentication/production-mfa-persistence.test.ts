import { describe, expect, it, vi } from 'vitest';

import type { WorkerBindings } from '../index';
import { normalizeAuthProductionOptions } from './production-support';
import {
  createMfaPersistence,
  MFA_PERSISTENCE_RPC,
} from './production-mfa-persistence';
import {
  AUTH_USER_ID,
  CHALLENGE_ID,
  FACTOR_ID,
  NEW_SESSION_ID,
  NOW,
  OTHER_FACTOR_ID,
  PROVIDER_CHALLENGE_ID,
  PROVIDER_FACTOR_ID,
  REQUEST_ID,
  SESSION_ID,
  iso,
  requestFor,
  verifiedRow,
} from './mfa-test-support';

const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'dec-111-test',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://staging.example.supabase.co',
};

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const build = (reply: () => Response) => {
  const fetchImpl = vi.fn<Fetch>(async () => reply());
  const config = normalizeAuthProductionOptions({
    environment,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    now: () => NOW,
  });
  return { fetchImpl, port: createMfaPersistence(config) };
};

const signal = new AbortController().signal;
const caller = { authUserId: AUTH_USER_ID, request: requestFor() };
const ROTATION = { sessionId: NEW_SESSION_ID, issuedAt: iso(0) };
const snapshot = { factors: [verifiedRow()], version: '3' };

type Call = Readonly<{
  label: string;
  rpc: string;
  invoke: (port: ReturnType<typeof createMfaPersistence>) => Promise<unknown>;
  reply: unknown;
  expected: unknown;
  params: Readonly<Record<string, unknown>>;
}>;

const calls: readonly Call[] = [
  {
    label: 'readFactors',
    rpc: 'auth_mfa_factors_read',
    invoke: (port) => port.readFactors(caller, signal),
    reply: snapshot,
    expected: snapshot,
    params: {},
  },
  {
    label: 'beginEnrollment',
    rpc: 'auth_mfa_enrollment_begin',
    invoke: (port) =>
      port.beginEnrollment(
        { ...caller, friendlyName: 'Phone', expectedVersion: '3' },
        signal,
      ),
    reply: { supersededProviderFactorId: PROVIDER_FACTOR_ID, version: '4' },
    expected: { supersededProviderFactorId: PROVIDER_FACTOR_ID, version: '4' },
    params: { p_friendly_name: 'Phone', p_expected_version: '3' },
  },
  {
    label: 'finishEnrollment',
    rpc: 'auth_mfa_enrollment_finish',
    invoke: (port) =>
      port.finishEnrollment(
        {
          ...caller,
          providerFactorId: PROVIDER_FACTOR_ID,
          friendlyName: 'Phone',
          expectedVersion: '4',
          sessionId: SESSION_ID,
        },
        signal,
      ),
    reply: { factorId: OTHER_FACTOR_ID, expiresAt: iso(600), version: '5' },
    expected: { factorId: OTHER_FACTOR_ID, expiresAt: iso(600), version: '5' },
    params: {
      p_provider_factor_id: PROVIDER_FACTOR_ID,
      p_friendly_name: 'Phone',
      p_expected_version: '4',
      p_session_id: SESSION_ID,
    },
  },
  {
    label: 'prepareEnrollmentVerify',
    rpc: 'auth_mfa_enrollment_verify_prepare',
    invoke: (port) =>
      port.prepareEnrollmentVerify(
        { ...caller, factorId: FACTOR_ID, expectedVersion: '5' },
        signal,
      ),
    reply: { providerFactorId: PROVIDER_FACTOR_ID },
    expected: { providerFactorId: PROVIDER_FACTOR_ID },
    params: { p_factor_id: FACTOR_ID, p_expected_version: '5' },
  },
  {
    label: 'settleEnrollmentVerify',
    rpc: 'auth_mfa_enrollment_verify_settle',
    invoke: (port) =>
      port.settleEnrollmentVerify(
        {
          ...caller,
          factorId: FACTOR_ID,
          expectedVersion: '5',
          sessionId: SESSION_ID,
          rotation: ROTATION,
        },
        signal,
      ),
    reply: snapshot,
    expected: snapshot,
    params: {
      p_factor_id: FACTOR_ID,
      p_expected_version: '5',
      p_session_id: SESSION_ID,
      p_new_session_id: NEW_SESSION_ID,
      p_issued_at: iso(0),
    },
  },
  {
    label: 'markFactorReconciling',
    rpc: 'auth_mfa_factor_mark_reconciling',
    invoke: (port) =>
      port.markFactorReconciling({ ...caller, factorId: FACTOR_ID }, signal),
    reply: {},
    expected: null,
    params: { p_factor_id: FACTOR_ID },
  },
  {
    label: 'beginRemoval',
    rpc: 'auth_mfa_removal_begin',
    invoke: (port) =>
      port.beginRemoval(
        {
          ...caller,
          factorId: FACTOR_ID,
          reason: 'user_request',
          expectedVersion: '3',
          idempotencyKey: 'removal-key-0001',
          sessionId: SESSION_ID,
        },
        signal,
      ),
    reply: { providerFactorId: PROVIDER_FACTOR_ID, replay: null },
    expected: { providerFactorId: PROVIDER_FACTOR_ID, replay: null },
    params: {
      p_factor_id: FACTOR_ID,
      p_reason: 'user_request',
      p_expected_version: '3',
      p_session_id: SESSION_ID,
    },
  },
  {
    label: 'finishRemoval',
    rpc: 'auth_mfa_removal_finish',
    invoke: (port) =>
      port.finishRemoval(
        {
          ...caller,
          factorId: FACTOR_ID,
          reason: 'factor_compromise',
          idempotencyKey: 'removal-key-0001',
          sessionId: SESSION_ID,
        },
        signal,
      ),
    reply: snapshot,
    expected: snapshot,
    params: {
      p_factor_id: FACTOR_ID,
      p_reason: 'factor_compromise',
      p_session_id: SESSION_ID,
    },
  },
  {
    label: 'beginChallenge',
    rpc: 'auth_step_up_challenge_begin',
    invoke: (port) =>
      port.beginChallenge(
        { ...caller, sessionId: SESSION_ID, method: 'totp', factorId: null },
        signal,
      ),
    reply: {
      factorId: FACTOR_ID,
      providerFactorId: PROVIDER_FACTOR_ID,
      friendlyName: 'Phone',
    },
    expected: {
      factorId: FACTOR_ID,
      providerFactorId: PROVIDER_FACTOR_ID,
      friendlyName: 'Phone',
    },
    params: { p_session_id: SESSION_ID, p_method: 'totp', p_factor_id: null },
  },
  {
    label: 'finishChallenge',
    rpc: 'auth_step_up_challenge_finish',
    invoke: (port) =>
      port.finishChallenge(
        {
          ...caller,
          sessionId: SESSION_ID,
          factorId: FACTOR_ID,
          providerChallengeId: PROVIDER_CHALLENGE_ID,
          expiresAt: iso(300),
        },
        signal,
      ),
    reply: { challengeId: CHALLENGE_ID, expiresAt: iso(300) },
    expected: { challengeId: CHALLENGE_ID, expiresAt: iso(300) },
    params: {
      p_session_id: SESSION_ID,
      p_factor_id: FACTOR_ID,
      p_provider_challenge_id: PROVIDER_CHALLENGE_ID,
      p_expires_at: iso(300),
    },
  },
  {
    label: 'prepareChallengeVerify',
    rpc: 'auth_step_up_challenge_verify_prepare',
    invoke: (port) =>
      port.prepareChallengeVerify(
        { ...caller, sessionId: SESSION_ID, challengeId: CHALLENGE_ID },
        signal,
      ),
    reply: {
      factorId: FACTOR_ID,
      providerFactorId: PROVIDER_FACTOR_ID,
      providerChallengeId: PROVIDER_CHALLENGE_ID,
      expiresAt: iso(300),
    },
    expected: {
      factorId: FACTOR_ID,
      providerFactorId: PROVIDER_FACTOR_ID,
      providerChallengeId: PROVIDER_CHALLENGE_ID,
      expiresAt: iso(300),
    },
    params: { p_session_id: SESSION_ID, p_challenge_id: CHALLENGE_ID },
  },
  {
    label: 'recordChallengeFailure',
    rpc: 'auth_step_up_challenge_failure_record',
    invoke: (port) =>
      port.recordChallengeFailure(
        {
          ...caller,
          sessionId: SESSION_ID,
          challengeId: CHALLENGE_ID,
          outcome: 'ambiguous',
        },
        signal,
      ),
    reply: {},
    expected: null,
    params: {
      p_session_id: SESSION_ID,
      p_challenge_id: CHALLENGE_ID,
      p_outcome: 'ambiguous',
    },
  },
  {
    label: 'settleChallengeVerify',
    rpc: 'auth_step_up_challenge_verify_settle',
    invoke: (port) =>
      port.settleChallengeVerify(
        {
          ...caller,
          sessionId: SESSION_ID,
          challengeId: CHALLENGE_ID,
          rotation: ROTATION,
        },
        signal,
      ),
    reply: {},
    expected: null,
    params: {
      p_session_id: SESSION_ID,
      p_challenge_id: CHALLENGE_ID,
      p_new_session_id: NEW_SESSION_ID,
      p_issued_at: iso(0),
    },
  },
];

describe('MFA persistence RPC adapter', () => {
  it('names one protected RPC per port method', () => {
    expect(Object.values(MFA_PERSISTENCE_RPC).sort()).toEqual(
      calls.map((call) => call.rpc).sort(),
    );
  });

  describe.each(calls)('$label', (call) => {
    it('posts the exact RPC with trace ids and parses the response', async () => {
      const { fetchImpl, port } = build(() => json(call.reply));
      const result = await call.invoke(port);
      expect(result).toEqual({ ok: true, value: call.expected });
      const [url, init] = fetchImpl.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ];
      expect(url).toBe(
        `https://staging.example.supabase.co/rest/v1/rpc/${call.rpc}`,
      );
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        p_auth_user_id: AUTH_USER_ID,
        p_request_id: REQUEST_ID,
        ...call.params,
      });
      expect(String(init.body)).not.toMatch(/wj_access|caller-access-token/u);
    });

    it('maps a database refusal and an unavailable database', async () => {
      const refused = build(() =>
        json({ message: 'LAST_FACTOR_REQUIRED' }, 400),
      );
      expect(await call.invoke(refused.port)).toMatchObject({
        ok: false,
        status: 409,
        details: { reasonCode: 'last_factor_required' },
      });
      const down = build(() => json({}, 500));
      expect(await call.invoke(down.port)).toMatchObject({
        ok: false,
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
      });
    });
  });

  describe.each(calls.filter((call) => call.expected !== null))(
    '$label response shape',
    (call) => {
      it('fails closed with 502 on a malformed response', async () => {
        const { port } = build(() => json({ unexpected: true }));
        expect(await call.invoke(port)).toMatchObject({
          ok: false,
          status: 502,
          code: 'DEPENDENCY_INVALID_RESPONSE',
        });
      });
    },
  );

  it('hashes the idempotency key and request instead of sending them raw', async () => {
    const { fetchImpl, port } = build(() =>
      json({ providerFactorId: PROVIDER_FACTOR_ID, replay: null }),
    );
    await port.beginRemoval(
      {
        ...caller,
        factorId: FACTOR_ID,
        reason: 'user_request',
        expectedVersion: '3',
        idempotencyKey: 'removal-key-0001',
        sessionId: SESSION_ID,
      },
      signal,
    );
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as Record<string, string>;
    expect(body.p_key_hash).toMatch(/^\\x[0-9a-f]{64}$/u);
    expect(body.p_request_hash).toMatch(/^\\x[0-9a-f]{64}$/u);
    expect(String(init.body)).not.toContain('removal-key-0001');
  });

  it('rejects a replayed removal whose snapshot is malformed', async () => {
    const { port } = build(() =>
      json({ providerFactorId: PROVIDER_FACTOR_ID, replay: { factors: 1 } }),
    );
    expect(
      await port.beginRemoval(
        {
          ...caller,
          factorId: FACTOR_ID,
          reason: 'user_request',
          expectedVersion: '3',
          idempotencyKey: 'removal-key-0001',
          sessionId: SESSION_ID,
        },
        signal,
      ),
    ).toMatchObject({ ok: false, status: 502 });
  });
});
