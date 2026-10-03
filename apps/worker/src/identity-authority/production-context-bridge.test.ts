import { describe, expect, it, vi } from 'vitest';

import type { WorkerBindings } from '../index';
import {
  CSRF,
  ORIGIN,
} from '../authentication/phase-02-slice-02.test-fixtures';
import { createApp } from '../authentication/phase-02-slice-02.test-support';
import { createProductionIdentityAuthorityDependencies } from './production';
import { identityRpcRequestHeaders } from './production-request-context';

const AUTH_USER_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const PARTY_ID = '44444444-4444-4444-8444-444444444444';
const BINDING_ID = '55555555-5555-4555-8555-555555555555';
const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const CORRELATION_ID = '66666666-6666-4666-8666-666666666666';
const ACCESS_TOKEN = 'validated-cookie-access.jwt.signature';
const LEGACY_SECRET = 'legacy-service-role-jwt-secret-for-tests';

const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'slice-09-context-bridge-test',
  SUPABASE_SECRET_KEY: LEGACY_SECRET,
  SUPABASE_URL: 'https://identity.example.test',
};

const session = {
  authUserId: AUTH_USER_ID,
  sessionId: SESSION_ID,
  accountState: 'active' as const,
  personId: PARTY_ID,
  actingPartyId: PARTY_ID,
  expiresAt: '2026-09-12T22:00:00Z',
  stepUpAt: null,
};

const request = (cookie = `wj_access=${ACCESS_TOKEN}`): Request =>
  new Request('https://api.example.test/api/v1/me/acting-contexts', {
    headers: {
      cookie,
      authorization: 'Bearer browser-controlled-token',
      'idempotency-key': 'context-bind-idempotency-1',
      'x-client-binding-id': 'tab-7:active',
      'x-request-id': REQUEST_ID,
      'x-correlation-id': CORRELATION_ID,
    },
  });

const json = (value: unknown): Response =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const identityRouteRequest = (
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
  extraHeaders: Readonly<Record<string, string>> = {},
): Request => {
  const headers = new Headers({
    origin: ORIGIN,
    cookie: `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`,
    'x-csrf-token': CSRF,
    'idempotency-key': 'slice03-coverage',
    'if-match': '"1"',
    'x-request-id': REQUEST_ID,
    ...extraHeaders,
  });
  if (body !== undefined) headers.set('content-type', 'application/json');
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request(`${ORIGIN}${path}`, init);
};

