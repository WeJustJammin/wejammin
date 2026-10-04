import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Proves a production build serves the browser scripts its documents name.
 *
 * Astro bundles a `<script src>` only when it sits in processed `.astro`
 * markup. The same tag inside a runtime HTML string (a `new Response(`html`)`
 * template, for example) is shipped verbatim, so the browser requests a
 * relative `.ts` path no build ever emitted and the page silently runs no
 * script. This check reads the built server output and fails when
 *
 * 1. any server module still carries a raw `<script src="....ts">` tag;
 * 2. a processed script (`renderScript` key) has no emitted client file, or
 *    its emitted file is missing from `dist/client`;
 * 3. a route whose own code serves a document (`<html` in a project module of
 *    its import closure) cannot reach the cross-tab `auth-scope-sync` asset
 *    through the processed scripts it renders.
 *
 * Run it against `apps/web/dist` after `astro build`; the build runs it itself.
 */

const RAW_TS_SCRIPT =
  /<script(?:\s+[\w:.-]+(?:=\\?"[^"<>]*\\?")?)*?\s+src=\\?"[^"<>]*\.[cm]?tsx?\\?"/u;
const RAW_SOURCE_REGION = /\/\/#region [^\n]*\?raw\n[\s\S]*?\/\/#endregion/gu;
const RENDER_SCRIPT = /renderScript\(\$\$result,\s*"([^"]+)"\)/gu;
const SCRIPT_MANIFEST_ENTRY =
  /"([^"]*\?astro&type=script[^"]*)":\s*"(_astro\/[^"]+)"/gu;
const ROUTE_ENTRY =
  /"route":\s*"([^"]+)"[\s\S]{0,400}?"type":\s*"page"[\s\S]{0,600}?"component":\s*"([^"]+\.astro)"/gu;
const STATIC_IMPORT = /(?:from|import)\s*"(\.\/[^"]+\.mjs)"/gu;
const CLIENT_IMPORT = /(?:from|import)\s*"(\.\/[^"]+\.js)"/gu;

export const AUTH_SCOPE_ASSET = /^auth-scope-sync\.[A-Za-z0-9_-]+\.js$/u;

const readText = (path) => readFileSync(path, 'utf8');

/** Parses the JSON array that follows `marker` (string-aware bracket scan). */
const jsonArrayAfter = (source, marker) => {
  const at = source.indexOf(marker);
  if (at === -1) return [];
  const start = source.indexOf('[', at);
  let depth = 0;
  let inString = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (char === '\\') index += 1;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === '[') depth += 1;
    else if (char === ']') {
      depth -= 1;
      if (depth === 0) return JSON.parse(source.slice(start, index + 1));
    }
  }
  return [];
};

const serverModules = (distDirectory) => {
  const modules = new Map();
  const serverDirectory = join(distDirectory, 'server');
  const chunkDirectory = join(serverDirectory, 'chunks');
  for (const [directory, prefix] of [
    [serverDirectory, ''],
    [chunkDirectory, 'chunks/'],
  ]) {
    if (!existsSync(directory)) continue;
    for (const name of readdirSync(directory))
      if (name.endsWith('.mjs'))
        modules.set(`${prefix}${name}`, readText(join(directory, name)));
  }
  return modules;
};

const isProjectModule = (source) =>
  /\/\/#region src\//u.test(source) || /\/apps\/web\/src\//u.test(source);

const clientClosure = (clientDirectory, start, seen = new Set()) => {
  if (seen.has(start)) return seen;
  seen.add(start);
  const path = join(clientDirectory, '_astro', start);
  if (!existsSync(path)) return seen;
  for (const match of readText(path).matchAll(CLIENT_IMPORT))
    clientClosure(clientDirectory, match[1].slice(2), seen);
  return seen;
};

const importsOf = (code) =>
  [...code.matchAll(CLIENT_IMPORT)].map((match) => match[1].slice(2));

/**
 * @param {string} distDirectory Absolute path of the built `dist` directory.
 * @returns {{ failures: string[], documentRoutes: string[], scriptKeys: number }}
 */
