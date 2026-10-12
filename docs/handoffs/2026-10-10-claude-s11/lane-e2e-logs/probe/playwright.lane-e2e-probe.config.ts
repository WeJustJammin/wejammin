import { defineConfig } from '@playwright/test';

import base from './playwright.s09-real.config';

// Probe-only config: the s09-real harness, matching only the temporary probe spec.
export default defineConfig({
  ...base,
  testMatch: ['zz-lane-e2e-probe.spec.ts'],
});
