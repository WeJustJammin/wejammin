import { retryable } from '../../lib/retryable-import';
import { importModule } from '../../lib/module-unavailable';
import type { submitLocaleVariant } from './locale-variant-submit';

/** The seam a test replaces: the dynamic import of the save. */
export const localeSubmitImporters = {
  submit: retryable(() => import('./locale-variant-submit')),
};

/**
 * The save runs only when the person saves, so it loads then, not with the form (P2-S11-AC-106).
 * A chunk that cannot be fetched rejects with `ModuleUnavailableError`: nothing was sent.
 */
export const submitOnDemand: typeof submitLocaleVariant = async (...input) =>
  (
    await importModule(() => localeSubmitImporters.submit())
  ).submitLocaleVariant(...input);
