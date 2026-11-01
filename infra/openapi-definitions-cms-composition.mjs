/*
 * OpenAPI response definitions of the Slice 12 CMS composition operations
 * (BE03c CMS-03C-06 through CMS-03C-17 and the pattern and taxonomy reads).
 * The error statuses per operation are the BE03c "Contract and error matrix"
 * rows; the application codes and typed refusals under them are the
 * `error-catalog` and `refusals` contracts.
 */

const STATUS_TEXT = {
  400: (subject) => `${subject} request is malformed`,
  401: () => 'Authentication is required',
  403: (subject) => `${subject} capability or scope is forbidden`,
  404: (subject) => `${subject} target is absent or concealed`,
  409: (subject) => `${subject} version, state or idempotency conflicts`,
  415: () => 'Request media type is unsupported',
  422: (subject) => `${subject} fields fail validation`,
  429: (subject) => `${subject} rate limit exceeded`,
  500: (subject) => `${subject} request failed safely`,
  502: () => 'Dependency returned invalid data',
  503: () => 'Dependency unavailable',
  504: () => 'Dependency timed out',
};

const STEP_UP_401 = {
  status: 401,
  description: 'Authentication or recent step-up verification is required',
  schema: 'stepUpUnauthorized',
};

/** The error list of one operation: its subject text, its statuses and any override description. */
const errors = (subject, statuses, overrides = {}, { stepUp = false } = {}) =>
  statuses.map((status) => {
    if (status === 401 && stepUp) return STEP_UP_401;
    return {
      status,
      description: overrides[status] ?? STATUS_TEXT[status](subject),
      ...(status === 503 ? { retryable: true } : {}),
    };
  });

const COMMAND_STATUSES = [
  400, 401, 403, 404, 409, 415, 422, 429, 500, 502, 503, 504,
];
const LIST_STATUSES = [
  400, 401, 403, 404, 409, 415, 422, 429, 500, 502, 503, 504,
];
const NESTABLE_STATUSES = [
  400, 401, 403, 404, 415, 422, 429, 500, 502, 503, 504,
];
const BOUNDED_READ_STATUSES = [
  400, 401, 403, 404, 415, 429, 500, 502, 503, 504,
];

/**
 * @param {(statuses: number[], description: string, errors: object[], headers?: string) => object[]} responses
 *   the shared success-plus-error response builder of the definitions module.
 */
