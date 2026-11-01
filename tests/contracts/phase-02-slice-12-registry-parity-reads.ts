import {
  ALL_ERRORS,
  BOUNDED_READ_ERRORS,
  type SpecOperation,
} from './phase-02-slice-12-registry-parity-types';

/*
 * The fourteen BE03c browser reads (GET): CMS-03C-10, -11, -13, -14, -17 and the nine named
 * supporting reads. Each entry cites its Route Registry row. A read has no CSRF, no idempotency
 * key and no If-Match; `request` is null because no request body exists.
 */

const DESIGNER = ['cms.template_designer'] as const;
const CURATOR = ['cms.taxonomy_curator'] as const;
const AUTHOR_EDITOR = ['cms.author', 'cms.editor'] as const;
const PAGE_QUERY = ['query:cursor', 'query:limit'] as const;

/** Defaults shared by every read: Tier 1, 8,000 ms, no write controls, no body. */
const read = (
  fields: Omit<
    SpecOperation,
    | 'method'
    | 'request'
    | 'csrf'
    | 'idempotency'
    | 'ifMatch'
    | 'stepUp'
    | 'successStatuses'
    | 'timeoutMs'
    | 'tier'
    | 'user'
    | 'party'
    | 'errors'
  > &
    Partial<
      Pick<SpecOperation, 'user' | 'party' | 'errors' | 'timeoutMs' | 'tier'>
    >,
): SpecOperation => ({
  method: 'GET',
  request: null,
  csrf: 'none',
  idempotency: 'none',
  ifMatch: 'none',
  stepUp: 'none',
  successStatuses: ['200'],
  timeoutMs: 8_000,
  tier: 1,
  user: 300,
  party: 600,
  errors: BOUNDED_READ_ERRORS,
  ...fields,
});

/** Tier 2 designer reads (15,000 ms, 60/min/user and 60/min/party). */
const designerRead = (fields: Parameters<typeof read>[0]): SpecOperation =>
  read({
    authClass: 'template_designer',
    capabilities: DESIGNER,
    timeoutMs: 15_000,
    tier: 2,
    user: 60,
    party: 60,
    ...fields,
  });

const authorRead = (fields: Parameters<typeof read>[0]): SpecOperation =>
  read({
    authClass: 'editorial_author',
    capabilities: AUTHOR_EDITOR,
    capabilityMode: 'any_of',
    ...fields,
  });

