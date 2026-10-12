import { useRef } from 'react';

import {
  loadCmsValidators,
  loadedCmsValidators,
  type CmsValidators,
} from '../../lib/cms-contract-validators';

/**
 * Shown when the lazily loaded validators could not be fetched: the draft was
 * not checked, so nothing was sent and the same form can be submitted again.
 */
export const CMS_TEMPLATE_CHECK_UNAVAILABLE_MESSAGE =
  'The draft could not be checked before sending, so nothing was sent. Check your connection and try again.';

/**
 * The template islands hydrate on every template route with no zod in their
 * static graph (FE03 performance budgets, AC261). A submit obtains the schemas
 * here: already loaded after the form received focus (`warmCmsValidators`),
 * else loaded on demand. While a cold submit waits, a second one is refused.
 */
export const useCmsTemplateValidators = () => {
  const checking = useRef(false);
  return {
    isChecking: (): boolean => checking.current,
    /** The validators, or `null` when they cannot be fetched: send nothing. */
    obtain: async (): Promise<CmsValidators | null> => {
      checking.current = true;
      try {
        return loadedCmsValidators() ?? (await loadCmsValidators());
      } catch {
        return null;
      } finally {
        checking.current = false;
      }
    },
  };
};
