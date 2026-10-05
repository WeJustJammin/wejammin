import { defineConfig, devices } from '@playwright/test';
export default defineConfig({ testDir: './tests/e2e', testMatch: ['zz-dbg*.spec.ts', 'phase-02-slice-09-*-real-route.spec.ts'], testIgnore: ['*content-schema-registry-real-route*','*confirmation-disclosure*'], workers: 1, reporter: 'list', use: { baseURL: 'http://127.0.0.1:4324', ...devices['Desktop Chrome'], channel: 'chrome' } });
