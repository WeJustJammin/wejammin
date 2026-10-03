import type * as ContractValidatorModule from '@wejammin/contracts/content-schema-registry/validators';

/**
 * Lazy access to the zod validators of the registry contracts (AC261).
 *
 * The registry island hydrates on every registry route, so zod is never in its
 * static import graph. The server validates every payload with these same
 * schemas before the browser receives it. The island loads the validators here,
 * with a dynamic `import()`, only when it must check a payload it has not
 * already received from the server: a changed canonical read, a mutation
 * result, a step-up body. Until that first need the route ships no zod.
 */

export type ContractValidators = typeof ContractValidatorModule;

type Loader = () => Promise<ContractValidators>;

const defaultLoader: Loader = () =>
  import('@wejammin/contracts/content-schema-registry/validators');

let loader: Loader = defaultLoader;
let loaded: ContractValidators | null = null;
let pending: Promise<ContractValidators> | null = null;

/** The validators when a previous need already loaded them, else `null`. */
export const loadedContractValidators = (): ContractValidators | null => loaded;

/** Load the validators once; a failed load is retried by the next caller. */
export const loadContractValidators = (): Promise<ContractValidators> => {
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

/** Tests only: replace the loader and forget what was loaded. */
export const resetContractValidatorsForTest = (
  replacement: Loader = defaultLoader,
): void => {
  loader = replacement;
  loaded = null;
  pending = null;
};

/**
 * A payload check ran before the validators were loaded. The caller loads them
 * and repeats the same check; it is never a validation verdict.
 */
export class ContractValidatorsNotLoadedError extends Error {
  constructor() {
    super('The registry contract validators are not loaded yet.');
    this.name = 'ContractValidatorsNotLoadedError';
  }
}
