import baseConfig from './vitest.config';
import { defineConfig } from 'vitest/config';

/**
 * Real-database integration project. These suites drive production Worker
 * modules against the disposable local Supabase database and COMMIT their
 * fixtures, so they never run in the default `vitest run`. Use
 * `pnpm test:db-integration` right after `pnpm db:reset` and run `pnpm
 * db:reset` again afterwards.
 */
export default defineConfig({
  resolve: baseConfig.resolve ?? {},
  test: {
    include: ['tests/db-integration/**/*.dbspec.ts'],
    maxWorkers: 1,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
