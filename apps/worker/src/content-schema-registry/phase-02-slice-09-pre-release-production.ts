/**
 * Production composition for the release routes: the real route tree, the real
 * release verifier and the real platform RPC adapter over a stubbed fetch.
 */
import type { WorkerBindings } from '../index';
import {
  createProductionContentSchemaRegistryDependencies,
  type ContentSchemaRegistryProductionOptions,
} from './production';
import { createContentSchemaRegistryApp } from './routes';
import { CMS_ORIGIN, RELEASE_ORIGIN } from './phase-02-slice-09-test-values';

export const createContentSchemaRegistryProductionApp = (
  registry: string,
  fetchImpl: typeof fetch,
  now: () => number,
  extra: Partial<ContentSchemaRegistryProductionOptions> = {},
) =>
  createContentSchemaRegistryApp(
    createProductionContentSchemaRegistryDependencies({
      environment: {
        APP_ENVIRONMENT: 'staging',
        APP_RELEASE: 'slice-09-pre',
        SUPABASE_SECRET_KEY: 'sb_secret_slice_09_pre',
        SUPABASE_URL: 'https://supabase.example.test',
        CMS_RELEASE_KEY_REGISTRY: registry,
      } as WorkerBindings,
      fetchImpl,
      releaseOrigins: [RELEASE_ORIGIN],
      humanOrigins: [CMS_ORIGIN],
      now,
      rateLimit: async () => ({
        ok: true as const,
        value: {
          allowed: true,
          limit: 20,
          remaining: 19,
          resetAt: 1_756_000_000,
        },
      }),
      ...extra,
    }),
  );

/** The production RPC adapter ports over a stubbed fetch (no route tree). */
export const productionPorts = (
  fetchImpl: typeof fetch,
  now: () => number,
  extra: Partial<ContentSchemaRegistryProductionOptions> = {},
) =>
  createProductionContentSchemaRegistryDependencies({
    environment: {
      APP_ENVIRONMENT: 'staging',
      APP_RELEASE: 'slice-09-pre',
      SUPABASE_SECRET_KEY: 'sb_secret_slice_09_pre',
      SUPABASE_URL: 'https://supabase.example.test',
    } as WorkerBindings,
    fetchImpl,
    releaseOrigins: [RELEASE_ORIGIN],
    humanOrigins: [CMS_ORIGIN],
    now,
    ...extra,
  }).ports;
