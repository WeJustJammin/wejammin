/**
 * The scope of the one-shot result a committed command leaves for the editor page
 * (`cms-editorial-result-save.ts` writes it, `cms-editorial-result-take.ts` reads it). The editor
 * reads it after hydration and the read does nothing when no record is there.
 */
export const CMS_EDITORIAL_RESULT_SCOPE = 'cms-editorial-result';