export const cmsCompositionRouteDefinitions = (responses) => ({
  'CMS-03C-06': {
    responses: responses(
      [201],
      'Governed review submitted with its frozen subject hash and policy basis',
      errors('Governed review', COMMAND_STATUSES, {
        409: 'Subject not submittable or idempotency conflicts (GOVERNED_REVIEW_VERSION_CONFLICT with details.reasonCode)',
        422: 'Subject hash or kind fails validation, or a declared canonical domain has no registered provider',
      }),
      'mutation',
    ),
  },
  'CMS-03C-07': {
    responses: responses(
      [200],
      'Governed review decision recorded',
      errors(
        'Governed decision',
        COMMAND_STATUSES,
        {
          403: 'Assignment, capability or separation of duties is forbidden',
          409: 'Stale review version, review not open, duplicate decision, unsatisfiable specialist slot, dependency changed or idempotency conflicts',
        },
        { stepUp: true },
      ),
      'entity',
    ),
  },
  'CMS-03C-08': {
    responses: [
      ...responses(
        [201],
        'Governed reviewer assignment created',
        errors(
          'Governed assignment',
          COMMAND_STATUSES,
          {
            409: 'Stale review version, ineligible reviewer, existing assignment, assignment limit, review not open or idempotency conflicts',
            422: 'Assignment contract or expiry bounds fail validation',
          },
          { stepUp: true },
        ),
        'entity',
      ),
      {
        status: '200',
        description: 'Governed reviewer assignment revoked',
        schema: 'success',
        headers: 'entity',
      },
    ],
  },
  'CMS-03C-09': {
    responses: [
      ...responses(
        [200],
        'Governed definition activated or retired; the previous active version is superseded',
        errors(
          'Governed activation',
          COMMAND_STATUSES,
          {
            409: 'Stale review version, subject not activatable or retirable, dependency changed, activation conflict, schedule exists or idempotency conflicts',
            422: 'Schedule time, preflight or canonical source validation failed',
          },
          { stepUp: true },
        ),
        'mutation',
      ),
      {
        status: '202',
        description: 'Governed activation scheduled; not yet active',
        schema: 'success',
        headers: 'mutation',
      },
    ],
  },
  'CMS-03C-10': {
    responses: responses(
      [200],
      'Governed review detail with safe decision metadata',
      errors('Governed review detail', BOUNDED_READ_STATUSES, {
        502: 'Review projection returned invalid data or a response bound was exceeded',
      }),
      'entity',
    ),
  },
  'CMS-03C-11': {
    responses: responses(
      [200],
      'Governed review queue page',
      errors(
        'Governed review queue',
        [400, 401, 409, 415, 422, 429, 500, 502, 503, 504],
        {
          409: 'Cursor is expired, tampered or bound to another context',
        },
      ),
      'entity',
    ),
  },
  'CMS-03C-12': {
    responses: responses(
      [201],
      'Pattern version created as a draft',
      errors('Pattern version', COMMAND_STATUSES, {
        409: 'Stale parent version, pattern cycle, digest mismatch or idempotency conflicts',
        422: 'Pattern key, tree, props, nested pattern or compatible type fails validation',
      }),
      'mutation',
    ),
  },
  cmsPatternLatestRead: {
    responses: responses(
      [200],
      'Current authorized editable pattern definition',
      errors('Pattern', BOUNDED_READ_STATUSES),
      'entity',
    ),
  },
  cmsLocaleVariantRead: {
    responses: responses(
      [200],
      'Current locale variant of the entry with its stored values, field resolutions and the active fallback order',
      errors('Locale variant', BOUNDED_READ_STATUSES, {
        403: 'Entry is visible but the caller cannot edit it',
        404: 'Entry is absent or concealed, or the locale is not supported by the active version',
      }),
      'entity',
    ),
  },
  cmsRelatedContentRead: {
    responses: responses(
      [200],
      'Current related-content rule of the source entry, or null when none is active',
      errors('Related content', BOUNDED_READ_STATUSES, {
        403: 'Source entry is visible but the caller cannot edit it',
        404: 'Source entry is absent or concealed',
      }),
      'entity',
    ),
  },
  cmsCompositionInstancesRead: {
    responses: responses(
      [200],
      'Page of the newest draft, active and pending-diff composition rows of the entry current draft revision, in render order',
      errors('Composition instances', BOUNDED_READ_STATUSES, {
        400: 'Entry id, limit or cursor is malformed, or the signed cursor is tampered, expired, over-lived or not issued to this caller for this entry and draft revision',
        403: 'Entry is visible but the caller cannot edit it',
        404: 'Entry is absent or concealed',
      }),
      // BE03c L182: "no entity tag" (the Worker answers with `NO_ETAG`), so no ETag header.
      'unversioned',
    ),
  },
  'CMS-03C-13': {
    responses: responses(
      [200],
      'Active compatible pattern versions page',
      errors('Pattern selector', LIST_STATUSES, {
        409: 'Cursor is expired, tampered or bound to another context',
      }),
      'entity',
    ),
  },
  cmsPatternNestableRead: {
    responses: responses(
      [200],
      'Active pattern versions of the owner scope compatible with every requested content type, for the nested-pattern picker',
      // DEC-232: every cursor fault is 400 (the matrix 409 cell is "not applicable"); 422 is the bounds.
      errors('Nestable pattern list', NESTABLE_STATUSES, {
        400: 'Content type ids, limit or cursor are malformed, or the signed cursor is tampered, expired or not issued to this caller for this type set',
        403: 'Caller does not hold the pattern designer capability',
        404: 'A requested content type is absent or concealed',
        422: 'The type count or the limit is outside its bounds',
      }),
      'entity',
    ),
  },
  'CMS-03C-14': {
    responses: responses(
      [200],
      'Three-way update diff of a linked pattern instance',
      errors(
        'Pattern update diff',
        [400, 401, 403, 404, 415, 422, 429, 500, 502, 503, 504],
        {
          422: 'The diff exceeds 128 changed paths or 256 KiB',
        },
      ),
      'entity',
    ),
  },
  'CMS-03C-15': {
    responses: responses(
      [200],
      'Pattern update accepted or instances detached, all or nothing',
      errors('Pattern update', COMMAND_STATUSES, {
        409: 'Stale entry or instance version, colliding diff or idempotency conflicts',
        422: 'Targets, choices or pattern version fail validation',
      }),
      'mutation',
    ),
  },
  'CMS-03C-16': {
    responses: responses(
      [201],
      'Taxonomy version created as a draft',
      errors('Taxonomy version', COMMAND_STATUSES, {
        409: 'Stale parent version or idempotency conflicts',
        422: 'Key, allowlist or canonical domain fails validation',
      }),
      'mutation',
    ),
  },
  'CMS-03C-17': {
    responses: responses(
      [200],
      'Active terms of the vocabularies allowlisting the type and field',
      errors('Taxonomy selector', LIST_STATUSES, {
        409: 'Cursor is expired, tampered or bound to another context',
      }),
      'entity',
    ),
  },
  cmsTaxonomyVersionsRead: {
    responses: responses(
      [200],
      'Versions of one vocabulary, newest first',
      errors('Taxonomy versions', LIST_STATUSES),
      'entity',
    ),
  },
  cmsTaxonomyTermsRead: {
    responses: responses(
      [200],
      'Terms of one vocabulary page',
      errors('Taxonomy terms', LIST_STATUSES, {
        409: 'Cursor is expired, tampered or bound to another context',
        502: 'Terms projection returned invalid data or the response exceeded 256 KiB',
      }),
      'entity',
    ),
  },
});
