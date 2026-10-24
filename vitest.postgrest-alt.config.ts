import baseConfig from './vitest.config';
import { defineConfig } from 'vitest/config';

/**
 * Explicit local ALT-only real-API suites (`*.alt-apispec.ts`). They are NOT
 * collected by `vitest.postgrest.config.ts` (`pnpm db:api-test`, the canonical
 * `db:verify` gate) because they need a separately started ALT stack and root
 * runtime release variables (see `tests/postgrest/support/README.md`, "ALT-only
 * suites"). Run them on purpose with `pnpm db:api-test:dec194-alt`.
 */
export default defineConfig({
  resolve: baseConfig.resolve ?? {},
  test: {
    include: ['tests/postgrest/**/*.alt-apispec.ts'],
    maxWorkers: 1,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