export const READ_OPERATIONS: readonly SpecOperation[] = [
  designerRead({
    id: 'cmsTemplateContextRead',
    cite: 'BE03c L162',
    path: '/api/v1/cms/templates/context',
    apiRequest: 'EmptyRequestSchema',
    success: 'TemplateDesignerContextSchema',
    rateClass: 'cms-template-read',
    etag: 'unstated',
    // Matrix row: 404 "not applicable (no target)"; 415 "unsupported media if sent".
    errors: [400, 401, 403, 415, 429, 500, 502, 503, 504],
    params: [],
  }),
  authorRead({
    id: 'cmsRelatedContentRead',
    cite: 'BE03c L167',
    path: '/api/v1/cms/entries/{entryId}/related-content',
    apiRequest: 'RelatedContentReadApiRequestSchema',
    success: 'RelatedContentRuleReadSchema',
    rateClass: 'cms-related-content-read',
    etag: 'unstated',
    params: ['path:entryId*'],
  }),
  authorRead({
    id: 'cmsLocaleVariantRead',
    cite: 'BE03c L168',
    path: '/api/v1/cms/entries/{entryId}/locales/{locale}',
    apiRequest: 'LocaleVariantReadApiRequestSchema',
    success: 'LocaleVariantReadSchema',
    rateClass: 'cms-locale-read',
    etag: 'unstated',
    params: ['path:entryId*', 'path:locale*'],
  }),
  designerRead({
    id: 'cmsTemplateLatestRead',
    cite: 'BE03c L169',
    path: '/api/v1/cms/templates/{templateKey}',
    apiRequest: 'TemplateLatestApiRequestSchema',
    success: 'TemplateVersionDetailSchema',
    rateClass: 'cms-template-read',
    etag: 'strong',
    // Matrix row: hidden/absent key is 404; 415 "unsupported media if sent".
    errors: BOUNDED_READ_ERRORS,
    params: ['path:templateKey*'],
  }),
  designerRead({
    id: 'cmsPatternLatestRead',
    cite: 'BE03c L170',
    path: '/api/v1/cms/patterns/{patternKey}',
    apiRequest: 'PatternLatestApiRequestSchema',
    success: 'PatternVersionDetailSchema',
    rateClass: 'cms-pattern-read',
    etag: 'strong',
    params: ['path:patternKey*'],
  }),
  read({
    id: 'cmsTaxonomyVersionsRead',
    cite: 'BE03c L171',
    path: '/api/v1/cms/taxonomies/{taxonomyId}/versions',
    apiRequest: 'TaxonomyVersionsApiRequestSchema',
    success: 'TaxonomyVersionsPageSchema',
    authClass: 'taxonomy_curator',
    capabilities: CURATOR,
    rateClass: 'cms-taxonomy-read',
    user: 60,
    party: 60,
    etag: 'page',
    errors: ALL_ERRORS,
    params: ['path:taxonomyId*'],
  }),
  read({
    id: 'cmsTaxonomyTermsRead',
    cite: 'BE03c L172',
    path: '/api/v1/cms/taxonomies/{taxonomyId}/terms',
    apiRequest: 'TaxonomyTermListApiRequestSchema',
    success: 'TaxonomyTermListPageSchema',
    authClass: 'taxonomy_curator',
    capabilities: CURATOR,
    rateClass: 'cms-taxonomy-terms-read',
    user: 120,
    party: 240,
    etag: 'page',
    errors: ALL_ERRORS,
    params: ['path:taxonomyId*', 'query:lifecycle', ...PAGE_QUERY],
  }),
  read({
    id: 'CMS-03C-10',
    cite: 'BE03c L177',
    path: '/api/v1/cms/governed-reviews/{reviewId}',
    apiRequest: 'GovernedReviewDetailApiRequestSchema',
    success: 'GovernedReviewDetailResourceSchema',
    authClass: 'definition_review_reader',
    capabilities: [
      'cms.template_designer',
      'cms.taxonomy_curator',
      'cms.reviewer',
      'cms.definition_review.assign',
    ],
    capabilityMode: 'any_of',
    rateClass: 'cms-governed-review-read',
    etag: 'strong',
    params: ['path:reviewId*'],
  }),
  read({
    id: 'CMS-03C-11',
    cite: 'BE03c L178',
    path: '/api/v1/cms/governed-reviews',
    apiRequest: 'GovernedReviewQueueApiRequestSchema',
    success: 'GovernedReviewQueuePageSchema',
    // "verified human": no capability gate, the scope filter is the authority.
    authClass: 'definition_review_queue',
    rateClass: 'cms-governed-review-read',
    etag: 'unstated',
    // 403 and 404 are "not applicable to a scoped list"; 409 is the cursor/context mismatch.
    errors: [400, 401, 409, 415, 422, 429, 500, 502, 503, 504],
    params: [...PAGE_QUERY, 'query:scope', 'query:state', 'query:subjectKind'],
  }),
  authorRead({
    id: 'CMS-03C-13',
    cite: 'BE03c L180',
    path: '/api/v1/cms/patterns/selector',
    apiRequest: 'PatternSelectorApiRequestSchema',
    success: 'PatternSelectorPageSchema',
    rateClass: 'cms-pattern-selector-read',
    etag: 'page',
    errors: ALL_ERRORS,
    params: ['query:contentTypeId*', ...PAGE_QUERY],
  }),
  // DEC-196: the designer-only counterpart of CMS-03C-13; Tier 1, 300/600 (not the Tier 2 designer defaults).
  read({
    id: 'cmsPatternNestableRead',
    cite: 'BE03c L184',
    path: '/api/v1/cms/patterns/nestable',
    apiRequest: 'PatternNestableApiRequestSchema',
    success: 'PatternSelectorPageSchema',
    authClass: 'template_designer',
    capabilities: DESIGNER,
    rateClass: 'cms-pattern-nestable-read',
    etag: 'page',
    // DEC-232: the matrix 409 cell is "not applicable" (every cursor fault is 400); 422 is the bounds (types, limit).
    errors: [400, 401, 403, 404, 415, 422, 429, 500, 502, 503, 504],
    params: ['query:contentTypeId*', ...PAGE_QUERY],
  }),
  authorRead({
    id: 'CMS-03C-14',
    cite: 'BE03c L181',
    path: '/api/v1/cms/compositions/instances/{instanceId}/update-diff',
    apiRequest: 'CompositionUpdateDiffApiRequestSchema',
    success: 'CompositionUpdateDiffResourceSchema',
    rateClass: 'cms-composition-read',
    etag: 'strong',
    // 409 is "not applicable to bounded read"; 422 is `diff_too_large`.
    errors: [400, 401, 403, 404, 415, 422, 429, 500, 502, 503, 504],
    params: ['path:instanceId*'],
  }),
  authorRead({
    id: 'cmsCompositionInstancesRead',
    cite: 'BE03c L182',
    path: '/api/v1/cms/entries/{entryId}/compositions',
    apiRequest: 'CompositionInstancesReadApiRequestSchema',
    success: 'CompositionInstancePageSchema',
    rateClass: 'cms-composition-instances-read',
    // "default limit 25, max 50; no entity tag".
    etag: 'none',
    params: ['path:entryId*', ...PAGE_QUERY],
  }),
  authorRead({
    id: 'CMS-03C-17',
    cite: 'BE03c L185',
    path: '/api/v1/cms/taxonomies/selector',
    apiRequest: 'TaxonomySelectorApiRequestSchema',
    success: 'TaxonomySelectorPageSchema',
    rateClass: 'cms-taxonomy-selector-read',
    etag: 'page',
    errors: ALL_ERRORS,
    params: [
      'query:typeKey*',
      'query:fieldKey*',
      'query:locale*',
      ...PAGE_QUERY,
    ],
  }),
];
