import { vi } from 'vitest';

import { base64UrlEncode } from '../authentication/production-configuration';
import { normalizeAuthProductionOptions } from '../authentication/production-configuration';
import { sealFlowCookie } from '../authentication/production-cookie';
import {
  ACTOR_ID,
  PARTY_ID,
  bindings,
  inboxResponse,
  sessionFor,
} from './phase-02-slice-08-worker.test-support';

export const responseJson = (value: unknown, status = 200): Response =>
  Response.json(value, {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const productionJwt = (): string => {
  const encode = (value: unknown): string =>
    base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1_000) + 3_600,
    iss: `${bindings.SUPABASE_URL}/auth/v1`,
    session_id: sessionFor().sessionId,
    sub: ACTOR_ID,
  })}.signature`;
};

export const productionCookie = async (): Promise<string> => {
  const config = normalizeAuthProductionOptions({
    environment: bindings,
    randomBytes: (length) => new Uint8Array(length).fill(7),
  });
  const session = sessionFor();
  const reference = await sealFlowCookie(
    {
      state: session.sessionId,
      nonce: ACTOR_ID,
      verifier: '',
      provider: 'session',
      intent: 'session',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    },
    config,
  );
  return `wj_access=${productionJwt()}; wj_session_ref=${reference}`;
};

export const productionFetch = (
  capabilityResponse: unknown,
  capabilityStatus = 200,
) =>
  vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    void _init;
    const operation = new URL(String(input)).pathname.split('/').at(-1);
    switch (operation) {
      case 'user':
        return responseJson({ id: ACTOR_ID });
      case 'auth_session_read':
        return responseJson({
          accountState: 'active',
          personId: ACTOR_ID,
          actingPartyId: PARTY_ID,
        });
      case 'auth_rate_limit':
        return responseJson({
          allowed: true,
          limit: 120,
          remaining: 119,
          resetAt: Math.floor(Date.now() / 1_000) + 60,
        });
      case 'admin_context_capabilities':
        return responseJson(capabilityResponse, capabilityStatus);
      case 'admin_inbox':
        return responseJson(inboxResponse);
      default:
        return responseJson({});
    }
  });
