import type * as CmsValidatorModule from '@wejammin/contracts/cms-editorial/validators';

/**
 * Lazy access to the zod validators of the CMS editorial islands (FE03
 * "Performance budgets and loading strategy", AC261, AC-106).
 *
 * The islands hydrate on every route of their surface, so zod and the contract
 * schemas are never in their static import graph. The server validates every
 * payload with these same schemas before the browser receives it. An island
 * loads the validators here, with a dynamic `import()`, only when it must check
 * something it has not already received verified from the server: a canonical
 * read, a command body and its answer, a stored hand-off. Until that first need
 * the route ships no zod, and a cold load fetches none of it.
 *
 * Async code that needs a validator writes one path:
 * `const validators = loadedCmsValidators() ?? (await loadCmsValidators());`
 * and a form handler uses `withCmsValidators`; both run synchronously when an
 * earlier need (or the intent warm-up of `warmCmsValidators`) already loaded
 * them.
 */

export type CmsValidators = typeof CmsValidatorModule;

type Loader = () => Promise<CmsValidators>;

const defaultLoader: Loader = () =>
  import('@wejammin/contracts/cms-editorial/validators');

let loader: Loader = defaultLoader;
let loaded: CmsValidators | null = null;
let pending: Promise<CmsValidators> | null = null;

/** The validators when an earlier need already loaded them, else `null`. */
export const loadedCmsValidators = (): CmsValidators | null => loaded;

/** Load the validators once; a failed load is retried by the next caller. */
export const loadCmsValidators = (): Promise<CmsValidators> => {
  if (loaded !== null) return Promise.resolve(loaded);
  pending ??= loader().then(
    (module) => {
      loaded = module;
      return module;
    },
    (error: unknown) => {
      pending = null;
      throw error;
    },
  );
  return pending;
};

/**
 * Start loading on a sign of intent (a form receives focus) so the check at
 * submit is usually synchronous. A failure is swallowed here: the submit that
 * really needs the validators calls `loadCmsValidators` and reports its own.
 */
export const warmCmsValidators = (): void => {
  if (loaded !== null || pending !== null) return;
  loadCmsValidators().catch(() => undefined);
};

/**
 * Run `use` with the validators: synchronously when they are loaded already
 * (the common case once a form was focused), else as soon as they load. When
 * they cannot be fetched `unavailable` runs instead and nothing is sent.
 */
export const withCmsValidators = (
  use: (validators: CmsValidators) => void,
  unavailable: () => void,
): void => {
  const ready = loadedCmsValidators();
  if (ready !== null) {
    use(ready);
    return;
  }
  loadCmsValidators().then(use, unavailable);
};

/** Tests only: replace the loader and forget what was loaded. */
export const resetCmsValidatorsForTest = (
  replacement: Loader = defaultLoader,
): void => {
  loader = replacement;
  loaded = null;
  pending = null;
};
