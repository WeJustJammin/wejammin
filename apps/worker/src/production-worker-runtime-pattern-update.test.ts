import { createLogger } from '@wejammin/observability/logging';
import { describe, expect, it, vi } from 'vitest';

import {
  createWorkerApp,
  type WorkerBindings,
  type WorkerDependencies,
} from './index';
import {
  createRuntimeDependencies,
  createProductionWorkerAppRuntime,
} from './production-worker-runtime';
import type { CmsPatternDefinitionDependencies } from './cms-composition/pattern-definition-ports';
import {
  allowRate,
  puSession,
} from './cms-composition/pattern-update-routes.test-support';
import {
  PU_ORIGIN,
  PU_REQUEST_ID,
  PU_SELECTOR_PATH,
  PU_TYPE_ID,
  PU_UPDATE_PATH,
  acceptBody,
  puDiffPath,
  selectorPage,
} from './cms-composition/pattern-update.test-support';

/**
 * The linked-update boundary is composed into the production Worker runtime and mounted by the Worker app: the three
 * routes answer their typed 401 (never the generic 404) and the selector wins over `/api/v1/cms/patterns/:patternKey`.
 */
const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'slice-12-pattern-update-runtime',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://supabase.example.test',
};
const logger = () =>
  createLogger(
    { environment: 'staging', release: 'slice-12', service: 'wejammin-api' },
    {
      now: () => new Date('2026-10-15T08:00:00Z'),
      random: () => 0,
      sink: () => undefined,
    },
  );

describe('production Worker runtime composition of the linked-update boundary', () => {
  it('injects cmsPatternUpdate and mounts all three routes behind the typed 401', async () => {
    let dependencies: WorkerDependencies | undefined;
    const fetchImpl = vi.fn(async () => {
      throw new Error('Admission must not call an outbound dependency');
    });
    const app = createProductionWorkerAppRuntime(
      (value) => {
        dependencies = value;
        return createWorkerApp(value);
      },
      environment,
      fetchImpl as never,
      undefined,
      undefined,
      undefined,
      undefined,
      { humanOrigins: [PU_ORIGIN] },
    );
    expect(dependencies?.cmsPatternUpdate).toBeDefined();
    const headers = { origin: PU_ORIGIN, 'x-request-id': PU_REQUEST_ID };
    const requests: readonly (readonly [string, RequestInit])[] = [
      [`${PU_SELECTOR_PATH}?contentTypeId=${PU_TYPE_ID}`, { method: 'GET' }],
      [puDiffPath(), { method: 'GET' }],
      [
        PU_UPDATE_PATH,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'idempotency-key': 'pattern-update-0001',
            'if-match': '"7"',
          },
          body: JSON.stringify(acceptBody(1)),
        },
      ],
    ];
    for (const [path, init] of requests) {
      const response = await app.request(
        path,
        {
          ...init,
          headers: { ...headers, ...(init.headers as object | undefined) },
        },
        environment,
      );
      expect(response.status, path).toBe(401);
      expect(await response.json()).toMatchObject({
        code: 'UNAUTHENTICATED',
        requestId: PU_REQUEST_ID,
      });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('createRuntimeDependencies carries the boundary through as its last positional argument', () => {
    const cmsPatternUpdate = {} as never;
    const args = new Array<undefined>(20).fill(undefined);
    const withIt = (
      createRuntimeDependencies as (...a: unknown[]) => WorkerDependencies
    )(...args, cmsPatternUpdate);
    expect(withIt.cmsPatternUpdate).toBe(cmsPatternUpdate);
    expect(
      (createRuntimeDependencies as (...a: unknown[]) => WorkerDependencies)(
        ...args,
      ),
    ).not.toHaveProperty('cmsPatternUpdate');
  });
});

describe('route precedence with the pattern definition routes', () => {
  const definition = () => {
    const readLatest = vi.fn<CmsPatternDefinitionDependencies['readLatest']>(
      async () => ({ ok: false, status: 404, code: 'X', message: 'x' }),
    );
    const dependencies: CmsPatternDefinitionDependencies = {
      humanOrigins: [PU_ORIGIN],
      now: () => 1_000,
      resolveSession: async () => ({
        ok: true,
        value: {
          ...puSession(),
          capabilities: ['cms.template_designer', 'cms.author'],
        },
      }),
      rateLimit: async (input) => ({
        ok: true,
        value: {
          allowed: true,
          limit: input.limit,
          remaining: 1,
          resetAt: 2_000,
        },
      }),
      definePattern: vi.fn(),
      readLatest,
      telemetry: () => undefined,
    };
    return { dependencies, readLatest };
  };

  it('GET /patterns/selector reaches the selector, never the latest-read route', async () => {
    const { dependencies, readLatest } = definition();
    const readSelector = vi.fn(async () => ({
      ok: true as const,
      value: selectorPage(),
    }));
    const app = createWorkerApp({
      captureException: () => undefined,
      createLogger: logger,
      now: () => 1_000,
      cmsPatternDefinition: dependencies,
      cmsPatternUpdate: {
        humanOrigins: [PU_ORIGIN],
        now: () => 1_000,
        resolveSession: async () => ({ ok: true, value: puSession() }),
        rateLimit: allowRate,
        readSelector,
        readUpdateDiff: vi.fn(),
        readInstances: vi.fn(),
        applyUpdate: vi.fn(),
        telemetry: () => undefined,
      },
    });
    const response = await app.request(
      `${PU_SELECTOR_PATH}?contentTypeId=${PU_TYPE_ID}`,
      { headers: { origin: PU_ORIGIN } },
      environment,
    );
    expect(response.status).toBe(200);
    expect(readSelector).toHaveBeenCalledTimes(1);
    expect(readLatest).not.toHaveBeenCalled();
    const preflight = await app.request(
      PU_SELECTOR_PATH,
      { method: 'OPTIONS', headers: { origin: PU_ORIGIN } },
      environment,
    );
    expect(preflight.status).toBe(204);
  });

  it('GET /patterns/{patternKey} still reaches the latest-read route', async () => {
    const { dependencies, readLatest } = definition();
    const app = createWorkerApp({
      captureException: () => undefined,
      createLogger: logger,
      now: () => 1_000,
      cmsPatternDefinition: dependencies,
      cmsPatternUpdate: {
        humanOrigins: [PU_ORIGIN],
        now: () => 1_000,
        resolveSession: async () => ({ ok: true, value: puSession() }),
        rateLimit: allowRate,
        readSelector: vi.fn(),
        readUpdateDiff: vi.fn(),
        readInstances: vi.fn(),
        applyUpdate: vi.fn(),
        telemetry: () => undefined,
      },
    });
    const response = await app.request(
      '/api/v1/cms/patterns/profile-hero',
      { headers: { origin: PU_ORIGIN } },
      environment,
    );
    expect(response.status).toBe(404);
    expect(readLatest).toHaveBeenCalledTimes(1);
  });

  it('the Worker without the boundary answers its routes as the generic 404', async () => {
    const app = createWorkerApp({
      captureException: () => undefined,
      createLogger: logger,
      now: () => 1_000,
    });
    const response = await app.request(puDiffPath(), {}, environment);
    expect(response.status).toBe(404);
  });
});
