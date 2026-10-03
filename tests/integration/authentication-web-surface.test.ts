import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import {
  copyAuthCookies,
  forwardAuthRequest,
} from '../../apps/web/src/server/auth-platform-api';

const workspaceFile = (relativePath: string): string =>
  fileURLToPath(new URL(`../../${relativePath}`, import.meta.url));

describe('authentication web boundary', () => {
  it.each([
    ['email/start.ts', '/api/v1/auth/email/start'],
    ['oauth/start.ts', '/api/v1/auth/oauth/start'],
  ])('publishes the exact nested %s route', (routeFile, contractPath) => {
    const source = readFileSync(
      workspaceFile(`apps/web/src/pages/api/v1/auth/${routeFile}`),
      'utf8',
    );
    expect(source).toContain(contractPath);
  });

  it('renders email and reviewed provider choices without a legacy GitHub shortcut', () => {
    // The email form lives in the server-rendered SignInEmailForm component.
    const source = [
      'apps/web/src/pages/auth/sign-in.astro',
      'apps/web/src/components/authentication/sign-in/SignInEmailForm.tsx',
    ]
      .map((file) => readFileSync(workspaceFile(file), 'utf8'))
      .join('\n');
    expect(source).toContain('Email me a sign-in link');
    expect(source).toContain('Recover my account');
    expect(source).toContain("provider.state !== 'enabled'");
    expect(source).toContain('aria-live="polite"');
    expect(source).not.toMatch(/github/u);
  });

  it.each([
    [
      'apps/web/src/pages/api/v1/account/login-methods/index.ts',
      '/api/v1/account/login-methods',
    ],
    [
      'apps/web/src/pages/api/v1/account/login-methods/[provider]/link-intents.ts',
      '/api/v1/account/login-methods/',
    ],
    [
      'apps/web/src/pages/api/v1/account/login-methods/[identityId].ts',
      '/api/v1/account/login-methods/',
    ],
    [
      'apps/web/src/pages/api/v1/account-merges/index.ts',
      '/api/v1/account-merges',
    ],
    [
      'apps/web/src/pages/api/v1/account-merges/[mergeId]/index.ts',
      '/api/v1/account-merges/',
    ],
    [
      'apps/web/src/pages/api/v1/account-merges/[mergeId]/prove-duplicate.ts',
      '/prove-duplicate',
    ],
    [
      'apps/web/src/pages/api/v1/account-merges/[mergeId]/confirm.ts',
      '/confirm',
    ],
  ])('publishes the Slice 02 proxy %s', (routeFile, contractPath) => {
    expect(readFileSync(workspaceFile(routeFile), 'utf8')).toContain(
      contractPath,
    );
  });

  it('renders the security workbench without account-enumeration affordances', () => {
    const source = readFileSync(
      workspaceFile('apps/web/src/pages/settings/security.astro'),
      'utf8',
    );
    expect(source).toContain('LoginMethodManager');
    expect(source).toContain('Security settings');
    expect(source).toContain('returnTo');
    expect(source).not.toMatch(
      /candidateEmail|candidateAuthUserId|search accounts/u,
    );
  });

  it('forwards only the approved request and response headers', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const forwarded = input as Request;
      expect(forwarded.url).toBe(
        'https://web.example/api/v1/auth/providers?locale=en',
      );
      expect(forwarded.headers.get('cookie')).toBe('wj_access=secret');
      expect(forwarded.headers.get('authorization')).toBeNull();
      return new Response(JSON.stringify({ providers: [] }), {
        headers: {
          'content-type': 'application/json',
          'x-request-id': '11111111-1111-4111-8111-111111111111',
          'x-internal-secret': 'never-forward',
        },
      });
    });
    const response = await forwardAuthRequest(
      new Request('https://web.example/anything?locale=en', {
        headers: { cookie: 'wj_access=secret', authorization: 'Bearer leak' },
      }),
      { fetch },
      '/api/v1/auth/providers',
      'GET',
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(response.headers.get('x-internal-secret')).toBeNull();
  });

  it('fails closed when the service binding is missing or throws', async () => {
    const request = new Request('https://web.example/api/v1/auth/providers');
    await expect(
      forwardAuthRequest(request, undefined, '/api/v1/auth/providers', 'GET'),
    ).resolves.toMatchObject({ status: 503 });
    await expect(
      forwardAuthRequest(
        request,
        { fetch: vi.fn(async () => Promise.reject(new Error('offline'))) },
        '/api/v1/auth/providers',
        'GET',
      ),
    ).resolves.toMatchObject({ status: 503 });
    const nonJson = await forwardAuthRequest(
      request,
      {
        fetch: vi.fn(
          async () => new Response('unsafe dependency error', { status: 503 }),
        ),
      },
      '/api/v1/auth/providers',
      'GET',
    );
    await expect(nonJson.json()).resolves.toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('forwards DELETE bodies and optimistic security headers without authority injection', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const forwarded = input as Request;
      expect(forwarded.method).toBe('DELETE');
      expect(forwarded.headers.get('if-match')).toBe('"7"');
      expect(forwarded.headers.get('idempotency-key')).toBe('slice02-key');
      expect(forwarded.headers.get('authorization')).toBeNull();
      await expect(forwarded.json()).resolves.toEqual({
        reason: 'provider_compromise',
      });
      return Response.json({
        methods: [],
        recoveryBaselinePresent: true,
        version: '8',
      });
    });
    const response = await forwardAuthRequest(
      new Request('https://web.example/security', {
        method: 'DELETE',
        headers: {
          'content-type': 'application/json',
          'if-match': '"7"',
          'idempotency-key': 'slice02-key',
          authorization: 'Bearer must-not-forward',
        },
        body: JSON.stringify({ reason: 'provider_compromise' }),
      }),
      { fetch },
      '/api/v1/account/login-methods/55555555-5555-4555-8555-555555555555',
      'DELETE',
    );
    expect(response.status).toBe(200);
  });

  it('copies every Set-Cookie value without exposing it to client code', () => {
    const source = new Response(null, {
      headers: [
        ['set-cookie', 'wj_access=a; HttpOnly; Secure; SameSite=Lax'],
        ['set-cookie', 'wj_refresh=b; HttpOnly; Secure; SameSite=Strict'],
      ],
    });
    const target = new Headers();
    copyAuthCookies(source, target);
    expect(target.get('set-cookie')).toContain('HttpOnly');
    expect(target.get('set-cookie')).toContain('wj_access');
  });
});