describe('identity acting-context route selector bridge', () => {
  it('rejects a malformed client-binding selector before session resolution', async () => {
    const { app, auth, identity } = createApp();
    const response = await app.request(
      identityRouteRequest('/api/v1/me/acting-contexts', 'GET', undefined, {
        'x-client-binding-id': 'tab selector with spaces',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_REQUEST',
    });
    expect(auth.resolveSession).not.toHaveBeenCalled();
    expect(identity.readActingContexts).not.toHaveBeenCalled();
  });

  it('rejects a context bind whose optional header differs from its body before session resolution', async () => {
    const { app, auth, identity } = createApp();
    const response = await app.request(
      identityRouteRequest(
        '/api/v1/me/acting-context-bindings',
        'POST',
        {
          contextId: '99999999-9999-4999-8999-999999999999',
          deliberateConfirmation: true,
          clientBindingId: 'tab-body',
        },
        { 'x-client-binding-id': 'tab-header' },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_REQUEST',
    });
    // BE00: the session is verified (step 4) before strict validation (step 6)
    // and the idempotency headers (step 8).
    expect(auth.resolveSession).toHaveBeenCalledTimes(1);
    expect(identity.bindActingContext).not.toHaveBeenCalled();
  });

  it('rejects a malformed optional context-binding header before session resolution', async () => {
    const { app, auth, identity } = createApp();
    const response = await app.request(
      identityRouteRequest(
        '/api/v1/me/acting-context-bindings',
        'POST',
        {
          contextId: '99999999-9999-4999-8999-999999999999',
          deliberateConfirmation: true,
          clientBindingId: 'tab-body',
        },
        { 'x-client-binding-id': 'tab selector with spaces' },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_REQUEST',
    });
    expect(auth.resolveSession).not.toHaveBeenCalled();
    expect(identity.bindActingContext).not.toHaveBeenCalled();
  });

  it('keeps body-only context binding compatible when the optional header is absent', async () => {
    const { app, identity } = createApp();
    const response = await app.request(
      identityRouteRequest('/api/v1/me/acting-context-bindings', 'POST', {
        contextId: '99999999-9999-4999-8999-999999999999',
        deliberateConfirmation: true,
        clientBindingId: 'tab-body-only',
      }),
    );

    expect(response.status).toBe(201);
    expect(identity.bindActingContext).toHaveBeenCalledOnce();
  });
});

describe('identity production acting-context bridge', () => {
  it('omits the optional binding selector for legacy requests and rejects malformed selectors', () => {
    const legacyRequest = new Request(
      'https://api.example.test/api/v1/me/acting-contexts',
      {
        headers: {
          'x-request-id': REQUEST_ID,
          'x-correlation-id': CORRELATION_ID,
        },
      },
    );
    expect(
      identityRpcRequestHeaders({ request: legacyRequest, session: null }),
    ).toEqual({
      'x-request-id': REQUEST_ID,
      'x-correlation-id': CORRELATION_ID,
    });

    let failure: unknown;
    try {
      identityRpcRequestHeaders({
        request: new Request(
          'https://api.example.test/api/v1/me/acting-contexts',
          {
            headers: { 'x-client-binding-id': 'tab selector with spaces' },
          },
        ),
        session: null,
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({
      ok: false,
      status: 400,
      code: 'INVALID_REQUEST',
    });
  });

  it('keeps Request and Session for context list and bind RPCs, forwarding the cookie JWT and request metadata', async () => {
    const calls: Array<{
      name: string;
      headers: Headers;
      body: string;
    }> = [];
    const fetchImpl = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({
          name: String(input).split('/').at(-1) ?? '',
          headers: new Headers(init?.headers),
          body: String(init?.body ?? ''),
        });
        return String(input).endsWith('/identity_context_bind')
          ? json({
              bindingId: BINDING_ID,
              selectedPartyId: PARTY_ID,
              expiresAt: '2026-09-12T22:00:00Z',
              projectionVersion: '1',
              version: '1',
            })
          : json({
              projectionVersion: '1',
              items: [],
              nextCursor: null,
              hasMore: false,
            });
      },
    ) as typeof fetch;
    const dependencies = createProductionIdentityAuthorityDependencies({
      environment,
      fetchImpl,
    });
    const signal = new AbortController().signal;

    await expect(
      dependencies.readActingContexts!(
        { request: request(), session, cursor: null },
        environment,
        signal,
      ),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      dependencies.bindActingContext!(
        {
          request: request(),
          session,
          idempotencyKey: 'context-bind-idempotency-1',
          ifMatch: null,
          contextId: PARTY_ID,
          deliberateConfirmation: true,
          clientBindingId: 'tab-7:active',
        },
        environment,
        signal,
      ),
    ).resolves.toMatchObject({ ok: true });

    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.headers.get('apikey')).toBe(LEGACY_SECRET);
      expect(call.headers.get('authorization')).toBe(`Bearer ${ACCESS_TOKEN}`);
      expect(call.headers.get('x-client-binding-id')).toBe('tab-7:active');
      expect(call.headers.get('x-request-id')).toBe(REQUEST_ID);
      expect(call.headers.get('x-correlation-id')).toBe(CORRELATION_ID);
      expect(call.body).not.toContain(ACCESS_TOKEN);
      expect(call.body).not.toContain('browser-controlled-token');
    }
    expect(calls[0]?.headers.get('idempotency-key')).toBeNull();
    expect(calls[1]?.headers.get('idempotency-key')).toBe(
      'context-bind-idempotency-1',
    );
    expect(calls[1]?.body).toContain('"p_client_binding_id":"tab-7:active"');
  });

  it('fails closed without a request-scoped access cookie and keeps public projections on the service path', async () => {
    const fetchImpl = vi.fn(async () =>
      json({
        partyId: PARTY_ID,
        kind: 'person',
        displayName: 'Rob Example',
        handle: null,
        profileRef: null,
        publicLinkState: 'public',
        lifecycle: 'active',
        version: '1',
        facetLabels: [],
      }),
    ) as typeof fetch;
    const dependencies = createProductionIdentityAuthorityDependencies({
      environment,
      fetchImpl,
    });
    const signal = new AbortController().signal;

    await expect(
      dependencies.readActingContexts!(
        { request: request('wj_session_ref=opaque'), session, cursor: null },
        environment,
        signal,
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: 401,
      code: 'UNAUTHENTICATED',
    });
    expect(fetchImpl).not.toHaveBeenCalled();

    await expect(
      dependencies.readPublicProjection!(
        { request: request(), partyId: PARTY_ID },
        environment,
        signal,
      ),
    ).resolves.toMatchObject({ ok: true });
    const init = vi.mocked(fetchImpl).mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get('apikey')).toBe(LEGACY_SECRET);
    expect(new Headers(init?.headers).get('authorization')).toBe(
      `Bearer ${LEGACY_SECRET}`,
    );
    expect(new Headers(init?.headers).get('authorization')).not.toBe(
      `Bearer ${ACCESS_TOKEN}`,
    );
  });
});
