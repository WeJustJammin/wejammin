// @ts-check
// @ts-expect-error Astro config runs in Node; the web package intentionally has no Node runtime types.
import { copyFile, readFile, writeFile } from 'node:fs/promises';

import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import { clientChunkOutput } from './client-chunk-boundaries.mjs';
import { verifyBuiltRouteScripts } from './built-route-scripts.mjs';
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
/**
 * Astro's Cloudflare entry checks static and fallback assets before invoking
 * Astro middleware. Append one outer fetch boundary after the adapter emits
 * its entry so every response, including ASSETS.fetch responses, receives
 * HTTPS enforcement and the locked security headers.
 */
const edgeSecurityIntegration = () => ({
  name: 'wejammin-edge-security',
  hooks: {
    'astro:build:done': async (
      /** @type {{ dir: URL }} */
      { dir },
    ) => {
      const entryUrl = new URL('../server/entry.mjs', dir);
      const runtimeSourceUrl = new URL(
        './edge-security-runtime.mjs',
        import.meta.url,
      );
      const runtimeTargetUrl = new URL(
        '../server/edge-security-runtime.mjs',
        dir,
      );

      await copyFile(runtimeSourceUrl, runtimeTargetUrl);
      await copyFile(
        new URL('./edge-security-html.mjs', import.meta.url),
        new URL('../server/edge-security-html.mjs', dir),
      );
      const entry = await readFile(entryUrl, 'utf8');
      const entryMarker = 'export { worker_entry_default as default };';
      if (!entry.includes(entryMarker)) {
        throw new Error(
          'Astro Cloudflare entry shape changed; edge security wrapper was not installed',
        );
      }

      const wrapperMarker = '/* @wejammin-edge-security */';
      if (entry.includes(wrapperMarker)) return;

      const wrapper = `
import { createEdgeFetchHandler as __wejamminCreateEdgeFetchHandler } from './edge-security-runtime.mjs';
${wrapperMarker}
worker_entry_default.fetch = __wejamminCreateEdgeFetchHandler(worker_entry_default.fetch);
`;
      await writeFile(entryUrl, `${entry}\n${wrapper}`, 'utf8');
    },
  },
});

/**
 * Fails the build when a route would serve a script no build emitted: a raw
 * `<script src="...ts">` inside a runtime HTML string, a processed script with
 * no emitted file, or a document route that never loads the cross-tab
 * auth-scope-sync asset.
 */
const builtRouteScriptsIntegration = () => ({
  name: 'wejammin-built-route-scripts',
  hooks: {
    'astro:build:done': (
      /** @type {{ dir: URL }} */
      { dir },
    ) => {
      const { failures } = verifyBuiltRouteScripts(
        decodeURIComponent(new URL('..', dir).pathname),
      );
      if (failures.length > 0)
        throw new Error(
          `Built routes reference scripts the build did not emit:\n${failures.join('\n')}`,
        );
    },
  },
});

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