export const verifyBuiltRouteScripts = (distDirectory) => {
  const failures = [];
  const modules = serverModules(distDirectory);
  const clientDirectory = join(distDirectory, 'client');
  if (modules.size === 0)
    return {
      failures: [`no built server modules under ${distDirectory}/server`],
      documentRoutes: [],
      scriptKeys: 0,
    };

  const emitted = new Map();
  const inlined = new Map();
  let manifestSource = '';
  for (const [, source] of modules) {
    for (const match of source.matchAll(SCRIPT_MANIFEST_ENTRY))
      emitted.set(match[1], match[2]);
    for (const [key, code] of jsonArrayAfter(source, '"inlinedScripts":'))
      inlined.set(key, code);
    if (source.includes('"routeData"')) manifestSource += source;
  }

  // A `*.test.ts` file under src/pages is built as an endpoint chunk that
  // embeds raw page sources (`?raw` regions) for its assertions; those are text
  // data, not markup any route serves, so they are not inspected.
  for (const [name, source] of modules)
    if (RAW_TS_SCRIPT.test(source.replace(RAW_SOURCE_REGION, '')))
      failures.push(
        `${name} serves a raw TypeScript <script src> tag that no build emits`,
      );

  const keysOf = (source) =>
    [...source.matchAll(RENDER_SCRIPT)].map((match) => match[1]);
  const allKeys = new Set();
  for (const source of modules.values())
    for (const key of keysOf(source)) allKeys.add(key);
  for (const key of allKeys) {
    if (inlined.has(key)) continue;
    const file = emitted.get(key);
    if (file === undefined) failures.push(`script ${key} has no emitted file`);
    else if (!existsSync(join(clientDirectory, file)))
      failures.push(`script ${key} emits ${file}, which is missing from dist`);
  }

  const documentRoutes = [];
  const routes = new Map();
  for (const match of manifestSource.matchAll(ROUTE_ENTRY))
    routes.set(match[1], match[2]);

  for (const [route, component] of routes) {
    const owners = [...modules].filter(
      ([, source]) =>
        source.includes(`${component}"`) && source.includes('createComponent('),
    );
    if (owners.length === 0) continue;
    const closure = new Map();
    const visit = (name) => {
      const source = modules.get(name);
      if (source === undefined || closure.has(name)) return;
      if (!isProjectModule(source)) return;
      closure.set(name, source);
      for (const match of source.matchAll(STATIC_IMPORT)) {
        const target = name.startsWith('chunks/')
          ? `chunks/${match[1].slice(2)}`
          : match[1].slice(2);
        visit(target);
      }
    };
    for (const [name] of owners) visit(name);
    const servesDocument = [...closure.values()].some((source) =>
      /<html[\s>]/u.test(source),
    );
    if (!servesDocument) continue;
    documentRoutes.push(route);
    const reached = new Set();
    for (const source of closure.values())
      for (const key of keysOf(source)) {
        const code = inlined.get(key);
        if (code !== undefined) {
          for (const start of importsOf(code))
            clientClosure(clientDirectory, start, reached);
          continue;
        }
        const file = emitted.get(key);
        if (file === undefined) continue;
        clientClosure(clientDirectory, file.slice('_astro/'.length), reached);
      }
    if (![...reached].some((file) => AUTH_SCOPE_ASSET.test(file)))
      failures.push(
        `route ${route} (${component}) serves a document but loads no emitted auth-scope-sync asset`,
      );
  }

  return {
    failures,
    documentRoutes: documentRoutes.sort(),
    scriptKeys: allKeys.size,
  };
};

const isMain =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMain) {
  const distDirectory = process.argv[2] ?? join(process.cwd(), 'dist');
  const report = verifyBuiltRouteScripts(distDirectory);
  console.log(
    JSON.stringify(
      {
        distDirectory,
        documentRoutes: report.documentRoutes.length,
        scriptKeys: report.scriptKeys,
        failures: report.failures,
      },
      null,
      2,
    ),
  );
  if (report.failures.length > 0) process.exit(1);
}
