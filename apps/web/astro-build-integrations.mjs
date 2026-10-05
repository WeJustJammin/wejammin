import { copyFile, readFile, writeFile } from 'node:fs/promises';

import { verifyBuiltRouteScripts } from './built-route-scripts.mjs';

/**
 * Astro's Cloudflare entry checks static and fallback assets before invoking
 * Astro middleware. Append one outer fetch boundary after the adapter emits
 * its entry so every response, including ASSETS.fetch responses, receives
 * HTTPS enforcement and the locked security headers.
 */
export const edgeSecurityIntegration = () => ({
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
export const builtRouteScriptsIntegration = () => ({
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
