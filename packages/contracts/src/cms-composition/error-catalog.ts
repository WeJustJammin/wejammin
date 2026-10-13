/*
 * BE03c "Normative application error catalog". The HTTP status is never the
 * application code: each status maps to exactly one allowlisted code per
 * catalog, and the message is `{CODE}: {operation} operation rejected or
 * unavailable.` with no id, label, policy predicate, SQL, provider text, PII or
 * stack interpolated. 502, 503 and 504 are one code, `DEPENDENCY_UNAVAILABLE`
 * (DEC-172, DEC-179 R1, DEC-186 item 7).
 *
 * Zod-free: the Worker, the web relay and the browser submit mappers share this
 * table without loading the contract schemas.
 */

const common = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHENTICATED',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'DEPENDENCY_UNAVAILABLE',
  503: 'DEPENDENCY_UNAVAILABLE',
  504: 'DEPENDENCY_UNAVAILABLE',
} as const;

const catalog = <
  const Prefix extends string,
  const Token extends string,
  const Id extends string,
>(
  id: Id,
  operationToken: Token,
  codes: {
    readonly forbidden: `${Prefix}_FORBIDDEN`;
    readonly notFound: `${Prefix}_NOT_FOUND`;
    readonly conflict: `${Prefix}_VERSION_CONFLICT`;
    readonly validation: `${Prefix}_VALIDATION_FAILED`;
  },
) =>
  ({
    id,
    operationToken,
    codes: {
      ...common,
      403: codes.forbidden,
      404: codes.notFound,
      409: codes.conflict,
      422: codes.validation,
    },
  }) as const;

export const CMS_03C_CATALOGS = {
  template: catalog('cms.03c.template.v1', 'template', {
    forbidden: 'TEMPLATE_FORBIDDEN',
    notFound: 'TEMPLATE_NOT_FOUND',
    conflict: 'TEMPLATE_VERSION_CONFLICT',
    validation: 'TEMPLATE_VALIDATION_FAILED',
  }),
  composition: catalog('cms.03c.composition.v1', 'composition', {
    forbidden: 'COMPOSITION_FORBIDDEN',
    notFound: 'COMPOSITION_NOT_FOUND',
    conflict: 'COMPOSITION_VERSION_CONFLICT',
    validation: 'COMPOSITION_VALIDATION_FAILED',
  }),
  taxonomy: catalog('cms.03c.taxonomy.v1', 'taxonomy', {
    forbidden: 'TAXONOMY_FORBIDDEN',
    notFound: 'TAXONOMY_NOT_FOUND',
    conflict: 'TAXONOMY_VERSION_CONFLICT',
    validation: 'TAXONOMY_VALIDATION_FAILED',
  }),
  locale: catalog('cms.03c.locale.v1', 'locale', {
    forbidden: 'LOCALE_FORBIDDEN',
    notFound: 'LOCALE_SOURCE_NOT_FOUND',
    conflict: 'LOCALE_VERSION_CONFLICT',
    validation: 'LOCALE_VALIDATION_FAILED',
  }),
  relatedContent: catalog('cms.03c.related-content.v1', 'related-content', {
    forbidden: 'RELATED_CONTENT_FORBIDDEN',
    notFound: 'RELATED_CONTENT_NOT_FOUND',
    conflict: 'RELATED_CONTENT_VERSION_CONFLICT',
    validation: 'RELATED_CONTENT_VALIDATION_FAILED',
  }),
  governedReview: {
    ...catalog('cms.03c.governed-review.v1', 'governed-review', {
      forbidden: 'GOVERNED_REVIEW_FORBIDDEN',
      notFound: 'GOVERNED_REVIEW_NOT_FOUND',
      conflict: 'GOVERNED_REVIEW_VERSION_CONFLICT',
      validation: 'GOVERNED_REVIEW_VALIDATION_FAILED',
    }),
    /** CMS-03C-07, -08 and -09: a missing or stale MFA is a 401 with this code. */
    stepUpCode: 'STEP_UP_REQUIRED',
  },
} as const;

export type Cms03cCatalogName = keyof typeof CMS_03C_CATALOGS;

/**
 * The catalog each 03c operation answers in. `cmsTemplateContextRead` is not
 * named by the BE03c catalog table and is deliberately absent.
 */
export const CMS_03C_OPERATION_CATALOG = {
  'CMS-03C-01': 'template',
  cmsTemplateLatestRead: 'template',
  'CMS-03C-02': 'composition',
  'CMS-03C-12': 'composition',
  'CMS-03C-13': 'composition',
  'CMS-03C-14': 'composition',
  'CMS-03C-15': 'composition',
  cmsPatternLatestRead: 'composition',
  'CMS-03C-03': 'taxonomy',
  'CMS-03C-16': 'taxonomy',
  'CMS-03C-17': 'taxonomy',
  cmsTaxonomyVersionsRead: 'taxonomy',
  cmsTaxonomyTermsRead: 'taxonomy',
  'CMS-03C-04': 'locale',
  'CMS-03C-05': 'relatedContent',
  'CMS-03C-06': 'governedReview',
  'CMS-03C-07': 'governedReview',
  'CMS-03C-08': 'governedReview',
  'CMS-03C-09': 'governedReview',
  'CMS-03C-10': 'governedReview',
  'CMS-03C-11': 'governedReview',
} as const satisfies Readonly<Record<string, Cms03cCatalogName>>;

export type Cms03cOperationId = keyof typeof CMS_03C_OPERATION_CATALOG;

/** The catalog code of an HTTP status for an operation, or null outside the catalog. */
export const cmsCompositionCatalogCode = (
  operationId: Cms03cOperationId,
  status: number,
): string | null => {
  const codes: Readonly<Record<number, string>> =
    CMS_03C_CATALOGS[CMS_03C_OPERATION_CATALOG[operationId]].codes;
  return codes[status] ?? null;
};

/** The catalog message for a code: only a code the catalog defines may be spoken. */
export const cmsCompositionCatalogMessage = (
  catalogName: Cms03cCatalogName,
  code: string,
): string => {
  const entry = CMS_03C_CATALOGS[catalogName];
  const known = new Set<string>(Object.values(entry.codes));
  if ('stepUpCode' in entry) known.add(entry.stepUpCode);
  if (!known.has(code))
    throw new Error(`${code} is not in the ${catalogName} catalog.`);
  return `${code}: ${entry.operationToken} operation rejected or unavailable.`;
};
