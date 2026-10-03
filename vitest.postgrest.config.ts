import baseConfig from './vitest.config';
import { defineConfig } from 'vitest/config';

/**
 * Real-API gate project. These suites call the disposable local Supabase stack
 * through Kong and PostgREST (the same `/rest/v1/rpc/<name>` path the Worker
 * uses) with JWTs minted from the local signing secret, so the role and claims
 * the database sees are the ones PostgREST derives, never a hand-set GUC.
 * They COMMIT fixtures (auth users, release principal); run them right after
 * `pnpm db:reset` via `pnpm db:api-test` and reset again afterwards.
 */
export default defineConfig({
  resolve: baseConfig.resolve ?? {},
  test: {
    include: ['tests/postgrest/**/*.apispec.ts'],
    maxWorkers: 1,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
