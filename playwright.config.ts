import { defineConfig, devices } from '@playwright/test';

// Playwright forces color in worker and web-server children. Remove NO_COLOR
// before those processes inherit both variables and make Node emit warnings.
delete process.env.NO_COLOR;

// Playwright must own the server lifetime even when Astro detects an agent host.
process.env.ASTRO_DEV_BACKGROUND = '0';

const ciRunId = process.env.GITHUB_RUN_ID;
if (ciRunId !== undefined && !/^\d+$/u.test(ciRunId)) {
  throw new TypeError('GITHUB_RUN_ID must be an unsigned integer');
}
const ciPortSlot =
  ciRunId === undefined ? undefined : Number(BigInt(ciRunId) % 10_000n);
const webPort = ciPortSlot === undefined ? 4321 : 30_000 + ciPortSlot * 2;
const docsPort = webPort + 1;
const webOrigin = `http://127.0.0.1:${webPort}`;
const docsOrigin = `http://127.0.0.1:${docsPort}`;
const profilePortfolioApiOrigin = 'http://127.0.0.1:8787';
const cloudflareWebServerTimeout = 300_000;
const inheritedEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  ),
);

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  // Astro's Cloudflare dev runtime shares one virtual-module graph. Concurrent
  // SSR transforms can drop Astro modules or React refresh bindings in workerd.
  workers: 1,
  metadata: { docsOrigin },
  projects: [
    {
      // Google Chrome only: the installer-provided browser, launched through
      // the Chrome channel so the bundled Chromium download is never used.
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  reporter: process.env.CI ? 'github' : 'list',
  retries: process.env.CI ? 2 : 0,
  testDir: './tests/e2e',
  testIgnore: [
    // Protected staging evidence must never run against the local fixture servers.
    '**/*.ac265-hosted.spec.ts',
    // Vitest-only unit suite colocated under the Playwright testDir; it imports
    // workspace packages and must run under Vitest, never the browser runner.
    '**/support/*.test.ts',
    'phase-02-slice-09-capability-grant-personas-real-route.spec.ts',
    'phase-02-slice-09-content-schema-registry-performance.spec.ts',
    'phase-02-slice-09-content-schema-registry-real-route.spec.ts',
    'phase-02-slice-09-confirmation-disclosure-real-route.spec.ts',
    'phase-02-slice-10-revision-history-real-route.spec.ts',
    'phase-02-slice-12-template-real-route.spec.ts',
    'phase-02-slice-12-template-uncertain-real-route.spec.ts',
    'phase-02-slice-12-locale-real-route.spec.ts',
    'phase-02-slice-09-schema-review-real-route.spec.ts',
    'phase-02-slice-09-schema-version-real-route.spec.ts',
    'phase-02-slice-09-capability-grants-real-route.spec.ts',
    'phase-02-slice-09-mfa-real-route.spec.ts',
    'phase-02-slice-09-admin-mfa-reset-real-route.spec.ts',
    'phase-02-slice-09-review-layout-real-route.spec.ts',
    'phase-02-slice-09-locale-fields-real-route.spec.ts',
    'phase-02-slice-09-step-up-return-real-route.spec.ts',
    'phase-02-slice-09-registry-browser-real-route.spec.ts',
    'phase-02-slice-09-registry-layout-real-route.spec.ts',
    'phase-02-slice-09-web-vitals-real-route.spec.ts',
  ],
  use: {
    baseURL: webOrigin,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node tests/e2e/support/profile-portfolio-api.mjs --port 8787',
      reuseExistingServer: false,
      timeout: 120_000,
      url: `${profilePortfolioApiOrigin}/healthz`,
    },
    {
      command: `pnpm --filter @wejammin/web dev --host 127.0.0.1 --port ${webPort}`,
      env: {
        ...inheritedEnvironment,
        WEJAMMIN_E2E_ISOLATED: '1',
      },
      reuseExistingServer: false,
      timeout: cloudflareWebServerTimeout,
      url: `${webOrigin}/auth/sign-in`,
    },
    {
      command: `pnpm --filter @wejammin/docs dev --host 127.0.0.1 --port ${docsPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
      url: docsOrigin,
    },
  ],
});
