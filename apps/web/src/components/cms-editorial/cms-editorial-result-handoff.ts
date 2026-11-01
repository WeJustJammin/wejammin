/**
 * The result handoff of a committed command, for the page it navigates to. The implementation is
 * two modules so that each side loads only its own code: `cms-editorial-result-save.ts` (the
 * producers) and `cms-editorial-result-take.ts` (the editor). This barrel keeps one name for
 * tests and for type imports.
 */
export type { CmsEditorialResultSummary } from './cms-editorial-result-types';
export { saveCmsEditorialResult } from './cms-editorial-result-save';
export {
  CMS_EDITORIAL_RESULT_TTL_MS,
  takeCmsEditorialResult,
} from './cms-editorial-result-take';
