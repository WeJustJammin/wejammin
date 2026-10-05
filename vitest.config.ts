import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const workspacePath = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@wejammin/application/infrastructure/security': workspacePath(
        './packages/application/src/infrastructure/security.ts',
      ),
      '@wejammin/application': workspacePath(
        './packages/application/src/index.ts',
      ),
      '@wejammin/contracts/client': workspacePath(
        './packages/contracts/src/client.ts',
      ),
      '@wejammin/contracts/content-schema-registry/validators': workspacePath(
        './packages/contracts/src/content-schema-registry/validators.ts',
      ),
      '@wejammin/contracts': workspacePath('./packages/contracts/src/index.ts'),
      '@wejammin/observability': workspacePath('./packages/observability/src'),
      '@wejammin/test-support': workspacePath(
        './packages/test-support/src/index.ts',
      ),
      '@wejammin/ui/infrastructure/navigation': workspacePath(
        './packages/ui/src/infrastructure/navigation.ts',
      ),
      '@wejammin/ui/infrastructure/presentation': workspacePath(
        './packages/ui/src/infrastructure/presentation.ts',
      ),
    },
  },
  test: {
    // Contract tests exercise bounded child CLIs and builds. Keep enough host
    // capacity for those children instead of oversubscribing the runner.
    maxWorkers: process.env.CI ? 4 : 2,
    testTimeout: 15_000,
    coverage: {
      all: true,
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.test-support.ts',
        'packages/application/src/index.ts',
        'packages/application/src/infrastructure/security.ts',
        'packages/contracts/src/index.ts',
        'packages/contracts/src/client.ts',
        'packages/contracts/src/content-schema-registry/validators.ts',
        'packages/ui/src/infrastructure/navigation.ts',
        'packages/ui/src/infrastructure/presentation.ts',
      ],
      include: [
        'apps/worker/src/**/*.ts',
        'packages/application/src/**/*.ts',
        'packages/contracts/src/**/*.ts',
        'packages/observability/src/**/*.ts',
        'packages/ui/src/**/*.ts',
      ],
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
    include: [
      'apps/**/*.test.{ts,tsx}',
      'packages/**/*.test.ts',
      'tests/contracts/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/accessibility/**/*.test.ts',
      'tests/performance/**/*.test.ts',
      'tests/security/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
  },
});
