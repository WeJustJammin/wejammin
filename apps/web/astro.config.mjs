// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import {
  builtRouteScriptsIntegration,
  edgeSecurityIntegration,
} from './astro-build-integrations.mjs';
import { clientChunkOutput } from './client-chunk-boundaries.mjs';
const runtimeProcess = /** @type {{
  env?: Record<string, string | undefined>;
  argv?: unknown;
}} */ (Reflect.get(globalThis, 'process') ?? {});
const runtimeEnvironment = runtimeProcess.env ?? {};
const isolateCloudflareDev =
  'GITHUB_RUN_ID' in runtimeEnvironment ||
  ('WEJAMMIN_E2E_ISOLATED' in runtimeEnvironment &&
    runtimeEnvironment.WEJAMMIN_E2E_ISOLATED === '1');
/** @type {import('@astrojs/cloudflare').Options} */
const cloudflareDevIsolation = isolateCloudflareDev
  ? { inspectorPort: false, persistState: false }
  : {};
const runtimeArgv = Array.isArray(runtimeProcess.argv)
  ? runtimeProcess.argv
  : [];
const isAstroDevCommand = runtimeArgv.includes('dev');

export default defineConfig({
  output: 'server',
  session: false,
  devToolbar: { enabled: !isolateCloudflareDev },
  integrations: [
    react(),
    edgeSecurityIntegration(),
    builtRouteScriptsIntegration(),
  ],
  vite: {
    build: {
      rollupOptions: { output: clientChunkOutput },
    },
    optimizeDeps: {
      include: [
        'astro/assets/services/noop',
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-dev-runtime',
      ],
    },
  },
  adapter: cloudflare({
    ...cloudflareDevIsolation,
    ...(isAstroDevCommand ? { configPath: './wrangler.dev.jsonc' } : {}),
    imageService: 'passthrough',
  }),
});
