import { vi } from 'vitest';

import {
  createWorkerApp,
  type WorkerApp,
  type WorkerBindings,
} from '../../apps/worker/src/index';
import { createProductionWorkerAppRuntime } from '../../apps/worker/src/production-worker-runtime';
import type { ProductionCmsEditorialOptions } from '../../apps/worker/src/production-worker-runtime-cms';
import {
  concretePath,
  type SpecOperation,
} from './phase-02-slice-12-registry-parity-types';

/*
 * The real Worker application, built by the production runtime composition, from which the Hono
 * route inventory of Slice 12 is discovered (never a hand-written list). Session and rate seams
 * are injectable through the runtime's own `ProductionCmsEditorialOptions`.
 */

export const CMS_ORIGIN = 'https://cms.example.test';
export const OTHER_ORIGIN = 'https://other.example.test';

export const WORKER_ENVIRONMENT = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'registry-parity',
  SUPABASE_SECRET_KEY: 'sb_secret_registry_parity',
  SUPABASE_URL: 'https://supabase.example.test',
  CMS_HUMAN_ORIGINS: CMS_ORIGIN,
} as WorkerBindings;

/** The production Worker app; the Supabase transport answers an empty list (no database is reachable). */
export const discoverWorkerApp = (
  cmsEditorialOptions?: ProductionCmsEditorialOptions,
): WorkerApp =>
  createProductionWorkerAppRuntime(
    (dependencies) => createWorkerApp(dependencies) as WorkerApp,
    WORKER_ENVIRONMENT,
    vi.fn(async () => Response.json([])),
    undefined,
    undefined,
    undefined,
    undefined,
    cmsEditorialOptions,
  );

export type HonoRoute = Readonly<{ method: string; path: string }>;

/** Every Hono route that serves a handler (middleware `ALL` entries are not routes). */
export const honoRoutes = (app: WorkerApp): readonly HonoRoute[] =>
  app.routes
    .filter((route) => route.method !== 'ALL')
    .map(({ method, path }) => ({ method, path }));

/** A valid-looking request to an operation: an allowed origin, a JSON body for a write. */
export const requestFor = (
  expected: SpecOperation,
  headers: Readonly<Record<string, string>> = {},
): Request =>
  new Request(`https://api.example.test${concretePath(expected.path)}`, {
    method: expected.method,
    headers: {
      origin: CMS_ORIGIN,
      ...(expected.method === 'POST'
        ? {
            'content-type': 'application/json',
            'idempotency-key': 'parity-key-0001',
          }
        : {}),
      ...headers,
    },
    ...(expected.method === 'POST' ? { body: '{}' } : {}),
  });
