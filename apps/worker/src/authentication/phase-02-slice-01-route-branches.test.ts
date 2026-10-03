import { describe, expect, it, vi } from 'vitest';

import { createLogger } from '@wejammin/observability/logging';
import { createWorkerApp } from '../index';
import {
  PERSON_ID,
  bindings,
  success,
  unavailable,
  session,
  createAuth,
  createApp,
  jsonHeaders,
} from './phase-02-slice-01.test-support';

describe('Phase 2 Slice 01 authentication route branches', () => {
  it('returns typed dependency errors when authentication composition is absent', async () => {
    const app = createWorkerApp({
      captureException: vi.fn(),
      createLogger: () =>
        createLogger({
          environment: 'staging',
          release: 'test',
          service: 'wejammin-api',
        }),
      now: Date.now,
    });
    const response = await app.request('/api/v1/auth/providers', {}, bindings);
    expect(response.status).toBe(503);
  });

  it('rejects duplicate callback query fields', async () => {
    const { app } = createApp();
    const response = await app.request(
      '/auth/callback?state=one&state=two&code=opaque',
      {},
      bindings,
    );
    expect(response.status).toBe(400);
  });

  it('enforces session and fresh step-up for protected OAuth intents', async () => {
    const body = JSON.stringify({
      provider: 'google',
      intent: 'link',
      returnTo: '/settings/security',
    });
    const protectedHeaders = {
      ...jsonHeaders,
      'idempotency-key': 'protected-oauth-link',
      'if-match': '"1"',
    };
    const missing = createApp(
      createAuth({ resolveSession: vi.fn(async () => unavailable()) }),
    );
    expect(
      (
        await missing.app.request(
          'https://api.example.test/api/v1/auth/oauth/start',
          { method: 'POST', headers: protectedHeaders, body },
          bindings,
        )
      ).status,
    ).toBe(503);
    const stale = createApp(
      createAuth({
        resolveSession: vi.fn(async () =>
          success({ ...session, stepUpAt: null }),
        ),
      }),
    );
    expect(
      (
        await stale.app.request(
          'https://api.example.test/api/v1/auth/oauth/start',
          { method: 'POST', headers: protectedHeaders, body },
          bindings,
        )
      ).status,
    ).toBe(401);
    const fresh = createApp();
    expect(
      (
        await fresh.app.request(
          'https://api.example.test/api/v1/auth/oauth/start',
          { method: 'POST', headers: protectedHeaders, body },
          bindings,
        )
      ).status,
    ).toBe(201);
  });

  it('enforces CSRF and idempotency before refresh, bootstrap, and logout effects', async () => {
    const { app } = createApp();
    const withoutCsrf = {
      'content-type': 'application/json',
      origin: 'https://api.example.test',
    };
    expect(
      (
        await app.request(
          '/api/v1/auth/session/refresh',
          { method: 'POST', headers: withoutCsrf, body: '{}' },
          bindings,
        )
      ).status,
    ).toBe(403);
    // BE00 step 8: a missing Idempotency-Key is refused after the origin, CSRF
    // and session steps, so the request carries the real same-origin URL.
    expect(
      (
        await app.request(
          'https://api.example.test/api/v1/auth/bootstrap',
          { method: 'POST', headers: jsonHeaders, body: '{}' },
          bindings,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await app.request(
          '/api/v1/auth/bootstrap',
          {
            method: 'POST',
            headers: { ...withoutCsrf, 'idempotency-key': 'bootstrap-key' },
            body: '{}',
          },
          bindings,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await app.request(
          'https://api.example.test/api/v1/auth/logout',
          { method: 'POST', headers: jsonHeaders, body: '{}' },
          bindings,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await app.request(
          '/api/v1/auth/logout',
          {
            method: 'POST',
            headers: { ...withoutCsrf, 'idempotency-key': 'logout-key' },
            body: '{}',
          },
          bindings,
        )
      ).status,
    ).toBe(403);
  });

  it('returns 200 for a replayed bootstrap and defaults logout scope to current', async () => {
    const auth = createAuth({
      bootstrap: vi.fn(async () =>
        success({
          created: false,
          resource: {
            personId: PERSON_ID,
            actingPartyId: PERSON_ID,
            contextKind: 'self' as const,
            accountState: 'active' as const,
            bindingVersion: '1',
          },
        }),
      ),
    });
    const { app } = createApp(auth);
    const bootstrap = await app.fetch(
      new Request('https://api.example.test/api/v1/auth/bootstrap', {
        method: 'POST',
        headers: { ...jsonHeaders, 'idempotency-key': 'bootstrap-key' },
        body: '{}',
      }),
      bindings,
    );
    expect(bootstrap.status).toBe(200);
    const logout = await app.fetch(
      new Request('https://api.example.test/api/v1/auth/logout', {
        method: 'POST',
        headers: { ...jsonHeaders, 'idempotency-key': 'logout-key' },
        body: '{}',
      }),
      bindings,
    );
    expect(logout.status).toBe(204);
    expect(auth.logout).toHaveBeenCalledWith(
      expect.anything(),
      { scope: 'current' },
      'logout-key',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });
});
