/*
 * The web project carries no Node typings (see
 * ../content-schema-registry/node-module-shims.d.ts for fs, path and url). The
 * axe test resolves axe-core through the Playwright integration package, which
 * needs `createRequire`; this declares exactly that.
 */
declare module 'node:module' {
  export function createRequire(url: string | URL): {
    (id: string): unknown;
    resolve(id: string): string;
  };
}
