import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

delete process.env.NO_COLOR;
process.env.ASTRO_DEV_BACKGROUND = '0';

const port = (name: string, fallback: number): number => {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (!/^[1-9][0-9]{2,4}$/u.test(value))
    throw new TypeError(`${name} must be a TCP port`);
  return Number(value);
};

const webPort = port('S09_WEB_PORT', 4324);
const webOrigin = `http://127.0.0.1:${webPort}`;
const realRouteServerTimeout = 300_000;
const serverLauncher = fileURLToPath(
  new URL('./tests/e2e/support/run-s09-real-servers.mjs', import.meta.url),
);

export default defineConfig({
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  retries: 0,
  // Waits are conditions, not budgets (those are asserted inside the specs): a
  // loaded machine may slow a run down, it must not fail it.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  testDir: './tests/e2e',
  testMatch: [
    'phase-02-slice-09-content-schema-registry-real-route.spec.ts',
    'phase-02-slice-09-confirmation-disclosure-real-route.spec.ts',
    'phase-02-slice-10-revision-history-real-route.spec.ts',
    'phase-02-slice-12-template-real-route.spec.ts',
    'phase-02-slice-12-template-uncertain-real-route.spec.ts',
    'phase-02-slice-12-locale-real-route.spec.ts',
    'phase-02-slice-09-schema-review-real-route.spec.ts',
    'phase-02-slice-09-schema-version-real-route.spec.ts',
    'phase-02-slice-09-capability-grants-real-route.spec.ts',
    'phase-02-slice-09-capability-grant-personas-real-route.spec.ts',
    'phase-02-slice-09-mfa-real-route.spec.ts',
    'phase-02-slice-09-admin-mfa-reset-real-route.spec.ts',
    'phase-02-slice-09-review-layout-real-route.spec.ts',
    'phase-02-slice-09-locale-fields-real-route.spec.ts',
    'phase-02-slice-09-step-up-return-real-route.spec.ts',
    'phase-02-slice-09-cross-tab-scope-real-route.spec.ts',
    'phase-02-slice-09-registry-browser-real-route.spec.ts',
    'phase-02-slice-09-registry-layout-real-route.spec.ts',
    'phase-02-slice-09-web-vitals-real-route.spec.ts',
    'phase-02-slice-09-content-schema-registry-performance.spec.ts',
  ],
  use: {
    baseURL: webOrigin,
    // Trace DOM snapshots perturb the Event Timing values this project owns.
    trace: 'off',
    ...devices['Desktop Chrome'],
    // Google Chrome only; the bundled Chromium download is not used. Applied
    // after the device descriptor so the channel always wins.
    channel: 'chrome',
  },
  webServer: {
    command: `node ${JSON.stringify(serverLauncher)}`,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    reuseExistingServer: false,
    timeout: realRouteServerTimeout,
    url: webOrigin,
  },
});
