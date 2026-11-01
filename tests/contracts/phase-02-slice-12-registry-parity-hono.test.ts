import { platformRegistrySet } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  BROWSER_OPERATIONS,
  INTERNAL_OPERATIONS,
  concretePath,
  honoPathOf,
  type SpecOperation,
} from './phase-02-slice-12-registry-parity-fixture';
import {
  CMS_ORIGIN,
  OTHER_ORIGIN,
  discoverWorkerApp,
  honoRoutes,
  requestFor,
} from './phase-02-slice-12-registry-parity-worker.test-support';

/*
 * P2-S12-AC-275, part 3: the Hono routes DISCOVERED from the real Worker application (the
 * production runtime composition) carry every Slice 12 browser operation at its BE03c method and
 * path, with the BE00 CORS, auth and cache behavior the registry declares, and none of
 * CMS-03C-18 to CMS-03C-21.
 */

const app = discoverWorkerApp();
const routes = honoRoutes(app);
const has = (method: string, path: string): boolean =>
  routes.some((route) => route.method === method && route.path === path);
const environment = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'registry-parity',
  SUPABASE_SECRET_KEY: 'sb_secret_registry_parity',
  SUPABASE_URL: 'https://supabase.example.test',
  CMS_HUMAN_ORIGINS: CMS_ORIGIN,
};

describe.each(
  BROWSER_OPERATIONS.map((operation) => [operation.id, operation] as const),
)('[P2-S12-AC-275] Hono %s', (_id, expected: SpecOperation) => {
  it('[P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path', () => {
    const path = honoPathOf(expected.path);
    expect(has(expected.method, path), `${expected.method} ${path}`).toBe(true);
    expect(has('OPTIONS', path), `OPTIONS ${path}`).toBe(true);
  });

  it('[P2-S12-AC-275] answers an allowed-origin preflight with the cms-console credentialed policy and refuses another origin', async () => {
    const path = concretePath(expected.path);
    const allowed = await app.request(
      path,
      {
        method: 'OPTIONS',
        headers: {
          origin: CMS_ORIGIN,
          'access-control-request-method': expected.method,
        },
      },
      environment,
    );
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe(CMS_ORIGIN);
    expect(allowed.headers.get('access-control-allow-credentials')).toBe(
      'true',
    );
    expect(allowed.headers.get('access-control-allow-methods')).toContain(
      expected.method,
    );
    expect(allowed.headers.get('vary')).toContain('Origin');
    const denied = await app.request(
      path,
      {
        method: 'OPTIONS',
        headers: {
          origin: OTHER_ORIGIN,
          'access-control-request-method': expected.method,
        },
      },
      environment,
    );
    expect(denied.status).toBe(403);
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('[P2-S12-AC-275] refuses an unauthenticated request with the BE00 401 ApiError, no-store and the credentialed CORS headers', async () => {
    const response = await app.request(
      requestFor(expected),
      undefined,
      environment,
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('access-control-allow-origin')).toBe(
      CMS_ORIGIN,
    );
    expect(response.headers.get('access-control-allow-credentials')).toBe(
      'true',
    );
    const body = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      'code',
      'details',
      'message',
      'requestId',
    ]);
    expect(body.code).toBe('UNAUTHENTICATED');
    expect(body.details).toEqual({ recoveryAction: 'reauthenticate' });
  });

  it('[P2-S12-AC-275] answers an unsupported media type with the declared 415 ApiError before any session work', async () => {
    if (!expected.errors.includes(415)) return;
    const response = await app.request(
      requestFor(expected, { 'content-type': 'text/plain' }),
      undefined,
      environment,
    );
    expect(response.status).toBe(415);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(((await response.json()) as { code: string }).code).toBe(
      'UNSUPPORTED_MEDIA_TYPE',
    );
  });
});

describe('[P2-S12-AC-275] Hono inventory', () => {
  it('[P2-S12-AC-275] mounts no internal service operation, RPC, job or provider path (CMS-03C-18 to CMS-03C-21)', () => {
    const paths = routes.map((route) => route.path).join('\n');
    for (const [id, names] of Object.entries(INTERNAL_OPERATIONS)) {
      expect(paths, id).not.toContain(id);
      for (const name of names) expect(paths, name).not.toContain(name);
    }
  });

  it('[P2-S12-AC-275] resolves each operation sample path to that operation own route (fixed segments before parameters)', () => {
    const matches = (pattern: string, concrete: string): boolean => {
      const have = pattern.split('/');
      const want = concrete.split('/');
      return (
        have.length === want.length &&
        have.every(
          (segment, index) =>
            segment.startsWith(':') || segment === want[index],
        )
      );
    };
    for (const expected of BROWSER_OPERATIONS) {
      const first = routes.find(
        (route) =>
          route.method === expected.method &&
          matches(route.path, concretePath(expected.path)),
      );
      expect(
        first?.path,
        `${expected.id} ${expected.method} ${expected.path}`,
      ).toBe(honoPathOf(expected.path));
    }
  });

  it('[P2-S12-AC-275] mounts no /api/v1/cms route that the platform route registry does not list (no unregistered browser route)', () => {
    const registered = new Set(
      platformRegistrySet.routes.map(
        (row) => `${row.method} ${honoPathOf(row.path)}`,
      ),
    );
    const unregistered = routes
      .filter(
        (route) =>
          route.method !== 'OPTIONS' && route.path.startsWith('/api/v1/cms/'),
      )
      .map((route) => `${route.method} ${route.path}`)
      .filter((key) => !registered.has(key));
    expect(unregistered).toEqual([]);
  });

  it('[P2-S12-AC-275] mounts every registered Slice 12 operation exactly once per method and path', () => {
    for (const expected of BROWSER_OPERATIONS) {
      const mounted = routes.filter(
        (route) =>
          route.method === expected.method &&
          route.path === honoPathOf(expected.path),
      );
      expect(mounted, expected.id).toHaveLength(1);
    }
  });
});
